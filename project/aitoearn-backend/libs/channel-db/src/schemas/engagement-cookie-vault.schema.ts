import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum CookieVaultStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  RISK = 'RISK',
}

/**
 * Encrypted cookie vault entry used by the automation engine.
 *
 * The PoC `aitoearn-automation` reads cookies from a file/env. This collection
 * is the production path: `aitoearn-server` writes the encrypted blob, the
 * automation worker reads it via internal RPC. Key derivation is centralised in
 * `EngagementCookieVaultService` (Phase 3A); the schema only stores the
 * already-encrypted payload + metadata.
 */
@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'engagementCookieVault' })
export class EngagementCookieVault extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  userId: string

  @Prop({ required: true, index: true })
  accountId: string

  @Prop({ required: true })
  platform: string

  /** AES-256-GCM ciphertext, base64 encoded. */
  @Prop({ required: true })
  encryptedCookie: string

  /** AES-256-GCM IV, base64 encoded. */
  @Prop({ required: true })
  iv: string

  /** AES-256-GCM auth tag, base64 encoded. */
  @Prop({ required: true })
  authTag: string

  @Prop({ required: false, default: '' })
  fingerprint: string

  @Prop({ required: false, default: '' })
  proxyRef: string

  @Prop({ required: true, enum: CookieVaultStatus, default: CookieVaultStatus.VALID })
  status: CookieVaultStatus

  @Prop({ required: false, type: Date })
  lastValidAt?: Date

  @Prop({ required: true, default: 0 })
  failureCount: number
}

export const EngagementCookieVaultSchema = SchemaFactory.createForClass(EngagementCookieVault)
EngagementCookieVaultSchema.index({ accountId: 1, platform: 1 }, { unique: true })
