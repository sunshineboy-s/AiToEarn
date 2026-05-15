import { createHash } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { QueueService } from '@yikart/aitoearn-queue'
import {
  BrandMention,
  BrandMentionRepository,
  BrandMentionUrgency,
  BrandMonitor,
  BrandMonitorRepository,
  BrandMonitorStatus,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import {
  CreateBrandMonitorRequest,
  ListMentionsRequest,
  UpdateBrandMonitorRequest,
} from './brand-monitor.dto'

const HIGH_URGENCY_KEYWORDS = [
  'refund', 'scam', 'broken', 'lawsuit', 'never buying',
  '\u9000\u8d27', '\u9000\u6b3e', '\u5dee\u8bc4', '\u73a9\u4e0d\u4e86', '\u62a5\u8b66',
]

interface IngestedMention {
  platform: string
  postId: string
  postUrl?: string
  authorId?: string
  authorName?: string
  content: string
  mediaUrls?: string[]
  publishedAt?: Date
  /** Pre-computed sentiment in [-1, 1]. Optional — falls back to 0. */
  sentiment?: number
  /** Pre-computed match keywords. Falls back to keyword detection. */
  matchedKeywords?: string[]
}

/**
 * CRUD + scan ingestion for brand monitors.
 *
 * Repeatable BullMQ jobs run on `scanInterval` (default 30min). The actual
 * cross-platform crawl lives in {@link BrandMonitorScanConsumer} which calls
 * each provider's optional `searchPosts`. This service is the API boundary
 * plus the dedup / urgency / notification fan-out.
 */
@Injectable()
export class BrandMonitorService {
  private readonly logger = new Logger(BrandMonitorService.name)

  constructor(
    private readonly monitorRepo: BrandMonitorRepository,
    private readonly mentionRepo: BrandMentionRepository,
    private readonly queueService: QueueService,
  ) {}

  async createMonitor(userId: string, data: CreateBrandMonitorRequest): Promise<BrandMonitor> {
    const monitor = await this.monitorRepo.createMonitor({
      userId,
      name: data.name,
      brandKeywords: data.brandKeywords,
      excludeKeywords: data.excludeKeywords ?? [],
      platforms: data.platforms,
      languages: data.languages ?? [],
      scanInterval: data.scanInterval,
      notificationChannels: data.notificationChannels ?? { inApp: true },
      status: BrandMonitorStatus.ACTIVE,
    })
    await this.scheduleRepeat(monitor)
    return monitor
  }

  async listForUser(userId: string): Promise<BrandMonitor[]> {
    return this.monitorRepo.listForUser(userId)
  }

  async getForUser(userId: string, monitorId: string): Promise<BrandMonitor> {
    const monitor = await this.monitorRepo.findByIdForUser(monitorId, userId)
    if (!monitor)
      throw new AppException(ResponseCode.BrandMonitorNotFound)
    return monitor
  }

  async updateMonitor(
    userId: string,
    monitorId: string,
    data: UpdateBrandMonitorRequest,
  ): Promise<BrandMonitor> {
    const monitor = await this.getForUser(userId, monitorId)
    const updated = await this.monitorRepo.updateMonitor(monitorId, data)
    if (!updated)
      throw new AppException(ResponseCode.BrandMonitorNotFound)
    if (updated.status !== monitor.status || updated.scanInterval !== monitor.scanInterval) {
      await this.removeRepeat(monitor)
      if (updated.status === BrandMonitorStatus.ACTIVE)
        await this.scheduleRepeat(updated)
    }
    return updated
  }

  async deleteMonitor(userId: string, monitorId: string): Promise<void> {
    const monitor = await this.getForUser(userId, monitorId)
    await this.monitorRepo.deleteById(monitorId)
    await this.removeRepeat(monitor)
  }

  async triggerScan(userId: string, monitorId: string): Promise<{ queued: true }> {
    const monitor = await this.getForUser(userId, monitorId)
    await this.queueService.addBrandMonitorScanJob({ monitorId: monitor.id, reason: 'manual' })
    return { queued: true }
  }

  async listMentions(
    userId: string,
    monitorId: string,
    query: ListMentionsRequest,
  ): Promise<BrandMention[]> {
    await this.getForUser(userId, monitorId)
    return this.mentionRepo.listByMonitor({
      monitorId,
      urgency: query.urgency as BrandMentionUrgency | undefined,
      limit: query.limit,
      cursor: query.cursor,
    })
  }

  /**
   * Persist mentions, deduping on (platform + postId). For new rows, decide
   * urgency and (when configured) fan out a notification job.
   *
   * Returns the count of newly-persisted mentions so the caller can log and
   * surface the value through `lastScanAt` metadata.
   */
  async ingestScanResults(
    monitor: BrandMonitor,
    items: IngestedMention[],
  ): Promise<{ created: number, total: number }> {
    let created = 0
    for (const item of items) {
      const matchedKeywords = item.matchedKeywords ?? this.matchKeywords(item.content, monitor)
      if (matchedKeywords.length === 0)
        continue
      const sentiment = clamp(item.sentiment ?? 0, -1, 1)
      const urgency = this.computeUrgency(item.content, sentiment)
      const uniqHash = createHash('sha256')
        .update(`${item.platform}:${item.postId}`)
        .digest('hex')

      const result = await this.mentionRepo.upsertOnceByHash({
        monitorId: monitor.id,
        userId: monitor.userId,
        platform: item.platform,
        postId: item.postId,
        postUrl: item.postUrl ?? '',
        authorId: item.authorId ?? '',
        authorName: item.authorName ?? '',
        content: item.content,
        mediaUrls: item.mediaUrls ?? [],
        publishedAt: item.publishedAt,
        matchedKeywords,
        sentiment,
        urgency,
        uniqHash,
        notified: false,
      })
      if (!result.isNew || !result.mention)
        continue
      created += 1
      if (urgency === BrandMentionUrgency.HIGH && monitor.notificationChannels?.inApp !== false) {
        // TODO(brand-monitor): the QueueService.NotificationData union does not
        // model brand_mention yet — wire this through the notification module
        // in a follow-up PR. For now we mark the row notified and log so the
        // operator can build a webhook off the mention API instead.
        this.logger.warn(
          `[brand-monitor] HIGH urgency mention captured for monitor=${monitor.id} platform=${item.platform} postId=${item.postId}`,
        )
        await this.mentionRepo.markNotified(result.mention.id)
      }
    }
    await this.monitorRepo.touchScan(monitor.id, new Date())
    return { created, total: items.length }
  }

  // ---------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------

  private matchKeywords(content: string, monitor: BrandMonitor): string[] {
    const lower = content.toLowerCase()
    const excluded = (monitor.excludeKeywords ?? []).some(k => lower.includes(k.toLowerCase()))
    if (excluded)
      return []
    return monitor.brandKeywords.filter(k => lower.includes(k.toLowerCase()))
  }

  private computeUrgency(content: string, sentiment: number): BrandMentionUrgency {
    const lower = content.toLowerCase()
    const hasComplaintWord = HIGH_URGENCY_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
    if (hasComplaintWord && sentiment <= -0.2)
      return BrandMentionUrgency.HIGH
    if (sentiment <= -0.5)
      return BrandMentionUrgency.HIGH
    if (sentiment <= -0.1 || hasComplaintWord)
      return BrandMentionUrgency.MEDIUM
    return BrandMentionUrgency.LOW
  }

  private async scheduleRepeat(monitor: BrandMonitor): Promise<void> {
    if (monitor.status !== BrandMonitorStatus.ACTIVE)
      return
    await this.queueService.addBrandMonitorScanRepeatable(
      { monitorId: monitor.id, reason: 'schedule' },
      Math.max(60, monitor.scanInterval) * 1000,
    )
  }

  private async removeRepeat(monitor: BrandMonitor): Promise<void> {
    try {
      await this.queueService.removeBrandMonitorScanRepeatable(monitor.id, monitor.scanInterval * 1000)
    }
    catch (err) {
      this.logger.warn(`Failed to remove repeat job for monitor ${monitor.id}: ${(err as Error).message}`)
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value))
    return 0
  return Math.max(min, Math.min(max, value))
}
