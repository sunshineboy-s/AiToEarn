import { Injectable, Logger } from '@nestjs/common'

/**
 * One proxy entry. The URL must include scheme + auth + host + port; the
 * Playwright launcher passes it straight through, so any format Chromium
 * accepts (`http://user:pass@host:port`) works here.
 */
export interface ProxyEntry {
  /** Stable identifier — used to make the choice sticky per accountId. */
  id: string
  url: string
  /** Human-readable region, surfaced in logs / metrics later. */
  region?: string
}

/**
 * Account-sticky proxy picker.
 *
 * Why sticky? Engagement workloads are per-account and platforms (xhs,
 * douyin, etc.) ramp risk-control fast when the same cookie hops across
 * multiple egress IPs. Sticky-by-accountId pins each account to one proxy
 * for the lifetime of the process. A round-robin map keeps the assignment
 * stable across restarts as long as the same proxy list is configured.
 *
 * The service is intentionally minimal — health checks and weighted
 * rotation are deferred to the rest of T3.5 work. For now we ensure:
 *   - empty pool → caller sees `undefined` and the BrowserPoolService
 *     launches without a proxy (current behaviour).
 *   - same accountId → same proxy across calls within a process boot.
 *   - explicit override (`opts.preferProxyId`) honoured when present.
 */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name)
  private readonly pool: ProxyEntry[]
  /** Account → ProxyEntry.id assignment; keeps the choice stable. */
  private readonly assignments = new Map<string, string>()
  private cursor = 0

  constructor(pool: ProxyEntry[] = parsePoolFromEnv()) {
    this.pool = pool
    if (pool.length === 0) {
      this.logger.log('ProxyService: no proxies configured; workers run direct')
    }
    else {
      this.logger.log(`ProxyService: ${pool.length} proxy entries loaded (sticky-by-account)`)
    }
  }

  /**
   * Pick a proxy URL for the given accountId. Returns undefined when the pool
   * is empty so callers can fall back to a direct connection.
   */
  pickFor(accountId: string, opts?: { preferProxyId?: string }): string | undefined {
    if (this.pool.length === 0)
      return undefined

    if (opts?.preferProxyId) {
      const match = this.pool.find(p => p.id === opts.preferProxyId)
      if (match) {
        this.assignments.set(accountId, match.id)
        return match.url
      }
    }

    const existing = this.assignments.get(accountId)
    if (existing) {
      const match = this.pool.find(p => p.id === existing)
      if (match)
        return match.url
      // assignment stale (proxy was removed); fall through
      this.assignments.delete(accountId)
    }

    const next = this.pool[this.cursor % this.pool.length]
    if (!next)
      return undefined
    this.cursor += 1
    this.assignments.set(accountId, next.id)
    return next.url
  }

  /** Visible only so tests + an admin endpoint can introspect the state. */
  describe(): { size: number, assignments: Record<string, string> } {
    return {
      size: this.pool.length,
      assignments: Object.fromEntries(this.assignments.entries()),
    }
  }
}

/**
 * Parse `AUTOMATION_PROXY_POOL` env var. The format is a JSON array, e.g.
 *   '[{"id":"jp-1","url":"http://u:p@1.2.3.4:8080","region":"jp"}]'
 * Falls back to a single-entry pool if `AUTOMATION_PROXY` is set (legacy).
 *
 * Lives outside the class so it can be replaced with a config-driven loader
 * once we bring in the wider config schema.
 */
function parsePoolFromEnv(): ProxyEntry[] {
  const raw = process.env['AUTOMATION_PROXY_POOL']
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p): p is { id: string, url: string, region?: string } =>
            typeof p === 'object' && p !== null
            && typeof (p as { id?: unknown }).id === 'string'
            && typeof (p as { url?: unknown }).url === 'string')
          .map(p => ({ id: p.id, url: p.url, region: p.region }))
      }
    }
    catch {
      // fall through to legacy single-proxy path
    }
  }
  const legacy = process.env['AUTOMATION_PROXY']
  if (legacy)
    return [{ id: 'default', url: legacy }]
  return []
}
