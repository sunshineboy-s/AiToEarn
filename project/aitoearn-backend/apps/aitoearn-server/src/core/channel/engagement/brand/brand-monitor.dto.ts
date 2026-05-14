import { BrandMonitorStatus } from '@yikart/channel-db'
import { createZodDto } from '@yikart/common'
import { z } from 'zod'

const NotificationChannelsSchema = z.object({
  email: z.array(z.string().email()).optional(),
  webhook: z.string().url().optional(),
  inApp: z.boolean().optional().default(true),
})

export const CreateBrandMonitorSchema = z.object({
  name: z.string().min(1).max(120),
  brandKeywords: z.array(z.string().min(1)).min(1).max(20),
  excludeKeywords: z.array(z.string()).optional().default([]),
  platforms: z.array(z.string()).min(1),
  languages: z.array(z.string()).optional().default([]),
  /** seconds */
  scanInterval: z.number().int().min(300).max(86_400).default(1800),
  notificationChannels: NotificationChannelsSchema.optional(),
})
export class CreateBrandMonitorRequest extends createZodDto(CreateBrandMonitorSchema) {}

export const UpdateBrandMonitorSchema = CreateBrandMonitorSchema.partial().extend({
  status: z.nativeEnum(BrandMonitorStatus).optional(),
})
export class UpdateBrandMonitorRequest extends createZodDto(UpdateBrandMonitorSchema) {}

export const ListMentionsSchema = z.object({
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})
export class ListMentionsRequest extends createZodDto(ListMentionsSchema) {}
