import { Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import {
  EngagementProvider,
  FetchPostCommentsResponse,
  PublishCommentResponse,
} from '../engagement.interface'

/**
 * Base class for engagement providers that have no working backend yet.
 *
 * Per RFC 0001 §7 ("real-vs-stub separation"), stubs must NOT silently
 * return success — they:
 *   - emit a structured warn log on every call (path / accountId / reason),
 *   - return empty collections for read methods,
 *   - return `{ success: false, error }` for write methods.
 *
 * Subclasses override the methods they actually implement; everything they
 * don't override stays unsupported and self-documenting in logs.
 */
export abstract class BaseUnsupportedEngagementProvider
implements EngagementProvider {
  protected abstract readonly platform: string
  protected abstract readonly logger: Logger

  /**
   * Why this provider is unsupported. Subclasses set this to one of:
   *   - 'platform-has-no-open-api'
   *   - 'open-api-scope-not-available'
   *   - 'cookie-mode-not-implemented'
   * — anything specific is fine; it's logged so ops can grep.
   */
  protected abstract readonly unsupportedReason: string

  protected emptyCursor() {
    return { before: '', after: '' }
  }

  protected warn(method: string, ctx: Record<string, unknown>) {
    this.logger.warn({
      path: `${this.platform}.${method}.unsupported`,
      reason: this.unsupportedReason,
      ...ctx,
    })
  }

  async fetchUserPosts(
    accountId: string,
    _pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<PostsResponseVo> {
    this.warn('fetchUserPosts', { accountId })
    return { posts: [], cursor: this.emptyCursor() }
  }

  async getMetaPostDetail(accountId: string, postId: string): Promise<PostVo> {
    this.warn('getMetaPostDetail', { accountId, postId })
    return {
      id: postId,
      platform: this.platform,
      title: '',
      content: '',
      medias: [],
      permalink: '',
      publishTime: 0,
      viewCount: 0,
      commentCount: 0,
      likeCount: 0,
      shareCount: 0,
      clickCount: 0,
      impressionCount: 0,
      favoriteCount: 0,
    }
  }

  async fetchPostComments(
    accountId: string,
    postId: string,
    _pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    this.warn('fetchPostComments', { accountId, postId })
    return { comments: [], cursor: this.emptyCursor() }
  }

  async fetchCommentReplies(
    accountId: string,
    commentId: string,
    _pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    this.warn('fetchCommentReplies', { accountId, commentId })
    return { comments: [], cursor: this.emptyCursor() }
  }

  async commentOnPost(
    accountId: string,
    postId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    this.warn('commentOnPost', { accountId, postId })
    return {
      success: false,
      error: `${this.platform} engagement is not supported yet (${this.unsupportedReason})`,
    }
  }

  async replyToComment(
    accountId: string,
    commentId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    this.warn('replyToComment', { accountId, commentId })
    return {
      success: false,
      error: `${this.platform} engagement is not supported yet (${this.unsupportedReason})`,
    }
  }
}
