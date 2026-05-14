import { Inject, Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@yikart/common'
import { RedisService } from '@yikart/redis'

export interface RateLimitConfig {
  /** Maximum actions allowed per `windowSeconds`. */
  capacity: number
  /** Window in seconds. */
  windowSeconds: number
}

/** Per-action defaults. Tuned to be conservative; per-user override comes later. */
export const DEFAULT_QUOTAS: Record<string, RateLimitConfig> = {
  like: { capacity: 200, windowSeconds: 60 * 60 * 24 },
  unlike: { capacity: 200, windowSeconds: 60 * 60 * 24 },
  favorite: { capacity: 100, windowSeconds: 60 * 60 * 24 },
  unfavorite: { capacity: 100, windowSeconds: 60 * 60 * 24 },
  follow: { capacity: 50, windowSeconds: 60 * 60 * 24 },
  unfollow: { capacity: 50, windowSeconds: 60 * 60 * 24 },
  comment: { capacity: 100, windowSeconds: 60 * 60 * 24 },
  reply: { capacity: 200, windowSeconds: 60 * 60 * 24 },
}

const ENGAGEMENT_RATE_LIMIT_QUOTAS = Symbol('ENGAGEMENT_RATE_LIMIT_QUOTAS')

/**
 * Token bucket implementation backed by Redis. Per (account, action) bucket
 * holds at most `capacity` tokens; each call consumes one. When empty the
 * caller is throttled with a typed AppException so the controller layer can
 * translate it to a 429 + Retry-After-style payload.
 *
 * Circuit breaker: when an action records >= 5 consecutive failures inside an
 * hour, the breaker opens for 12 hours. Successful calls reset the counter.
 *
 * The Lua script runs entirely on the Redis side so checking + decrementing
 * is atomic — important because BullMQ workers race on the same bucket.
 */
@Injectable()
export class EngagementRateLimitGuardService {
  private readonly logger = new Logger(EngagementRateLimitGuardService.name)

  constructor(
    private readonly redis: RedisService,
    @Inject(ENGAGEMENT_RATE_LIMIT_QUOTAS)
    private readonly quotas: Record<string, RateLimitConfig> = DEFAULT_QUOTAS,
  ) {}

  static provide(quotas: Record<string, RateLimitConfig> = DEFAULT_QUOTAS) {
    return [
      { provide: ENGAGEMENT_RATE_LIMIT_QUOTAS, useValue: quotas },
      EngagementRateLimitGuardService,
    ]
  }

  private bucketKey(accountId: string, action: string): string {
    return `engage:rate:${accountId}:${action}`
  }

  private breakerKey(accountId: string): string {
    return `engage:cb:${accountId}`
  }

  private breakerFailKey(accountId: string): string {
    return `engage:cb:${accountId}:fails`
  }

  /**
   * Throws on rate-limit hit or open breaker. Returns the remaining tokens.
   *
   * NOTE: throws BEFORE the action runs. Callers should call this first, then
   * invoke the provider, then `recordFailure` / `recordSuccess` on the way out.
   */
  async assertAllowed(accountId: string, action: string): Promise<{ remaining: number }> {
    if (await this.redis.get(this.breakerKey(accountId))) {
      throw new AppException(ResponseCode.EngagementCircuitBreakerOpen)
    }

    const quota = this.quotas[action]
    if (!quota) {
      // unknown action — be permissive but log
      this.logger.warn(`No quota configured for action=${action}; allowing`)
      return { remaining: -1 }
    }

    // Token-bucket-as-counter via INCR + EXPIRE (atomic enough for this scale).
    const key = this.bucketKey(accountId, action)
    const value = await this.redis.eval(
      `local current = redis.call('INCR', KEYS[1])
       if current == 1 then
         redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
       end
       return current`,
      1,
      key,
      quota.windowSeconds,
    ) as number
    if (value > quota.capacity) {
      const ttl = await this.redis.ttl(key)
      const retryAfter = Math.max(1, Math.ceil(ttl / 1000))
      throw new AppException(
        ResponseCode.EngagementRateLimited,
        { retryAfter },
      )
    }
    return { remaining: Math.max(0, quota.capacity - value) }
  }

  async recordSuccess(accountId: string): Promise<void> {
    await this.redis.del(this.breakerFailKey(accountId))
  }

  /**
   * Increment failure counter for an account; trip the breaker when we cross
   * 5 consecutive failures inside an hour.
   */
  async recordFailure(accountId: string): Promise<{ tripped: boolean, fails: number }> {
    const fails = await this.redis.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then
         redis.call('EXPIRE', KEYS[1], 3600)
       end
       return count`,
      1,
      this.breakerFailKey(accountId),
    ) as number

    if (fails >= 5) {
      // 12h cooldown
      await this.redis.set(this.breakerKey(accountId), '1', 12 * 60 * 60)
      this.logger.warn(`Circuit breaker tripped for account ${accountId} after ${fails} failures`)
      return { tripped: true, fails }
    }
    return { tripped: false, fails }
  }
}
