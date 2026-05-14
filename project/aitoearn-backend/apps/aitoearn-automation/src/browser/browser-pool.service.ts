import type { Browser, BrowserContext, Page } from 'playwright'
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { BROWSER_CONFIG, BrowserModuleConfig } from './browser.constants'
import { getStealthChromium } from './stealth'

interface PooledContext {
  context: BrowserContext
  ownerKey: string
  busy: boolean
  lastUsedAt: number
}

/**
 * One BrowserContext per (platform, accountId) pair, kept warm in an LRU pool
 * so cookies/fingerprints survive between actions while staying isolated.
 *
 * NOTE: PoC scope. Locks are coarse (per-pool-mutex would be the next step);
 * the current implementation is sufficient for the single-account demo flow.
 */
@Injectable()
export class BrowserPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name)
  private browser: Browser | null = null
  private readonly contexts = new Map<string, PooledContext>()

  constructor(
    @Inject(BROWSER_CONFIG) private readonly config: BrowserModuleConfig,
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
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
  }

  /**
   * Acquire (or create) a BrowserContext for the given owner key. Cookies
   * supplied here are merged on first use; subsequent acquisitions reuse the
   * same context.
   */
  async acquire(
    ownerKey: string,
    cookies: import('playwright').Cookie[] = [],
  ): Promise<{ context: BrowserContext, page: Page, release: () => Promise<void> }> {
    const browser = await this.ensureBrowser()
    let pooled = this.contexts.get(ownerKey)
    if (!pooled) {
      const context = await browser.newContext({
        userAgent: this.config.userAgent,
        viewport: { width: 1366, height: 820 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
      })
      if (cookies.length)
        await context.addCookies(cookies)
      pooled = { context, ownerKey, busy: false, lastUsedAt: Date.now() }
      this.contexts.set(ownerKey, pooled)
      this.logger.log(`Created context ${ownerKey} (pool size=${this.contexts.size})`)
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

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected())
      return this.browser
    const chromium = getStealthChromium()
    this.browser = await chromium.launch({
      headless: this.config.headless,
      proxy: this.config.proxy ? { server: this.config.proxy } : undefined,
    })
    this.logger.log(`Launched chromium (headless=${this.config.headless})`)
    return this.browser
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
