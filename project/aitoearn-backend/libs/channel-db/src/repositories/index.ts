import { BrandMentionRepository } from './brand-mention.repository'
import { BrandMonitorRepository } from './brand-monitor.repository'
import { EngagementCookieVaultRepository } from './engagement-cookie-vault.repository'
import { EngagementMiningHitRepository } from './engagement-mining-hit.repository'
import { EngagementSubTaskRepository } from './engagement-sub-task.repository'
import { EngagementTaskRepository } from './engagement-task.repository'
import { InteractionRecordRepository } from './interaction-record.repository'
import { OAuth2CredentialRepository } from './oauth2-credential.repository'
import { PostMediaContainerRepository } from './post-media-container.repository'
import { ReplyCommentRecordRepository } from './reply-comment-record.repository'

export * from './base.repository'
export * from './brand-mention.repository'
export * from './brand-monitor.repository'
export * from './engagement-cookie-vault.repository'
export * from './engagement-mining-hit.repository'
export * from './engagement-sub-task.repository'
export * from './engagement-task.repository'
export * from './interaction-record.repository'
export * from './oauth2-credential.repository'
export * from './post-media-container.repository'
export * from './reply-comment-record.repository'

export const repositories = [
  PostMediaContainerRepository,
  EngagementTaskRepository,
  EngagementSubTaskRepository,
  EngagementMiningHitRepository,
  BrandMonitorRepository,
  BrandMentionRepository,
  EngagementCookieVaultRepository,
  InteractionRecordRepository,
  ReplyCommentRecordRepository,
  OAuth2CredentialRepository,
] as const
