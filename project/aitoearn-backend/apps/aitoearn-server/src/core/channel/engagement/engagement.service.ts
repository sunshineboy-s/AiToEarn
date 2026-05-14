import { Injectable } from '@nestjs/common'
import { AiService, UserChatCompletionDto } from '@yikart/aitoearn-ai-client'
import { QueueService } from '@yikart/aitoearn-queue'
import { EngagementTargetScope, EngagementTaskStatus, EngagementTaskType } from '@yikart/channel-db'
import { AppException, ResponseCode, UserType } from '@yikart/common'
import { RelayAccountException } from '../../relay/relay-account.exception'
import { ChannelAccountService } from '../platforms/channel-account.service'
import { FacebookService } from '../platforms/meta/facebook.service'
import { ReplyToCommentAnswer } from './ai.dto'
import { DouyinAutomationProvider } from './automation/douyin-automation.provider'
import { XhsAutomationProvider } from './automation/xhs-automation.provider'
import { AIGenCommentDto, FavoritePostRequest, FetchCommentRepliesRequest, FetchMetaPostsRequest, FetchPostCommentsRequest, FetchPostsRequest, FollowUserRequest, LikePostRequest, PublishCommentReplyRequest, PublishCommentRequest, ReplyToCommentsDto } from './engagement.dto'
import { ActionResult, EngagementCapability, EngagementNotSupportedError, EngagementProvider, PublishCommentResponse } from './engagement.interface'
import { EngagementRecordService } from './engagement.record.service'
import { FacebookEngagementProvider } from './providers/facebook.provider'
import { InstagramEngagementProvider } from './providers/instagram.provider'
import { ThreadsEngagementProvider } from './providers/threads.provider'
import { TwitterEngagementProvider } from './providers/twitter.provider'
import { YoutubeEngagementProvider } from './providers/youtube.provider'
import { EngagementRateLimitGuardService } from './rate-limit-guard.service'

@Injectable()
export class EngagementService {
  private readonly providerMap = new Map<string, EngagementProvider>()
  constructor(
    facebookProvider: FacebookEngagementProvider,
    instagramProvider: InstagramEngagementProvider,
    threadsProvider: ThreadsEngagementProvider,
    youtubeProvider: YoutubeEngagementProvider,
    twitterProvider: TwitterEngagementProvider,
    xhsAutomationProvider: XhsAutomationProvider,
    douyinAutomationProvider: DouyinAutomationProvider,
    private readonly aiService: AiService,
    private readonly engagementRecordService: EngagementRecordService,
    private readonly queueService: QueueService,
    private readonly facebookService: FacebookService,
    private readonly channelAccountService: ChannelAccountService,
    private readonly rateLimit: EngagementRateLimitGuardService,
  ) {
    this.providerMap.set('facebook', facebookProvider)
    this.providerMap.set('instagram', instagramProvider)
    this.providerMap.set('threads', threadsProvider)
    this.providerMap.set('youtube', youtubeProvider)
    this.providerMap.set('twitter', twitterProvider)
    this.providerMap.set('xhs', xhsAutomationProvider)
    this.providerMap.set('douyin', douyinAutomationProvider)
  }

  /**
   * Snapshot of the platform capability matrix. The frontend calls this on
   * page load to know which buttons to disable. Adding a new provider simply
   * inserts another row.
   */
  getCapabilities(): Array<EngagementCapability & { platform: string }> {
    return Array.from(this.providerMap.values()).map(p => ({
      platform: p.platform,
      ...p.capability,
    }))
  }

  /**
   * Provider lookup that returns null instead of throwing — used by the brand
   * monitor consumer when iterating over a list of platforms that may not all
   * have a registered provider yet.
   */
  getProviderUnsafe(providerKey: string): EngagementProvider | null {
    return this.providerMap.get(providerKey) ?? null
  }

  /**
   * Pick a default channel-account for (userId, platform). Used by background
   * scans that need *some* authenticated account but don't care which one.
   *
   * NOTE: Phase 6 ships a stub that always returns null — the full
   * "pick the highest-trust account" heuristic is wired in M2 once we have a
   * `ChannelAccountService.listByUser` method to delegate to. Until then, the
   * brand monitor consumer simply skips platforms without an obvious account.
   */
  async resolveDefaultAccount(_userId: string, _platform: string): Promise<string | null> {
    return null
  }

