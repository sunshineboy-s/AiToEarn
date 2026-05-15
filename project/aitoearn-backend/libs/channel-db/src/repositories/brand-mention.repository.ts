import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { BrandMention, BrandMentionUrgency } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class BrandMentionRepository extends BaseRepository<BrandMention> {
  constructor(
    @InjectModel(BrandMention.name, DB_CONNECTION_NAME)
    private readonly mentionModel: Model<BrandMention>,
  ) {
    super(mentionModel)
  }

  /**
   * Returns true when this mention is new (was upserted), false when the
   * uniqHash already existed. Callers use this to decide whether to fire a
   * notification.
   */
  async upsertOnceByHash(data: Partial<BrandMention>): Promise<{
    mention: BrandMention | null
    isNew: boolean
  }> {
    if (!data.uniqHash)
      throw new Error('upsertOnceByHash requires uniqHash')
    const result = await this.mentionModel.findOneAndUpdate(
      { uniqHash: data.uniqHash },
      { $setOnInsert: data },
      { new: true, upsert: true, setDefaultsOnInsert: true, includeResultMetadata: true },
    )
    const mention = (result?.value ?? null) as BrandMention | null
    const isNew = Boolean(result?.lastErrorObject?.['updatedExisting']) === false
    return { mention, isNew }
  }

  async markNotified(mentionId: string): Promise<void> {
    await this.mentionModel.updateOne({ _id: mentionId }, { notified: true })
  }

  async listByMonitor(params: {
    monitorId: string
    urgency?: BrandMentionUrgency
    limit?: number
    cursor?: string
  }): Promise<BrandMention[]> {
    const { monitorId, urgency, limit = 50, cursor } = params
    const filter: Record<string, unknown> = { monitorId }
    if (urgency)
      filter['urgency'] = urgency
    if (cursor)
      filter['_id'] = { $lt: cursor }
    return this.mentionModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .lean({ virtuals: true })
  }
}
