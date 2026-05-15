import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { CookieVaultStatus, EngagementCookieVault } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class EngagementCookieVaultRepository extends BaseRepository<EngagementCookieVault> {
  constructor(
    @InjectModel(EngagementCookieVault.name, DB_CONNECTION_NAME)
    private readonly vaultModel: Model<EngagementCookieVault>,
  ) {
    super(vaultModel)
  }

  async upsertByAccount(
    data: Partial<EngagementCookieVault>,
  ): Promise<EngagementCookieVault | null> {
    if (!data.accountId || !data.platform)
      throw new Error('upsertByAccount requires accountId and platform')
    return this.vaultModel
      .findOneAndUpdate(
        { accountId: data.accountId, platform: data.platform },
        { $set: data },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean({ virtuals: true })
  }

  async findByAccount(
    accountId: string,
    platform: string,
  ): Promise<EngagementCookieVault | null> {
    return this.vaultModel
      .findOne({ accountId, platform })
      .lean({ virtuals: true })
  }

  async markStatus(
    accountId: string,
    platform: string,
    status: CookieVaultStatus,
  ): Promise<void> {
    await this.vaultModel.updateOne({ accountId, platform }, { status })
  }

  async incrementFailureCount(
    accountId: string,
    platform: string,
  ): Promise<EngagementCookieVault | null> {
    return this.vaultModel
      .findOneAndUpdate(
        { accountId, platform },
        { $inc: { failureCount: 1 } },
        { new: true },
      )
      .lean({ virtuals: true })
  }
}
