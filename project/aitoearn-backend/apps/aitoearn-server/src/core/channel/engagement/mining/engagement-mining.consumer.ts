import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { EngagementMiningJobData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import {
  EngagementMiningHit,
  EngagementMiningIntent,
} from '@yikart/channel-db'
import { Job } from 'bullmq'
import { EngagementService } from '../engagement.service'
import { EngagementMiningService } from './engagement-mining.service'

/** Intents we trust for auto-reply when `recommendedReply` is non-empty. */
const AUTO_REPLY_INTENTS = new Set<EngagementMiningIntent>([
  EngagementMiningIntent.PURCHASE_INTENT,
  EngagementMiningIntent.LINK_REQUEST,
  EngagementMiningIntent.PRICE_QUESTION,
])

@QueueProcessor(QueueName.EngagementMining, {
  concurrency: 4,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class EngagementMiningConsumer extends WorkerHost {
  private readonly logger = new Logger(EngagementMiningConsumer.name)

  constructor(
    private readonly miningService: EngagementMiningService,
    /**
     * EngagementService is resolved lazily to avoid a circular module dep
     * (engagement.module imports mining; mining wants to dispatch reply
     * tasks back via engagement.service). ModuleRef sidesteps this safely.
     */
    private readonly moduleRef: ModuleRef,
  ) {
    super()
  }

  async process(
    job: Job<EngagementMiningJobData>,
  ): Promise<{ persisted: number, autoReplyTaskId?: string }> {
    const data = job.data
    this.logger.log(
      `mining job ${job.id} → ${data.comments.length} comments on `
      + `${data.platform}/${data.postId} autoReply=${Boolean(data.autoReply)}`,
    )
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

    if (!data.autoReply || hits.length === 0)
      return { persisted: hits.length }

    const replyCandidates = hits.filter(h =>
      AUTO_REPLY_INTENTS.has(h.intent) && (h.recommendedReply ?? '').trim().length > 0,
    )
    if (replyCandidates.length === 0)
      return { persisted: hits.length }

    const taskId = await this.dispatchAutoReply(data, replyCandidates)
    return { persisted: hits.length, autoReplyTaskId: taskId }
  }

  /**
   * Hands a list of mining hits to `EngagementService.ReplyToCommentsByAI` as
   * a partial-scope task. Each hit contributes its `recommendedReply` as the
   * pre-generated content; the worker still re-validates safety + posts via
   * the matching provider.
   *
   * Returns the created task id, or undefined when EngagementService is
   * unavailable (we don't fail the mining job — auto-reply is a bonus).
   */
  private async dispatchAutoReply(
    data: EngagementMiningJobData,
    hits: EngagementMiningHit[],
  ): Promise<string | undefined> {
    let engagement: EngagementService
    try {
      engagement = this.moduleRef.get(EngagementService, { strict: false })
    }
    catch (err) {
      this.logger.warn(
        `auto-reply skipped: EngagementService not resolvable: ${(err as Error).message}`,
      )
      return undefined
    }

    try {
      const task = await engagement.ReplyToCommentsByAI({
        accountId: data.accountId,
        userId: data.userId,
        postId: data.postId,
        platform: data.platform as never, // EngagementService schema enum
        model: data.model ?? '',
        prompt: '',
        comments: hits.map(h => ({
          id: h.commentId,
          comment: h.commentContent,
        })),
      })
      this.logger.log(`auto-reply task ${task.id} dispatched for ${hits.length} hits`)
      return task.id
    }
    catch (err) {
      this.logger.warn(`auto-reply dispatch failed: ${(err as Error).message}`)
      return undefined
    }
  }
}
