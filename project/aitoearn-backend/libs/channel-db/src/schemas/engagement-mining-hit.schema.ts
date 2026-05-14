import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum EngagementMiningIntent {
  PURCHASE_INTENT = 'PURCHASE_INTENT', // ready-to-buy signals
  LINK_REQUEST = 'LINK_REQUEST', // "drop the link?", "link please"
  PRICE_QUESTION = 'PRICE_QUESTION', // "how much?"
  COMPLAINT = 'COMPLAINT', // unhappy / refund
  QUESTION = 'QUESTION', // generic question
  PRAISE = 'PRAISE', // positive without intent
  SPAM = 'SPAM',
  OTHER = 'OTHER',
}

export enum EngagementMiningStatus {
  NEW = 'NEW',
  HANDLED = 'HANDLED',
  IGNORED = 'IGNORED',
}

export enum EngagementMiningSource {
  RULES = 'RULES',
  LLM = 'LLM',
  HYBRID = 'HYBRID',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'engagementMiningHit' })
export class EngagementMiningHit extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  userId: string

  @Prop({ required: true, index: true })
  accountId: string

  @Prop({ required: true })
  platform: string

  @Prop({ required: true, index: true })
  postId: string

  @Prop({ required: true, index: true })
  commentId: string

  @Prop({ required: true })
  commentContent: string

  @Prop({ required: false, default: '' })
  authorId: string

  @Prop({ required: false, default: '' })
  authorName: string

  @Prop({ required: true, enum: EngagementMiningIntent, default: EngagementMiningIntent.OTHER })
  intent: EngagementMiningIntent

  @Prop({ required: true, default: 0 })
  confidence: number

  @Prop({ required: false, default: 0 })
  sentiment: number

  @Prop({ required: false, default: 'unknown' })
  language: string

  @Prop({ required: false, default: '' })
  recommendedReply: string

  @Prop({ required: true, enum: EngagementMiningSource, default: EngagementMiningSource.RULES })
  source: EngagementMiningSource

  @Prop({ required: true, enum: EngagementMiningStatus, default: EngagementMiningStatus.NEW })
  status: EngagementMiningStatus

  @Prop({ required: false, type: [String], default: [] })
  matchedKeywords: string[]
}

export const EngagementMiningHitSchema = SchemaFactory.createForClass(EngagementMiningHit)
EngagementMiningHitSchema.index({ userId: 1, status: 1, createdAt: -1 })
EngagementMiningHitSchema.index({ accountId: 1, postId: 1, commentId: 1 }, { unique: true })