  private async checkRelayAccount(accountId: string) {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (account?.relayAccountRef) {
      throw new RelayAccountException(account.relayAccountRef, accountId)
    }
  }

  private getProvider(providerKey: string): EngagementProvider {
    const provider = this.providerMap.get(providerKey)
    if (!provider) {
      throw new AppException(ResponseCode.PlatformNotSupported, { platform: providerKey })
    }
    return provider
  }


  async fetchUserPosts(data: FetchPostsRequest) {
    await this.checkRelayAccount(data.accountId)
    const provider = this.getProvider(data.platform)
    let pagination = data.pagination || null
    if (!pagination) {
      pagination = {
        before: data.before || undefined,
        after: data.after || undefined,
        limit: 50,
      }
    }
    return provider.fetchUserPosts(data.accountId, pagination)
  }

  async getMetaPostDetail(accountId: string, platform: string, postId: string) {
    await this.checkRelayAccount(accountId)
    const provider = this.getProvider(platform)
    return provider.getMetaPostDetail(accountId, postId)
  }

  async fetchPostComments(data: FetchPostCommentsRequest) {
    await this.checkRelayAccount(data.accountId)
    const provider = this.getProvider(data.platform)
    return provider.fetchPostComments(data.accountId, data.postId, data.pagination || null)
  }

  async fetchCommentReplies(data: FetchCommentRepliesRequest) {
    await this.checkRelayAccount(data.accountId)
    const provider = this.getProvider(data.platform)
    return provider.fetchCommentReplies(data.accountId, data.commentId, data.pagination || null)
  }

  async commentOnPost(data: PublishCommentRequest): Promise<PublishCommentResponse> {
    await this.checkRelayAccount(data.accountId)
    const provider = this.getProvider(data.platform)
    return provider.commentOnPost(data.accountId, data.postId, data.message)
  }

  async replyToComment(data: PublishCommentReplyRequest): Promise<PublishCommentResponse> {
    await this.checkRelayAccount(data.accountId)
    const provider = this.getProvider(data.platform)
    return provider.replyToComment(data.accountId, data.commentId, data.message)
  }

  async fetchMetaPosts(data: FetchMetaPostsRequest) {
    await this.checkRelayAccount(data.accountId)
    const provider = this.getProvider(data.platform)
    const pagination = data.pagination || {
      before: data.before || undefined,
      after: data.after || undefined,
      limit: 50,
    }
    return provider.fetchUserPosts(data.accountId, pagination)
  }

  async likePost(data: LikePostRequest): Promise<ActionResult> {
    await this.checkRelayAccount(data.accountId)
    await this.rateLimit.assertAllowed(data.accountId, 'like')
    const provider = this.getProvider(data.platform)
    return this.runAction('like', data.accountId, () => provider.likePost(data.accountId, data.postId))
  }

  async unlikePost(data: LikePostRequest): Promise<ActionResult> {
    await this.checkRelayAccount(data.accountId)
    await this.rateLimit.assertAllowed(data.accountId, 'unlike')
    const provider = this.getProvider(data.platform)
    return this.runAction('unlike', data.accountId, () => provider.unlikePost(data.accountId, data.postId))
  }

  async favoritePost(data: FavoritePostRequest): Promise<ActionResult> {
    await this.checkRelayAccount(data.accountId)
    await this.rateLimit.assertAllowed(data.accountId, 'favorite')
    const provider = this.getProvider(data.platform)
    return this.runAction('favorite', data.accountId, () => provider.favoritePost(data.accountId, data.postId))
  }

  async unfavoritePost(data: FavoritePostRequest): Promise<ActionResult> {
    await this.checkRelayAccount(data.accountId)
    await this.rateLimit.assertAllowed(data.accountId, 'unfavorite')
    const provider = this.getProvider(data.platform)
    return this.runAction('unfavorite', data.accountId, () => provider.unfavoritePost(data.accountId, data.postId))
  }

  async followUser(data: FollowUserRequest): Promise<ActionResult> {
    await this.checkRelayAccount(data.accountId)
    await this.rateLimit.assertAllowed(data.accountId, 'follow')
    const provider = this.getProvider(data.platform)
    return this.runAction('follow', data.accountId, () => provider.followUser(data.accountId, data.targetUserId))
  }

  async unfollowUser(data: FollowUserRequest): Promise<ActionResult> {
    await this.checkRelayAccount(data.accountId)
    await this.rateLimit.assertAllowed(data.accountId, 'unfollow')
    const provider = this.getProvider(data.platform)
    return this.runAction('unfollow', data.accountId, () => provider.unfollowUser(data.accountId, data.targetUserId))
  }

