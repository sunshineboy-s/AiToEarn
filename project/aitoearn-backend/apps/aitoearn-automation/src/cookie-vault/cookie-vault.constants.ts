export const COOKIE_VAULT_CONFIG = Symbol('COOKIE_VAULT_CONFIG')

export interface CookieVaultModuleConfig {
  /** Path to a JSON file containing cookies. */
  cookieFile: string
  /** Inline JSON string (alternative to cookieFile). */
  cookieJson: string
  /**
   * Optional encryption secret. When non-empty:
   * - reads decrypt entries with envelope `{ alg:'AES-256-GCM', iv, ciphertext, tag }`
   * - the same key is used to decrypt entries served from a future production
   *   path (the channel-db EngagementCookieVault).
   *
   * The secret is HKDF-derived to a 32-byte AES key at boot, so callers can
   * supply any non-empty string. In production this should come from KMS or
   * a sealed secret store (do NOT commit).
   */
  encryptionSecret?: string
}

/**
 * The shape we accept on disk / env. Compatible with the export format used by
 * many Chrome cookie-export extensions, plus Playwright's storageState format.
 */
export interface RawCookieEntry {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  expirationDate?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'no_restriction' | 'lax' | 'strict' | 'none' | 'unspecified'
}

export type CookieFilePayload =
  | RawCookieEntry[]
  | { cookies: RawCookieEntry[] } // Playwright storageState
  | Record<string, RawCookieEntry[]> // keyed-by-account map
