import { Account, AccountSchema } from './account.schema'
import { BrandMention, BrandMentionSchema } from './brand-mention.schema'
import { BrandMonitor, BrandMonitorSchema } from './brand-monitor.schema'
import { EngagementCookieVault, EngagementCookieVaultSchema } from './engagement-cookie-vault.schema'
import { EngagementMiningHit, EngagementMiningHitSchema } from './engagement-mining-hit.schema'
import { EngagementSubTask, EngagementSubTaskSchema, EngagementTask, EngagementTaskSchema } from './engagement-task.schema'
import { InteractionRecord, InteractionRecordSchema } from './interaction-record.schema'
import { OAuth2Credential, OAuth2CredentialSchema } from './oauth2-credential.schema'
import { PostMediaContainer, PostMediaContainerSchema } from './post-media-container.schema'
import { ReplyCommentRecord, ReplyCommentRecordSchema } from './reply-comment-record.schema'

export * from './account.schema'
export * from './brand-mention.schema'
export * from './brand-monitor.schema'
export * from './engagement-cookie-vault.schema'
export * from './engagement-mining-hit.schema'
export * from './engagement-task.schema'
export * from './interaction-record.schema'
export * from './oauth2-credential.schema'
export * from './post-media-container.schema'
export * from './reply-comment-record.schema'

export const schemas = [
  { name: Account.name, schema: AccountSchema },
  { name: EngagementTask.name, schema: EngagementTaskSchema },
  { name: EngagementSubTask.name, schema: EngagementSubTaskSchema },
  { name: EngagementMiningHit.name, schema: EngagementMiningHitSchema },
  { name: BrandMonitor.name, schema: BrandMonitorSchema },
  { name: BrandMention.name, schema: BrandMentionSchema },
  { name: EngagementCookieVault.name, schema: EngagementCookieVaultSchema },
  { name: InteractionRecord.name, schema: InteractionRecordSchema },
  { name: OAuth2Credential.name, schema: OAuth2CredentialSchema },
  { name: PostMediaContainer.name, schema: PostMediaContainerSchema },
  { name: ReplyCommentRecord.name, schema: ReplyCommentRecordSchema },
] as const
