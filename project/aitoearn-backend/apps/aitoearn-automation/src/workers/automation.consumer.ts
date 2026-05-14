import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import {
  EngagementAutomationActionData,
  QueueName,
  QueueProcessor,
} from '@yikart/aitoearn-queue'
import { Job } from 'bullmq'
import { DouyinService } from './douyin/douyin.service'
import { XhsService } from './xhs/xhs.service'
import { ActionResult } from './xhs/xhs.types'

/**
 * Single dispatcher across all automation platforms.
 *
 * Why one consumer instead of one-per-platform: the `engagement_automation_action`
 * BullMQ queue is shared, and BullMQ does not support routing by job payload
 * (a job is consumed by whichever worker grabs it first). Splitting consumers
 * would risk a douyin job being claimed by the xhs consumer and returned
 * "unsupported platform" instead of being run.
 *
 * Concurrency stays at 2 to keep memory + Chromium pressure bounded; per-account
 * pacing is enforced by the per-platform `BrowserPoolService`.
 */
@QueueProcessor(QueueName.EngagementAutomationAction, {
  concurrency: 2,
  stalledInterval: 30_000,
  maxStalledCount: 1,
})
export class AutomationDispatcherConsumer extends WorkerHost {
  private readonly logger = new Logger(AutomationDispatcherConsumer.name)

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
    switch (data.platform) {
      case 'xhs':
        return this.runXhs(data)
      case 'douyin':
        return this.runDouyin(data)
      default:
        return {
          success: false,
          error: `unsupported platform '${data.platform}'`,
        }
    }
  }

  private async runXhs(data: EngagementAutomationActionData): Promise<ActionResult> {
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
        return { success: false, error: `xhs: unsupported action '${data.action}'` }
    }
  }

  private async runDouyin(data: EngagementAutomationActionData): Promise<ActionResult> {
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
        return { success: false, error: `douyin: unsupported action '${data.action}'` }
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
