import type { Browser, BrowserContext, Cookie, Page } from 'playwright'
import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common'
import { BROWSER_CONFIG, BrowserModuleConfig } from './browser.constants'
import { ProxyService } from './proxy.service'
import { getStealthChromium } from './stealth'

interface PooledContext {
  context: BrowserContext
  ownerKey: string
  proxyKey: string
  busy: boolean
  lastUsedAt: number
}

const NO_PROXY_KEY = '__direct__'

/**
 * One BrowserContext per (platform, accountId) pair, kept warm in an LRU pool
 * so cookies/fingerprints survive between actions while staying isolated.
 *
 * Proxy handling: each unique proxy spins its own Chromium because the launch
 * `proxy` option is per-Browser, not per-Context. The legacy single-proxy
 * config flow is preserved (still works without {@link ProxyService}).
 *
 * NOTE: PoC scope. Locks are coarse (per-pool-mutex would be the next step);
 * the current implementation is sufficient for the single-account demo flow.
 */
@Injectable()
export class BrowserPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name)
  /** Map proxyKey → live Browser. Empty string is used for "direct". */
  private readonly browsers = new Map<string, Browser>()
  private readonly contexts = new Map<string, PooledContext>()

  constructor(
    @Inject(BROWSER_CONFIG) private readonly config: BrowserModuleConfig,
    /**
     * ProxyService is optional so the test fixture and the original
     * single-proxy boot flow keep working with no module wiring changes.
     */
    @Optional() private readonly proxyService?: ProxyService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    for (const entry of this.contexts.values()) {
      try {
        await entry.context.close()
      }
      catch (err) {
        this.logger.warn(`Failed to close context ${entry.ownerKey}: ${(err as Error).message}`)
      }
    }
    this.contexts.clear()
    for (const browser of this.browsers.values())
      await browser.close().catch(() => {})
    this.browsers.clear()
  }

  /**
   * Acquire (or create) a BrowserContext for the given owner key. Cookies
   * supplied here are merged on first use; subsequent acquisitions reuse the
   * same context.
   *
   * `accountId` opts an account into per-account sticky proxy assignment via
   * {@link ProxyService}. Falls back to {@link BrowserModuleConfig.proxy} or
   * direct egress when no pool is configured.
   */
  async acquire(
    ownerKey: string,
    cookies: Cookie[] = [],
    opts?: { accountId?: string },
  ): Promise<{ context: BrowserContext, page: Page, release: () => Promise<void> }> {
    const proxyUrl = this.resolveProxy(opts?.accountId)
    const proxyKey = proxyUrl ?? NO_PROXY_KEY
    const browser = await this.ensureBrowser(proxyUrl, proxyKey)

    const compositeKey = `${proxyKey}|${ownerKey}`
    let pooled = this.contexts.get(compositeKey)
    if (!pooled) {
      const context = await browser.newContext({
        userAgent: this.config.userAgent,
        viewport: { width: 1366, height: 820 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
      })
      if (cookies.length)
        await context.addCookies(cookies)
      pooled = { context, ownerKey: compositeKey, proxyKey, busy: false, lastUsedAt: Date.now() }
      this.contexts.set(compositeKey, pooled)
      this.logger.log(`Created context ${compositeKey} (pool size=${this.contexts.size})`)
      await this.evictIfNeeded()
    }
    else if (cookies.length) {
      await pooled.context.addCookies(cookies)
    }
    pooled.busy = true
    pooled.lastUsedAt = Date.now()

    const page = await pooled.context.newPage()
    const release = async () => {
      if (!page.isClosed())
        await page.close().catch(() => {})
      pooled!.busy = false
      pooled!.lastUsedAt = Date.now()
    }
    return { context: pooled.context, page, release }
  }

  /** Random human-like pause between ops, configurable via min/maxDelayMs. */
  async humanDelay(): Promise<void> {
    const { minDelayMs, maxDelayMs } = this.config
    const span = Math.max(0, maxDelayMs - minDelayMs)
    const ms = minDelayMs + Math.floor(Math.random() * (span + 1))
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  private resolveProxy(accountId?: string): string | undefined {
    if (accountId && this.proxyService) {
      const picked = this.proxyService.pickFor(accountId)
      if (picked)
        return picked
    }
    return this.config.proxy
  }

  private async ensureBrowser(proxyUrl: string | undefined, proxyKey: string): Promise<Browser> {
    const existing = this.browsers.get(proxyKey)
    if (existing && existing.isConnected())
      return existing
    if (existing) {
      this.browsers.delete(proxyKey)
    }
    const chromium = getStealthChromium()
    const browser = await chromium.launch({
      headless: this.config.headless,
      proxy: proxyUrl ? { server: proxyUrl } : undefined,
    })
    this.browsers.set(proxyKey, browser)
    this.logger.log(
      `Launched chromium (headless=${this.config.headless}, proxy=${proxyKey === NO_PROXY_KEY ? 'direct' : 'present'})`,
    )
    return browser
  }

  private async evictIfNeeded(): Promise<void> {
    if (this.contexts.size <= this.config.poolSize)
      return
    const candidates = Array.from(this.contexts.values())
      .filter(c => !c.busy)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
    const victim = candidates[0]
    if (!victim)
      return
    this.contexts.delete(victim.ownerKey)
    await victim.context.close().catch(() => {})
    this.logger.log(`Evicted context ${victim.ownerKey}`)
  }
}
