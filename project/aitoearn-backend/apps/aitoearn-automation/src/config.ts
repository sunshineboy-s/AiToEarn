import { aitoearnAuthConfigSchema } from '@yikart/aitoearn-auth'
import { queueConfigSchema } from '@yikart/aitoearn-queue'
import { baseConfig, createZodDto, selectConfig } from '@yikart/common'
import z from 'zod'

export const browserConfigSchema = z.object({
  headless: z.boolean().default(true),
  poolSize: z.number().int().positive().default(3),
  userAgent: z.string().default(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ),
  proxy: z.string().optional(),
  minDelayMs: z.number().int().min(0).default(800),
  maxDelayMs: z.number().int().min(0).default(2400),
})

export const cookieVaultConfigSchema = z.object({
  cookieFile: z.string().default(''),
  cookieJson: z.string().default(''),
})

export const appConfigSchema = z.object({
  ...baseConfig.shape,
  environment: z.enum(['development', 'production']).default('development'),
  auth: aitoearnAuthConfigSchema,
  browser: browserConfigSchema,
  cookieVault: cookieVaultConfigSchema,
  /**
   * Optional: when present, enables the BullMQ consumer that picks up
   * `engagement_automation_action` jobs published by aitoearn-server. When
   * omitted the worker only exposes the HTTP API surface (PoC mode).
   */
  queue: queueConfigSchema.optional(),
})

export class AppConfig extends createZodDto(appConfigSchema) {}

export const config = selectConfig(AppConfig)