  /**
   * Wraps a provider call with three concerns:
   * 1) translate `EngagementNotSupportedError` to a typed AppException
   * 2) rate-limit + circuit-breaker bookkeeping (success ↔ recordSuccess,
   *    a non-success result counts as a failure for the breaker)
   * 3) re-throw any other error untouched
   */
  private async runAction(
    action: string,
    accountId: string,
    fn: () => Promise<ActionResult>,
  ): Promise<ActionResult> {
    let result: ActionResult
    try {
      result = await fn()
    }
    catch (err: unknown) {
      if (err instanceof EngagementNotSupportedError) {
        // capability-related exceptions don't trip the breaker
        throw new AppException(
          ResponseCode.EngagementCapabilityUnavailable,
          { action: err.action || action, platform: err.platform },
        )
      }
      await this.rateLimit.recordFailure(accountId)
      throw err
    }
    if (result.success)
      await this.rateLimit.recordSuccess(accountId)
    else
      await this.rateLimit.recordFailure(accountId)
    return result
  }

  async batchGenReplyContent(data: AIGenCommentDto): Promise<Record<string, string>> {
    const aiChatReq: UserChatCompletionDto = {
      userId: data.userId,
      userType: UserType.User,
      messages: [
        {
          role: 'system',
          content: 'You are a senior social media strategist.',
        },
        {
          role: 'user',
          content: 'I will provide you with a list of comments in the format: [{id: string, comment: string}].\n\nYour task:\n- Generate a professional and engaging reply for each comment\n- Keep replies concise and under 50 words\n- Maintain a positive and friendly tone, encouraging further interaction\n- The reply must be written in the same language as the comment\n- Return a strict JSON array, with each element formatted as: {id: string, comment: string, reply: string}\n\nImportant: The output must contain only the JSON array — no explanations, no extra text, and no code blocks.',
        },
        {
          role: 'user',
          content: JSON.stringify(data.comments),
        },
      ],
      model: data.model,
    }
    if (data.prompt && data.prompt.length > 0) {
      aiChatReq.messages.push({
        role: 'user',
        content: data.prompt,
      })
    }
    const resp = await this.aiService.chatCompletion(aiChatReq)
    const replyMap: Record<string, string> = {}
    const replyList: ReplyToCommentAnswer[] = JSON.parse(resp.content as string)
    for (const replyItem of replyList) {
      replyMap[replyItem.id] = replyItem.reply
    }
    return replyMap
  }

  async ReplyToCommentsByAI(data: ReplyToCommentsDto): Promise<{ id: string }> {
    await this.checkRelayAccount(data.accountId)
    let targetScope = EngagementTargetScope.ALL
    if (data.comments?.length && data.comments.length > 0) {
      targetScope = EngagementTargetScope.PARTIAL
    }
    const tasks = await this.engagementRecordService.searchEngagementTaskInProgress(data.postId, EngagementTaskStatus.FAILED)
    if (tasks && tasks.length > 0) {
      throw new AppException(ResponseCode.EngagementTaskInProgress)
    }
    const task = await this.engagementRecordService.createEngagementTask({
      accountId: data.accountId,
      userId: data.userId,
      postId: data.postId,
      taskType: EngagementTaskType.REPLY,
      targetScope,
      prompt: data.prompt,
      model: data.model,
      platform: data.platform,
      targetIds: data.comments ? data.comments.map(c => c.id) : [],
      status: EngagementTaskStatus.CREATED,
      subTaskCount: 0,
      completedSubTaskCount: 0,
      failedSubTaskCount: 0,
    })
    if (data.comments && data.comments.length > 0) {
      for (const comment of data.comments) {
        await this.engagementRecordService.createEngagementSubTask({
          accountId: data.accountId,
          userId: data.userId,
          postId: data.postId,
          platform: data.platform,
          taskType: EngagementTaskType.REPLY,
          taskId: task.id,
          commentId: comment.id,
          commentContent: comment.comment,
          status: EngagementTaskStatus.CREATED,
          replyContent: '',
        })
      }
    }
    await this.queueService.addEngagementTaskDistributionJob(
      {
        taskId: task.id,
        attempts: 0,
      },
      {
        attempts: 0,
        removeOnComplete: true,
        removeOnFail: true,
      },
    )
    return { id: task.id }
  }
}
