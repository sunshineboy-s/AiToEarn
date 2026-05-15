import { Injectable } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import {
  ActionResult,
  EngagementCapability,
  EngagementNotSupportedError,
  EngagementProvider,
  FetchPostCommentsResponse,
  PublishCommentResponse,
  SearchPostsRequest,
  SearchPostsResponse,
} from '../engagement.interface'
import { EngagementAutomationRpcService } from './automation-rpc.service'

/**
 * Server-side adapter that turns Engagement API calls into
 * `aitoearn-automation` worker invocations over BullMQ. The automation worker
 * already implements like / reply / search for xhs (PoC); follow / favorite
 * are wired through the same pipe and depend on the worker side adding the
 * corresponding action handler (a one-line registration in xhs.service.ts).
 *
 * Read APIs (fetchUserPosts / fetchPostComments / fetchCommentReplies /
 * getMetaPostDetail) are not yet supported here — automation read paths are
 * scheduled for Phase 3B follow-ups; for now they throw.
 */
@Injectable()
export class XhsAutomationProvider implements EngagementProvider {
  public readonly platform = 'xhs'
  public readonly capability: EngagementCapability = {
    like: true,
    unlike: true,
    favorite: true,
    unfavorite: true,
    follow: true,
    unfollow: true,
    comment: true,
    reply: true,
    fetchUserPosts: false,
    search: true,
    engine: 'automation',
  }

  constructor(private readonly rpc: EngagementAutomationRpcService) {}

  fetchUserPosts(_accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    throw new EngagementNotSupportedError(this.platform, 'fetchUserPosts')
  }

  getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    throw new EngagementNotSupportedError(this.platform, 'getMetaPostDetail')
  }

  fetchPostComments(_accountId: string, _postId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    throw new EngagementNotSupportedError(this.platform, 'fetchPostComments')
  }

  fetchCommentReplies(_accountId: string, _commentId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    throw new EngagementNotSupportedError(this.platform, 'fetchCommentReplies')
  }

  async commentOnPost(accountId: string, postId: string, message: string): Promise<PublishCommentResponse> {
    const r = await this.rpc.invoke({
      userId: '',
      accountId,
      platform: this.platform,
      action: 'comment',
      target: postId,
      message,
    })
    return r.success
      ? { id: typeof r.providerId === 'string' ? r.providerId : '', success: true }
      : { success: false, error: r.error }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    const r = await this.rpc.invoke({
      userId: '',
      accountId,
      platform: this.platform,
      action: 'reply',
      target: commentId,
      message,
    })
    return r.success
      ? { id: typeof r.providerId === 'string' ? r.providerId : '', success: true }
      : { success: false, error: r.error }
  }

  likePost(accountId: string, postId: string): Promise<ActionResult> {
    return this.rpc.invoke({ userId: '', accountId, platform: this.platform, action: 'like', target: postId })
  }

  unlikePost(accountId: string, postId: string): Promise<ActionResult> {
    return this.rpc.invoke({ userId: '', accountId, platform: this.platform, action: 'unlike', target: postId })
  }

  favoritePost(accountId: string, postId: string): Promise<ActionResult> {
    return this.rpc.invoke({ userId: '', accountId, platform: this.platform, action: 'favorite', target: postId })
  }

  unfavoritePost(accountId: string, postId: string): Promise<ActionResult> {
    return this.rpc.invoke({ userId: '', accountId, platform: this.platform, action: 'unfavorite', target: postId })
  }

  followUser(accountId: string, targetUserId: string): Promise<ActionResult> {
    return this.rpc.invoke({ userId: '', accountId, platform: this.platform, action: 'follow', target: targetUserId })
  }

  unfollowUser(accountId: string, targetUserId: string): Promise<ActionResult> {
    return this.rpc.invoke({ userId: '', accountId, platform: this.platform, action: 'unfollow', target: targetUserId })
  }

  async searchPosts(accountId: string, request: SearchPostsRequest): Promise<SearchPostsResponse> {
    const r = await this.rpc.invoke({
      userId: '',
      accountId,
      platform: this.platform,
      action: 'search',
      target: request.keyword,
      metadata: { limit: request.limit ?? 20, language: request.language ?? 'unknown' },
    })
    if (!r.success)
      return { items: [] }
    const items = (r.data?.['items'] as Array<Record<string, unknown>> | undefined) ?? []
    return {
      items: items.map((item) => {
        return {
          id: String(item['noteId'] ?? item['id'] ?? ''),
          platform: 'xhs',
          url: String(item['url'] ?? ''),
          authorId: typeof item['authorId'] === 'string' ? item['authorId'] : undefined,
          authorName: typeof item['authorName'] === 'string' ? item['authorName'] : undefined,
          content: String(item['title'] ?? ''),
          mediaUrls: typeof item['thumbnail'] === 'string' ? [item['thumbnail']] : undefined,
          likeCount: typeof item['likeCount'] === 'number' ? item['likeCount'] : undefined,
        }
      }),
    }
  }
}
