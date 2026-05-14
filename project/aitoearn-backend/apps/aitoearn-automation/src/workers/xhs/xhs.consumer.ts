import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import {
  EngagementAutomationActionData,
  QueueName,
  QueueProcessor,
} from '@yikart/aitoearn-queue'
import { Job } from 'bullmq'
import { DouyinService } from '../douyin/douyin.service'
import { ActionResult } from './xhs.types'
import { XhsService } from './xhs.service'

/**
 * Bridge between BullMQ and the platform Playwright workers.
 *
 * Job lifecycle (request/response over BullMQ):
 *   1. aitoearn-server enqueues with { correlationId, platform, action, target, message? }
 *   2. this consumer reads, dispatches by `platform` → service, then by
 *      `action` → method, and *returns* the result — BullMQ stores the
 *      return value as the job result so the server's
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

  constructor(
    private readonly xhsService: XhsService,
    private readonly douyinService: DouyinService,
  ) {
    super()
  }

  async process(job: Job<EngagementAutomationActionData>): Promise<ActionResult> {
    const data = job.data
    this.logger.log(
      `automation job ${job.id} platform=${data.platform} action=${data.action} accountId=${data.accountId} target=${truncate(data.target)}`,
    )

    if (data.platform === 'xhs')
      return this.processXhs(data)
    if (data.platform === 'douyin')
      return this.processDouyin(data)
    return {
      success: false,
      error: `unsupported platform '${data.platform}' for automation worker`,
    }
  }

  private async processXhs(data: EngagementAutomationActionData): Promise<ActionResult> {
    switch (data.action) {
      case 'like':
        return wrap(await this.xhsService.likeNote(data.accountId, data.target), 'like')
      case 'unlike':
        return wrap(await this.xhsService.unlikeNote(data.accountId, data.target), 'unlike')
      case 'favorite':
        return wrap(await this.xhsService.favoriteNote(data.accountId, data.target), 'favorite')
      case 'unfavorite':
        return wrap(await this.xhsService.unfavoriteNote(data.accountId, data.target), 'unfavorite')
      case 'follow':
        return wrap(await this.xhsService.followUser(data.accountId, data.target), 'follow')
      case 'unfollow':
        return wrap(await this.xhsService.unfollowUser(data.accountId, data.target), 'unfollow')
      case 'reply':
      case 'comment': {
        const message = data.message ?? ''
        if (!message)
          return { success: false, error: 'message is required for reply/comment' }
        return wrap(await this.xhsService.replyToNote(data.accountId, data.target, message), 'reply')
      }
      case 'search': {
        const limit = typeof data.metadata?.['limit'] === 'number' ? data.metadata['limit'] : 20
        return wrap(await this.xhsService.search(data.accountId, data.target, limit), 'search')
      }
      default:
        return { success: false, error: `unsupported action '${data.action}' on xhs` }
    }
  }

  private async processDouyin(data: EngagementAutomationActionData): Promise<ActionResult> {
    switch (data.action) {
      case 'like':
        return wrap(await this.douyinService.likeVideo(data.accountId, data.target), 'like')
      case 'unlike':
        return wrap(await this.douyinService.unlikeVideo(data.accountId, data.target), 'unlike')
      case 'favorite':
        return wrap(await this.douyinService.favoriteVideo(data.accountId, data.target), 'favorite')
      case 'unfavorite':
        return wrap(await this.douyinService.unfavoriteVideo(data.accountId, data.target), 'unfavorite')
      case 'follow':
        return wrap(await this.douyinService.followUser(data.accountId, data.target), 'follow')
      case 'unfollow':
        return wrap(await this.douyinService.unfollowUser(data.accountId, data.target), 'unfollow')
      case 'reply':
      case 'comment': {
        const message = data.message ?? ''
        if (!message)
          return { success: false, error: 'message is required for reply/comment' }
        return wrap(await this.douyinService.replyToVideo(data.accountId, data.target, message), 'reply')
      }
      case 'search': {
        const limit = typeof data.metadata?.['limit'] === 'number' ? data.metadata['limit'] : 20
        return wrap(await this.douyinService.search(data.accountId, data.target, limit), 'search')
      }
      default:
        return { success: false, error: `unsupported action '${data.action}' on douyin` }
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
