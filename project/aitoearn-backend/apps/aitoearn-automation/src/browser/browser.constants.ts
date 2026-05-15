export const BROWSER_CONFIG = Symbol('BROWSER_CONFIG')

export interface BrowserModuleConfig {
  headless: boolean
  poolSize: number
  userAgent: string
  proxy?: string
  minDelayMs: number
  maxDelayMs: number
}
