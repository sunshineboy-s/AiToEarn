import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum BrandMonitorStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
}

export interface BrandMonitorNotificationChannels {
  email?: string[]
  webhook?: string
  inApp?: boolean
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'brandMonitor' })
export class BrandMonitor extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  userId: string

  @Prop({ required: true })
  name: string

  @Prop({ required: true, type: [String] })
  brandKeywords: string[]

  @Prop({ required: false, type: [String], default: [] })
  excludeKeywords: string[]

  @Prop({ required: true, type: [String] })
  platforms: string[]

  @Prop({ required: false, type: [String], default: [] })
  languages: string[]

  /** Scan interval in seconds. Default: 30 minutes. */
  @Prop({ required: true, default: 1800 })
  scanInterval: number

  @Prop({ required: false, type: Object, default: () => ({ inApp: true }) })
  notificationChannels: BrandMonitorNotificationChannels

  @Prop({ required: true, enum: BrandMonitorStatus, default: BrandMonitorStatus.ACTIVE })
  status: BrandMonitorStatus

  @Prop({ required: false, type: Date })
  lastScanAt?: Date
}

export const BrandMonitorSchema = SchemaFactory.createForClass(BrandMonitor)
BrandMonitorSchema.index({ userId: 1, status: 1 })
