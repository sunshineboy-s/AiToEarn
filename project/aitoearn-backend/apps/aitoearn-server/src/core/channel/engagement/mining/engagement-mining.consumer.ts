import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { EngagementMiningJobData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import { Job } from 'bullmq'
import { EngagementMiningService } from './engagement-mining.service'

@QueueProcessor(QueueName.EngagementMining, {
  concurrency: 4,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class EngagementMiningConsumer extends WorkerHost {
  private readonly logger = new Logger(EngagementMiningConsumer.name)

  constructor(private readonly miningService: EngagementMiningService) {
    super()
  }

  async process(job: Job<EngagementMiningJobData>): Promise<{ persisted: number }> {
    const data = job.data
    this.logger.log(`mining job ${job.id} → ${data.comments.length} comments on ${data.platform}/${data.postId}`)
    const hits = await this.miningService.classifyAndStoreBatch({
      userId: data.userId,
      accountId: data.accountId,
      platform: data.platform,
      postId: data.postId,
      model: data.model,
      comments: data.comments.map(c => ({
        id: c.id,
        content: c.content,
        authorId: c.authorId,
        authorName: c.authorName,
      })),
    })
    return { persisted: hits.length }
  }
}
