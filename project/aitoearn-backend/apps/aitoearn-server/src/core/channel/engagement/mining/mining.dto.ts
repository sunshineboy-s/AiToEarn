import { EngagementMiningIntent, EngagementMiningStatus } from '@yikart/channel-db'
import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const ListMiningHitsSchema = z.object({
  accountId: z.string().optional(),
  intent: z.nativeEnum(EngagementMiningIntent).optional(),
  status: z.nativeEnum(EngagementMiningStatus).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
})
export class ListMiningHitsRequest extends createZodDto(ListMiningHitsSchema) {}

export const MarkMiningHitSchema = z.object({
  hitId: z.string().min(1),
  status: z.nativeEnum(EngagementMiningStatus),
})
export class MarkMiningHitRequest extends createZodDto(MarkMiningHitSchema) {}

export const ClassifyCommentsSchema = z.object({
  accountId: z.string(),
  platform: z.string(),
  postId: z.string(),
  model: z.string().optional(),
  comments: z.array(
    z.object({
      id: z.string(),
      content: z.string().min(1),
      authorId: z.string().optional(),
      authorName: z.string().optional(),
    }),
  ).min(1).max(50),
})
export class ClassifyCommentsRequest extends createZodDto(ClassifyCommentsSchema) {}
