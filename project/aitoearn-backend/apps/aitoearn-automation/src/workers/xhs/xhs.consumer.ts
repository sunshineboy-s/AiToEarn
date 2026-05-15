import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import {
  EngagementAutomationActionData,
  QueueName,
  QueueProcessor,
} from '@yikart/aitoearn-queue'
import { Job } from 'bullmq'
import { ActionResult } from './xhs.types'
import { XhsService } from './xhs.service'

/**
 * Bridge between BullMQ and the XHS Playwright worker.
 *
 * Job lifecycle (request/response over BullMQ):
 *   1. aitoearn-server enqueues with { correlationId, accountId, action, target, message? }
 *   2. this consumer reads, dispatches by `action`, and *returns* the result —
 *      BullMQ stores the return value as the job result so the server's
 *      `Job.waitUntilFinished` resolves with our payload
 *   3. unsupported actions resolve to `{ success: false, error }` rather than
 *      throwing; throwing would mark the job FAILED and leak retry semantics
 *      we don't want for capability errors
 *
 * Concurrency is intentionally low (2). Per-account pacing is enforced by the
 * BrowserPoolService — we'd rather queue than thrash a single account.
 */
@QueueProcessor(QueueName.EngagementAutomationAction, {
  concurrency: 2,
  stalledInterval: 30_000,
  maxStalledCount: 1,
})
export class XhsAutomationConsumer extends WorkerHost {
  private readonly logger = new Logger(XhsAutomationConsumer.name)

  constructor(private readonly xhsService: XhsService) {
    super()
  }

  async process(job: Job<EngagementAutomationActionData>): Promise<ActionResult> {
    const data = job.data
    if (data.platform !== 'xhs') {
      return {
        success: false,
        error: `unsupported platform '${data.platform}' for xhs worker`,
      }
    }

    this.logger.log(
      `xhs job ${job.id} action=${data.action} accountId=${data.accountId} target=${truncate(data.target)}`,
    )

    switch (data.action) {
      case 'like': {
        const r = await this.xhsService.likeNote(data.accountId, data.target)
        return wrap(r, 'like')
      }
      case 'unlike': {
        const r = await this.xhsService.unlikeNote(data.accountId, data.target)
        return wrap(r, 'unlike')
      }
      case 'favorite': {
        const r = await this.xhsService.favoriteNote(data.accountId, data.target)
        return wrap(r, 'favorite')
      }
      case 'unfavorite': {
        const r = await this.xhsService.unfavoriteNote(data.accountId, data.target)
        return wrap(r, 'unfavorite')
      }
      case 'follow': {
        const r = await this.xhsService.followUser(data.accountId, data.target)
        return wrap(r, 'follow')
      }
      case 'unfollow': {
        const r = await this.xhsService.unfollowUser(data.accountId, data.target)
        return wrap(r, 'unfollow')
      }
      case 'reply':
      case 'comment': {
        const message = data.message ?? ''
        if (!message)
          return { success: false, error: 'message is required for reply/comment' }
        const r = await this.xhsService.replyToNote(data.accountId, data.target, message)
        return wrap(r, 'reply')
      }
      case 'search': {
        const limit = typeof data.metadata?.['limit'] === 'number' ? data.metadata['limit'] : 20
        const r = await this.xhsService.search(data.accountId, data.target, limit)
        return wrap(r, 'search')
      }
      default:
        return { success: false, error: `unsupported action '${data.action}'` }
    }
  }
}

function wrap<T>(r: { success: boolean, data?: T, error?: string }, providerId: string): ActionResult {
  return {
    success: r.success,
    data: r.success && r.data ? (r.data as unknown as Record<string, unknown>) : undefined,
    error: r.error,
    providerId: r.success ? providerId : undefined,
  }
}

function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}
