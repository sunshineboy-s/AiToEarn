/* eslint-disable ts/no-require-imports */
import { chromium as baseChromium } from 'playwright'

/**
 * Wires `playwright-extra` + `puppeteer-extra-plugin-stealth` on top of the
 * upstream Playwright Chromium binding. Falls back gracefully if the optional
 * deps are not installed (e.g. lint-only contexts) so the file still type-checks.
 *
 * MIT-licensed dependencies — see LICENSE-NOTICES.md.
 */
export function getStealthChromium(): typeof baseChromium {
  try {
    const { chromium } = require('playwright-extra') as typeof import('playwright-extra')
    const stealth = require('puppeteer-extra-plugin-stealth') as () => unknown
    chromium.use(stealth() as never)
    return chromium as unknown as typeof baseChromium
  }
  catch {
    return baseChromium
  }
}
