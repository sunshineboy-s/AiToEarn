import { createZodDto } from '@yikart/common'
import { z } from 'zod'

const accountIdSchema = z
  .string()
  .min(1)
  .default('default')
  .describe('Vault key suffix; falls back to "default" for the PoC.')

export const likeNoteSchema = z.object({
  accountId: accountIdSchema,
  noteUrl: z.string().url().describe('Note URL, e.g. https://www.xiaohongshu.com/explore/<id>'),
})
export class LikeNoteDto extends createZodDto(likeNoteSchema) {}

export const replyToNoteSchema = z.object({
  accountId: accountIdSchema,
  noteUrl: z.string().url(),
  comment: z.string().min(1).max(500).describe('Reply text (max 500 chars).'),
})
export class ReplyToNoteDto extends createZodDto(replyToNoteSchema) {}

export const searchKeywordSchema = z.object({
  accountId: accountIdSchema,
  keyword: z.string().min(1).max(100).describe('Brand / search keyword.'),
  limit: z.number().int().min(1).max(40).default(20),
})
export class SearchKeywordDto extends createZodDto(searchKeywordSchema) {}
