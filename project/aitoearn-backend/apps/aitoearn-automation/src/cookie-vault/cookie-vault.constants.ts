export const COOKIE_VAULT_CONFIG = Symbol('COOKIE_VAULT_CONFIG')

export interface CookieVaultModuleConfig {
  /** Path to a JSON file containing cookies. */
  cookieFile: string
  /** Inline JSON string (alternative to cookieFile). */
  cookieJson: string
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
