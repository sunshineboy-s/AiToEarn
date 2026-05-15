import type { Cookie } from 'playwright'
import { readFile } from 'node:fs/promises'
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  COOKIE_VAULT_CONFIG,
  CookieFilePayload,
  CookieVaultModuleConfig,
  RawCookieEntry,
} from './cookie-vault.constants'

const PLATFORM_DEFAULT_DOMAIN: Record<string, string> = {
  xhs: '.xiaohongshu.com',
}

/**
 * PoC-grade in-memory cookie store.
 *
 * Loads cookies from a JSON file (`AUTOMATION_COOKIE_FILE`) or inline JSON
 * (`AUTOMATION_COOKIE_JSON`) at boot. The Vault hands out Playwright-compatible
 * cookie arrays keyed by `${platform}:${accountId}`.
 *
 * In M1+ we'll swap this for AES-256-GCM at-rest with a KMS-derived key (see
 * design.md §2.2 / FR-? Cookie Vault).
 */
@Injectable()
export class CookieVaultService implements OnModuleInit {
  private readonly logger = new Logger(CookieVaultService.name)
  private readonly store = new Map<string, Cookie[]>()

  constructor(
    @Inject(COOKIE_VAULT_CONFIG) private readonly config: CookieVaultModuleConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const payload = await this.loadPayload()
    if (!payload) {
      this.logger.warn(
        'CookieVault: no cookie source configured (AUTOMATION_COOKIE_FILE / AUTOMATION_COOKIE_JSON). '
        + 'Workers will run anonymously and likely fail authenticated actions.',
      )
      return
    }
    this.ingest(payload)
  }

  /**
   * Returns Playwright cookies for the (platform, accountId) pair, or [] if
   * none are loaded (caller decides whether to proceed anonymously).
   */
  get(platform: string, accountId: string): Cookie[] {
    return this.store.get(this.keyOf(platform, accountId)) ?? []
  }

  /** Manually inject cookies (e.g. from an admin endpoint). PoC-only. */
  set(platform: string, accountId: string, cookies: RawCookieEntry[]): void {
    this.store.set(
      this.keyOf(platform, accountId),
      cookies.map(c => this.normalize(c, platform)),
    )
  }

  list(): Array<{ key: string, count: number }> {
    return Array.from(this.store.entries()).map(([key, cookies]) => ({
      key,
      count: cookies.length,
    }))
  }

  private async loadPayload(): Promise<CookieFilePayload | null> {
    if (this.config.cookieJson) {
      try {
        return JSON.parse(this.config.cookieJson) as CookieFilePayload
      }
      catch (err) {
        this.logger.error(`CookieVault: failed to parse AUTOMATION_COOKIE_JSON: ${(err as Error).message}`)
        return null
      }
    }
    if (this.config.cookieFile) {
      try {
        const raw = await readFile(this.config.cookieFile, 'utf8')
        return JSON.parse(raw) as CookieFilePayload
      }
      catch (err) {
        this.logger.error(
          `CookieVault: failed to read ${this.config.cookieFile}: ${(err as Error).message}`,
        )
        return null
      }
    }
    return null
  }

  private ingest(payload: CookieFilePayload): void {
    if (Array.isArray(payload)) {
      // single-account flat list — assume xhs:default until called in
      this.store.set('xhs:default', payload.map(c => this.normalize(c, 'xhs')))
    }
    else if ('cookies' in payload && Array.isArray(payload.cookies)) {
      this.store.set('xhs:default', payload.cookies.map(c => this.normalize(c, 'xhs')))
    }
    else {
      for (const [key, cookies] of Object.entries(payload)) {
        const platform = key.includes(':') ? key.split(':')[0]! : 'xhs'
        this.store.set(key, cookies.map(c => this.normalize(c, platform)))
      }
    }
    this.logger.log(
      `CookieVault loaded ${this.store.size} account(s): `
      + `${Array.from(this.store.entries()).map(([k, v]) => `${k}(${v.length})`).join(', ')}`,
    )
  }

  private keyOf(platform: string, accountId: string): string {
    return `${platform}:${accountId}`
  }

  private normalize(c: RawCookieEntry, platform: string): Cookie {
    const expires = c.expires ?? c.expirationDate
    return {
      name: c.name,
      value: c.value,
      domain: c.domain ?? PLATFORM_DEFAULT_DOMAIN[platform] ?? '',
      path: c.path ?? '/',
      expires: typeof expires === 'number' ? Math.floor(expires) : -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? true,
      sameSite: this.mapSameSite(c.sameSite),
    }
  }

  private mapSameSite(value: RawCookieEntry['sameSite']): 'Strict' | 'Lax' | 'None' {
    switch ((value ?? '').toString().toLowerCase()) {
      case 'strict':
        return 'Strict'
      case 'none':
      case 'no_restriction':
        return 'None'
      case 'lax':
      case 'unspecified':
      case '':
      default:
        return 'Lax'
    }
  }
}
