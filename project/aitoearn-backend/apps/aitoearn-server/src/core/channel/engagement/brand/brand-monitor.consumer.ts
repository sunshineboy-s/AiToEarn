import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { BrandMonitorScanData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import { BrandMonitorRepository } from '@yikart/channel-db'
import { Job } from 'bullmq'
import { SearchPost } from '../engagement.interface'
import { EngagementService } from '../engagement.service'
import { BrandMonitorService } from './brand-monitor.service'

@QueueProcessor(QueueName.BrandMonitorScan, {
  concurrency: 2,
  stalledInterval: 60_000,
  maxStalledCount: 1,
})
export class BrandMonitorScanConsumer extends WorkerHost {
  private readonly logger = new Logger(BrandMonitorScanConsumer.name)

  constructor(
    private readonly monitorRepo: BrandMonitorRepository,
    private readonly engagementService: EngagementService,
    private readonly brandMonitorService: BrandMonitorService,
  ) {
    super()
  }

  async process(job: Job<BrandMonitorScanData>): Promise<{ created: number, total: number }> {
    const monitor = await this.monitorRepo.getById(job.data.monitorId)
    if (!monitor) {
      this.logger.warn(`Monitor ${job.data.monitorId} not found`)
      return { created: 0, total: 0 }
    }
    const collected: SearchPost[] = []
    for (const platform of monitor.platforms) {
      const provider = this.engagementService.getProviderUnsafe(platform)
      if (!provider || !provider.searchPosts) {
        this.logger.debug(`Provider ${platform} has no searchPosts; skipping`)
        continue
      }
      for (const keyword of monitor.brandKeywords) {
        try {
          // We don't know which account to use — search APIs typically need
          // an authenticated account; for now use the first account stored
          // for the user on this platform via a lookup hook on the service.
          const accountId = await this.engagementService.resolveDefaultAccount(monitor.userId, platform)
          if (!accountId)
            continue
          const resp = await provider.searchPosts(accountId, { keyword, limit: 25 })
          for (const item of resp.items)
            collected.push({ ...item, platform })
        }
        catch (err) {
          this.logger.warn(`searchPosts(${platform}, ${keyword}) failed: ${(err as Error).message}`)
        }
      }
    }
    void collected
    const result = await this.brandMonitorService.ingestScanResults(
      monitor,
      collected.map(item => ({
        platform: item.platform,
        postId: item.id,
        postUrl: item.url,
        authorId: item.authorId,
        authorName: item.authorName,
        content: item.content,
        mediaUrls: item.mediaUrls,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
      })),
    )
    this.logger.log(`monitor ${monitor.id}: persisted ${result.created}/${result.total}`)
    return result
  }
}
