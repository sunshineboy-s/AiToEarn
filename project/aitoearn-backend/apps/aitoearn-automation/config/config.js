/* eslint-disable */
const {
  NODE_ENV,
  AUTOMATION_PORT,
  AUTOMATION_INTERNAL_TOKEN,

  // Browser
  AUTOMATION_HEADLESS,
  AUTOMATION_PROXY,
  AUTOMATION_USER_AGENT,
  AUTOMATION_BROWSER_POOL_SIZE,

  // Cookie source: file path or raw JSON string
  AUTOMATION_COOKIE_FILE,
  AUTOMATION_COOKIE_JSON,

  // Pacing / rate
  AUTOMATION_MIN_DELAY_MS,
  AUTOMATION_MAX_DELAY_MS,
} = process.env

module.exports = {
  port: Number(AUTOMATION_PORT) || 3010,
  environment: NODE_ENV,
  enableBadRequestDetails: true,
  globalPrefix: 'api',

  openapi: {
    enable: true,
    title: 'AiToEarn Automation',
    description: 'Server-side browser automation engine for the Engage Agent (no browser plugin required).',
    path: '/docs',
  },

  logger: {
    console: {
      enable: true,
      level: 'debug',
      pretty: true,
    },
  },

  auth: {
    // Reuses the same JWT/internal-token mechanism as aitoearn-server.
    // The PoC accepts an internal token shared with the calling server.
    secret: AUTOMATION_INTERNAL_TOKEN || 'automation-poc-internal-token',
    internalToken: AUTOMATION_INTERNAL_TOKEN || 'automation-poc-internal-token',
  },

  browser: {
    headless: AUTOMATION_HEADLESS !== 'false',
    poolSize: Number(AUTOMATION_BROWSER_POOL_SIZE) || 3,
    userAgent: AUTOMATION_USER_AGENT
      || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: AUTOMATION_PROXY || undefined,
    minDelayMs: Number(AUTOMATION_MIN_DELAY_MS) || 800,
    maxDelayMs: Number(AUTOMATION_MAX_DELAY_MS) || 2400,
  },

  cookieVault: {
    // PoC: cookieFile / cookieJson load plaintext at boot. When
    // AUTOMATION_COOKIE_SECRET is set, entries that look like AES-256-GCM
    // envelopes ({ alg, iv, ciphertext, tag }) are decrypted on read.
    cookieFile: AUTOMATION_COOKIE_FILE || '',
    cookieJson: AUTOMATION_COOKIE_JSON || '',
    encryptionSecret: process.env.AUTOMATION_COOKIE_SECRET || '',
  },

  // BullMQ queue (optional — enable when piping jobs from aitoearn-server)
  queue: process.env.REDIS_HOST
    ? {
        redis: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT) || 6379,
          username: process.env.REDIS_USERNAME || 'default',
          password: process.env.REDIS_PASSWORD,
        },
        prefix: process.env.AUTOMATION_BULL_PREFIX || '{bull}',
      }
    : undefined,
}
