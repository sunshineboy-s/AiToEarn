import type { Job, JobsOptions, Queue } from 'bullmq'
import type {
  AiImageData,
  BrandMonitorScanData,
  CreditsPurchaseData,
  CreditsRefundData,
  DraftGenerationData,
  EngagementAutomationActionData,
  EngagementMiningJobData,
  EngagementReplyToCommentData,
  EngagementTaskDistributionData,
  NotificationData,
  PostMediaTaskData,
  PostPublishData,
} from './interfaces'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { QueueName } from './enums'
import { QueueConfig } from './queue.config'

/**
 * 统一的队列服务
 * 提供所有队列的操作方法
 */
@Injectable()
export class QueueService {
  private readonly defaultOptions: JobsOptions

  constructor(
    private config: QueueConfig,
    @InjectQueue(QueueName.PostPublish)
    private postPublishQueue: Queue,
    @InjectQueue(QueueName.PostMediaTask)
    private postMediaTaskQueue: Queue,
    @InjectQueue(QueueName.AiImageAsync)
    private aiImageAsyncQueue: Queue,
    @InjectQueue(QueueName.EngagementTaskDistribution)
    private engagementTaskDistributionQueue: Queue,
    @InjectQueue(QueueName.EngagementReplyToComment)
    private engagementReplyToCommentQueue: Queue,
    @InjectQueue(QueueName.EngagementMining)
    private engagementMiningQueue: Queue,
    @InjectQueue(QueueName.EngagementAutomationAction)
    private engagementAutomationActionQueue: Queue,
    @InjectQueue(QueueName.BrandMonitorScan)
    private brandMonitorScanQueue: Queue,
    @InjectQueue(QueueName.DumpSocialMediaAvatar)
    private dumpSocialMediaAvatarQueue: Queue,
    @InjectQueue(QueueName.UpdatePublishedPost)
    private updatePublishedPostQueue: Queue,
    @InjectQueue(QueueName.CreditsPurchase)
    private creditsPurchaseQueue: Queue,
    @InjectQueue(QueueName.CreditsRefund)
    private creditsRefundQueue: Queue,
    @InjectQueue(QueueName.Notification)
    private notificationQueue: Queue,
    @InjectQueue(QueueName.DraftGeneration)
    private draftGenerationQueue: Queue,
  ) {
    this.defaultOptions = config.jobOptions || {
      removeOnComplete: { age: 30, count: 1000 },
      removeOnFail: { age: 60, count: 1000 },
      timeout: 5 * 60000,
    }
  }

  async addPostPublishJob(data: PostPublishData, options?: JobsOptions) {
    return await this.postPublishQueue.add('publish', data, {
      ...this.defaultOptions,
      jobId: data.jobId,
      ...options,
    })
  }

  async getPostPublishJob(jobId: string): Promise<Job<PostPublishData> | undefined> {
    return await this.postPublishQueue.getJob(jobId)
  }

  async addPostMediaTaskJob(data: PostMediaTaskData, options?: JobsOptions) {
    return await this.postMediaTaskQueue.add('media', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAiImageAsyncJob(data: AiImageData, options?: JobsOptions) {
    return await this.aiImageAsyncQueue.add('generate', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addEngagementTaskDistributionJob(
    data: EngagementTaskDistributionData,
    options?: JobsOptions,
  ) {
    return await this.engagementTaskDistributionQueue.add('distribute', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addUpdatePublishedPostJob(data: { taskId: string, updatedContentType: string }, options?: JobsOptions) {
    return await this.updatePublishedPostQueue.add('update-published-post', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addEngagementReplyToCommentJob(data: EngagementReplyToCommentData, options?: JobsOptions) {
    return await this.engagementReplyToCommentQueue.add('reply', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addEngagementMiningJob(data: EngagementMiningJobData, options?: JobsOptions) {
    return await this.engagementMiningQueue.add('classify', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addEngagementAutomationActionJob(
    data: EngagementAutomationActionData,
    options?: JobsOptions,
  ): Promise<Job<EngagementAutomationActionData>> {
    return await this.engagementAutomationActionQueue.add(
      `${data.platform}:${data.action}`,
      data,
      {
        ...this.defaultOptions,
        jobId: data.correlationId,
        ...options,
      },
    )
  }

  async waitForEngagementAutomationActionResult<T = unknown>(
    correlationId: string,
    timeoutMs = 60_000,
  ): Promise<T> {
    const job = await this.engagementAutomationActionQueue.getJob(correlationId)
    if (!job)
      throw new Error(`automation action job ${correlationId} not found`)
    return (await job.waitUntilFinished(undefined as never, timeoutMs)) as T
  }

  async addBrandMonitorScanJob(
    data: BrandMonitorScanData,
    options?: JobsOptions,
  ) {
    return await this.brandMonitorScanQueue.add('scan', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addBrandMonitorScanRepeatable(
    data: BrandMonitorScanData,
    everyMs: number,
  ) {
    // BullMQ repeat jobs are deduped by `jobId + repeat opts` — using
    // `monitor:<id>` keeps a single job per monitor regardless of restarts.
    return await this.brandMonitorScanQueue.add('scan', data, {
      ...this.defaultOptions,
      jobId: `monitor:${data.monitorId}`,
      repeat: { every: everyMs },
    })
  }

  async removeBrandMonitorScanRepeatable(monitorId: string, everyMs: number) {
    await this.brandMonitorScanQueue.removeRepeatable('scan', { every: everyMs }, `monitor:${monitorId}`)
  }

  async addDumpSocialMediaAvatarJob(data: { accountId: string }, options?: JobsOptions) {
    return await this.dumpSocialMediaAvatarQueue.add('dump-social-avatar', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addCreditsPurchaseJob(data: CreditsPurchaseData, options?: JobsOptions) {
    return await this.creditsPurchaseQueue.add('purchase', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addCreditsRefundJob(data: CreditsRefundData, options?: JobsOptions) {
    return await this.creditsRefundQueue.add('refund', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addNotificationJob(data: NotificationData, options?: JobsOptions) {
    return await this.notificationQueue.add('send-notification', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addDraftGenerationJob(data: DraftGenerationData, options?: JobsOptions) {
    return await this.draftGenerationQueue.add('generate', data, {
      ...this.defaultOptions,
      ...options,
    })
  }
}
