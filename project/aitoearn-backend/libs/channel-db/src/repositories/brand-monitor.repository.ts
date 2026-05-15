import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { BrandMonitor, BrandMonitorStatus } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class BrandMonitorRepository extends BaseRepository<BrandMonitor> {
  constructor(
    @InjectModel(BrandMonitor.name, DB_CONNECTION_NAME)
    private readonly monitorModel: Model<BrandMonitor>,
  ) {
    super(monitorModel)
  }

  async createMonitor(data: Partial<BrandMonitor>): Promise<BrandMonitor> {
    const created = new this.monitorModel(data)
    const saved = await created.save()
    return saved.toObject()
  }

  async listForUser(userId: string): Promise<BrandMonitor[]> {
    return this.monitorModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true })
  }

  async listActive(): Promise<BrandMonitor[]> {
    return this.monitorModel
      .find({ status: BrandMonitorStatus.ACTIVE })
      .lean({ virtuals: true })
  }

  async findByIdForUser(
    monitorId: string,
    userId: string,
  ): Promise<BrandMonitor | null> {
    return this.monitorModel
      .findOne({ _id: monitorId, userId })
      .lean({ virtuals: true })
  }

  async updateMonitor(
    monitorId: string,
    update: Partial<BrandMonitor>,
  ): Promise<BrandMonitor | null> {
    return this.monitorModel
      .findByIdAndUpdate(monitorId, update, { new: true })
      .lean({ virtuals: true })
  }

  async touchScan(monitorId: string, at: Date): Promise<void> {
    await this.monitorModel.updateOne({ _id: monitorId }, { lastScanAt: at })
  }
}
