import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum BrandMentionUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'brandMention' })
export class BrandMention extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  monitorId: string

  @Prop({ required: true, index: true })
  userId: string

  @Prop({ required: true })
  platform: string

  @Prop({ required: true })
  postId: string

  @Prop({ required: false, default: '' })
  postUrl: string

  @Prop({ required: false, default: '' })
  authorId: string

  @Prop({ required: false, default: '' })
  authorName: string

  @Prop({ required: true })
  content: string

  @Prop({ required: false, type: [String], default: [] })
  mediaUrls: string[]

  @Prop({ required: false, type: Date })
  publishedAt?: Date

  @Prop({ required: false, type: [String], default: [] })
  matchedKeywords: string[]

  /** -1 (very negative) ... +1 (very positive). 0 = neutral / unknown. */
  @Prop({ required: true, default: 0 })
  sentiment: number

  @Prop({ required: true, enum: BrandMentionUrgency, default: BrandMentionUrgency.LOW })
  urgency: BrandMentionUrgency

  /**
   * Stable hash of (platform + postId). Stored as the dedup key so a follow-up
   * scan can no-op without doing an extra round-trip.
   */
  @Prop({ required: true, unique: true })
  uniqHash: string

  @Prop({ required: true, default: false })
  notified: boolean
}

export const BrandMentionSchema = SchemaFactory.createForClass(BrandMention)
BrandMentionSchema.index({ monitorId: 1, createdAt: -1 })
BrandMentionSchema.index({ userId: 1, urgency: 1, createdAt: -1 })
