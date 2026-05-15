import type { Cookie } from 'playwright'
import { createDecipheriv, hkdfSync } from 'node:crypto'
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

interface AesEnvelope {
  alg: 'AES-256-GCM'
  iv: string
  ciphertext: string
  tag: string
}

function isAesEnvelope(value: unknown): value is AesEnvelope {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as { alg?: string }).alg === 'AES-256-GCM'
    && typeof (value as { iv?: unknown }).iv === 'string'
    && typeof (value as { ciphertext?: unknown }).ciphertext === 'string'
    && typeof (value as { tag?: unknown }).tag === 'string',
  )
}

/**
 * Cookie storage with optional AES-256-GCM at-rest decryption.
 *
 * Loading priority (first non-empty wins):
 *   1. cookieJson env var
 *   2. cookieFile path
 *
 * The payload may be either a plain Playwright/Chrome cookie list (PoC mode)
 * or an AES envelope wrapping that list. When `encryptionSecret` is set we
 * derive a 32-byte key with HKDF-SHA256 and decrypt the envelope; the
 * resulting plaintext is parsed as a CookieFilePayload exactly the same way
 * as a plain payload.
 *
 * Production callers can also push entries through {@link setRaw} after
 * decrypting database-stored EngagementCookieVault rows (channel-db) — the
 * service does not care where the cleartext came from.
 */
@Injectable()
export class CookieVaultService implements OnModuleInit {
  private readonly logger = new Logger(CookieVaultService.name)
  private readonly store = new Map<string, Cookie[]>()
  private encryptionKey: Buffer | null = null

  constructor(
    @Inject(COOKIE_VAULT_CONFIG) private readonly config: CookieVaultModuleConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.encryptionSecret) {
      this.encryptionKey = Buffer.from(
        hkdfSync(
          'sha256',
          Buffer.from(this.config.encryptionSecret, 'utf8'),
          Buffer.alloc(0),
          Buffer.from('aitoearn:cookie-vault:v1', 'utf8'),
          32,
        ),
      )
    }
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

  /** Direct push of pre-parsed Playwright cookies (e.g. from a DB read). */
  setRaw(platform: string, accountId: string, cookies: Cookie[]): void {
    this.store.set(this.keyOf(platform, accountId), cookies)
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
        return this.maybeDecrypt(this.config.cookieJson)
      }
      catch (err) {
        this.logger.error(`CookieVault: failed to parse AUTOMATION_COOKIE_JSON: ${(err as Error).message}`)
        return null
      }
    }
    if (this.config.cookieFile) {
      try {
        const raw = await readFile(this.config.cookieFile, 'utf8')
        return this.maybeDecrypt(raw)
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

  /**
   * Parse a JSON string and, when it's wrapped in an AES envelope, decrypt it
   * with the HKDF-derived key. Refuses to read encrypted payloads when no
   * secret was configured — callers must opt-in deliberately.
   */
  private maybeDecrypt(raw: string): CookieFilePayload {
    const parsed = JSON.parse(raw) as unknown
    if (!isAesEnvelope(parsed))
      return parsed as CookieFilePayload
    if (!this.encryptionKey)
      throw new Error('encrypted cookie payload but AUTOMATION_COOKIE_SECRET is not set')
    const iv = Buffer.from(parsed.iv, 'base64')
    const ciphertext = Buffer.from(parsed.ciphertext, 'base64')
    const tag = Buffer.from(parsed.tag, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(plaintext.toString('utf8')) as CookieFilePayload
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
