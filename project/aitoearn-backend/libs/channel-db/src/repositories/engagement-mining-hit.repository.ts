import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import {
  EngagementMiningHit,
  EngagementMiningIntent,
  EngagementMiningStatus,
} from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class EngagementMiningHitRepository extends BaseRepository<EngagementMiningHit> {
  constructor(
    @InjectModel(EngagementMiningHit.name, DB_CONNECTION_NAME)
    private readonly hitModel: Model<EngagementMiningHit>,
  ) {
    super(hitModel)
  }

  /**
   * Idempotent upsert keyed on (accountId, postId, commentId). The same comment
   * can be re-classified later if `recommendedReply` was empty before; we keep
   * the highest-confidence verdict.
   */
  async upsertHit(
    data: Partial<EngagementMiningHit>,
  ): Promise<EngagementMiningHit | null> {
    const { accountId, postId, commentId } = data
    if (!accountId || !postId || !commentId) {
      throw new Error('upsertHit requires accountId, postId, commentId')
    }
    return this.hitModel
      .findOneAndUpdate(
        { accountId, postId, commentId },
        { $set: data },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean({ virtuals: true })
  }

  async listForUser(params: {
    userId: string
    accountId?: string
    intent?: EngagementMiningIntent
    status?: EngagementMiningStatus
    limit?: number
    cursor?: string
  }): Promise<EngagementMiningHit[]> {
    const { userId, accountId, intent, status, limit = 50, cursor } = params
    const filter: Record<string, unknown> = { userId }
    if (accountId)
      filter['accountId'] = accountId
    if (intent)
      filter['intent'] = intent
    if (status)
      filter['status'] = status
    if (cursor)
      filter['_id'] = { $lt: cursor }
    return this.hitModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .lean({ virtuals: true })
  }

  async markStatus(
    hitId: string,
    status: EngagementMiningStatus,
  ): Promise<EngagementMiningHit | null> {
    return this.hitModel
      .findByIdAndUpdate(hitId, { status }, { new: true })
      .lean({ virtuals: true })
  }
}
