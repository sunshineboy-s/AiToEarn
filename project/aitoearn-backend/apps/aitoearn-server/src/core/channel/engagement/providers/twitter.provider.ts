import { Injectable } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { TwitterService } from '../../platforms/twitter/twitter.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import {
  ActionResult,
  EngagementCapability,
  EngagementNotSupportedError,
  EngagementProvider,
  FetchPostCommentsResponse,
  PublishCommentResponse,
} from '../engagement.interface'

/**
 * Engagement provider for Twitter / X.
 *
 * The capability matrix reflects what the official v2 endpoints expose with
 * the OAuth scopes we already request:
 *   - like / unlike: POST /2/users/:id/likes  + DELETE /2/users/:id/likes/:tweet_id
 *   - follow:        POST /2/users/:id/following
 *   - comment/reply: POST /2/tweets with `reply.in_reply_to_tweet_id`
 *
 * Unfollow needs `follows.write` plus DELETE; we expose it via TwitterService
 * once the API helper lands. For now it throws EngagementNotSupportedError so
 * the controller surfaces a typed `EngagementCapabilityUnavailable` response.
 *
 * Read APIs (fetchUserPosts / getMetaPostDetail / fetchPostComments) are
 * deferred to a follow-up that wires the data-cube paths into this provider.
 */
@Injectable()
export class TwitterEngagementProvider implements EngagementProvider {
  public readonly platform = 'twitter'
  public readonly capability: EngagementCapability = {
    like: true,
    unlike: true,
    favorite: false,
    unfavorite: false,
    follow: true,
    unfollow: false,
    comment: true,
    reply: true,
    fetchUserPosts: false,
    search: false,
    engine: 'api',
  }

  constructor(private readonly twitterService: TwitterService) {}

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
    const resp = await this.twitterService.replyPost(accountId, postId, message)
    if (resp?.data?.id)
      return { id: resp.data.id, success: true }
    return { success: false, error: 'Failed to publish reply' }
  }

  /**
   * Twitter's "reply to comment" is just another tweet that replies to the
   * comment tweet, so reuse `replyPost`.
   */
  replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    return this.commentOnPost(accountId, commentId, message)
  }

  async likePost(accountId: string, postId: string): Promise<ActionResult> {
    const r = await this.twitterService.likePost(accountId, postId)
    if (!r)
      return { success: false, error: 'No access token / like failed' }
    const liked = (r as unknown as { data?: { liked?: boolean } }).data?.liked
    return { success: liked === undefined ? true : Boolean(liked) }
  }

  async unlikePost(accountId: string, postId: string): Promise<ActionResult> {
    const r = await this.twitterService.unlikePost(accountId, postId)
    if (!r)
      return { success: false, error: 'No access token / unlike failed' }
    const liked = (r as unknown as { data?: { liked?: boolean } }).data?.liked
    // unlike returns liked=false on success
    return { success: liked === undefined ? true : !liked }
  }

  favoritePost(_accountId: string, _postId: string): Promise<ActionResult> {
    // X has 'bookmarks' which is closer to favorite. We expose it via a
    // dedicated bookmark hook in a later PR; until then capability=false and
    // we throw to avoid silent no-op.
    throw new EngagementNotSupportedError(this.platform, 'favorite')
  }

  unfavoritePost(_accountId: string, _postId: string): Promise<ActionResult> {
    throw new EngagementNotSupportedError(this.platform, 'unfavorite')
  }

  async followUser(accountId: string, targetUserId: string): Promise<ActionResult> {
    const ok = await this.twitterService.followUser(accountId, targetUserId)
    return { success: Boolean(ok) }
  }

  unfollowUser(_accountId: string, _targetUserId: string): Promise<ActionResult> {
    // TwitterService doesn't expose unfollow yet — see capability matrix.
    throw new EngagementNotSupportedError(this.platform, 'unfollow')
  }
}
