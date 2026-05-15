// @vitest-environment node
import { AppException, ResponseCode } from '@yikart/common'
import { DEFAULT_QUOTAS, EngagementRateLimitGuardService } from './rate-limit-guard.service'

/**
 * Lightweight in-memory Redis double. We only need the methods the guard
 * actually exercises (`get`, `set`, `del`, `eval`, `ttl`). Behaviour is enough
 * to drive the bucket / breaker semantics without booting ioredis.
 */
class FakeRedis {
  private readonly store = new Map<string, { value: string, expireAt?: number }>()

  private now() {
    return Date.now()
  }

  private alive(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry)
      return false
    if (entry.expireAt && entry.expireAt < this.now()) {
      this.store.delete(key)
      return false
    }
    return true
  }

  async get(key: string): Promise<string | null> {
    return this.alive(key) ? this.store.get(key)!.value : null
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expireAt: ttlSeconds ? this.now() + ttlSeconds * 1000 : undefined,
    })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || !entry.expireAt)
      return -1
    return Math.max(0, entry.expireAt - this.now())
  }

  /**
   * Mimics the only Lua scripts the guard runs:
   *   1. INCR + (EXPIRE on first hit) — used by the bucket
   *   2. INCR + (EXPIRE on first hit) — used by the breaker counter
   * The script body inspects ARGV[1] for the TTL when it's the first INCR.
   */
  async eval(_script: string, _numKeys: number, key: string, ...args: string[]): Promise<number> {
    const ttl = args[0] ? Number.parseInt(args[0], 10) : 3600
    const current = (Number.parseInt((await this.get(key)) ?? '0', 10)) + 1
    const isFirst = current === 1
    await this.set(key, String(current), isFirst ? ttl : Math.ceil(((await this.ttl(key)) || ttl * 1000) / 1000))
    return current
  }
}

function makeGuard() {
  const fake = new FakeRedis()
  const guard = new EngagementRateLimitGuardService(fake as never, DEFAULT_QUOTAS)
  return { guard, fake }
}

describe('EngagementRateLimitGuardService', () => {
  it('allows actions until the per-account quota is exhausted', async () => {
    const { guard } = makeGuard()
    const original = DEFAULT_QUOTAS.like!.capacity
    DEFAULT_QUOTAS.like!.capacity = 3
    try {
      await guard.assertAllowed('acc-1', 'like')
      await guard.assertAllowed('acc-1', 'like')
      await guard.assertAllowed('acc-1', 'like')
      await expect(guard.assertAllowed('acc-1', 'like')).rejects.toBeInstanceOf(AppException)
    }
    finally {
      DEFAULT_QUOTAS.like!.capacity = original
    }
  })

  it('does not cross-contaminate buckets between actions', async () => {
    const { guard } = makeGuard()
    const original = DEFAULT_QUOTAS.like!.capacity
    DEFAULT_QUOTAS.like!.capacity = 1
    try {
      await guard.assertAllowed('acc-2', 'like')
      // unlike has its own quota, so the next call should still pass
      await expect(guard.assertAllowed('acc-2', 'unlike')).resolves.toBeDefined()
    }
    finally {
      DEFAULT_QUOTAS.like!.capacity = original
    }
  })

  it('opens the breaker after 5 consecutive failures and rejects further calls', async () => {
    const { guard } = makeGuard()
    for (let i = 0; i < 5; i++)
      await guard.recordFailure('acc-3')
    await expect(guard.assertAllowed('acc-3', 'like')).rejects.toMatchObject({
      response: expect.objectContaining({ code: ResponseCode.EngagementCircuitBreakerOpen }),
    })
  })

  it('clears the failure counter on success', async () => {
    const { guard } = makeGuard()
    await guard.recordFailure('acc-4')
    await guard.recordFailure('acc-4')
    await guard.recordSuccess('acc-4')
    // 4 more failures should not yet trip the breaker now that we reset.
    for (let i = 0; i < 4; i++)
      await guard.recordFailure('acc-4')
    await expect(guard.assertAllowed('acc-4', 'like')).resolves.toBeDefined()
  })
})
