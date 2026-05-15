import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { DouyinCommentItem } from '../../libs/douyin/common'
import { DouyinService } from '../../platforms/douyin/douyin.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import {
  EngagementComment,
  EngagementProvider,
  FetchPostCommentsResponse,
  PublishCommentResponse,
} from '../engagement.interface'

/**
 * Composite id format used to carry both `itemId` and `commentId` through
 * the EngagementProvider interface, which currently only takes `commentId`.
 *
 * Douyin Open Platform requires `item_id` on both reply-list and reply-create
 * endpoints. YouTube and Meta do not, so the upstream interface only exposes
 * a single id slot. To stay within the existing contract, we encode the
 * tuple as `${itemId}:${commentId}` for any "reply to comment" call.
 *
 * Callers of `fetchCommentReplies` / `replyToComment` for douyin MUST pass
 * a composite id. The provider returns composite ids for replies as well,
 * so they can be reused on subsequent calls.
 *
 * If/when the EngagementProvider interface gains a per-platform context
 * object, this composite encoding goes away. Until then this is the
 * least-magical way to carry the second id.
 */
const COMPOSITE_SEPARATOR = ':'

function encodeReplyId(itemId: string, commentId: string): string {
  return `${itemId}${COMPOSITE_SEPARATOR}${commentId}`
}

function decodeReplyId(composite: string): { itemId: string, commentId: string } | null {
  const idx = composite.indexOf(COMPOSITE_SEPARATOR)
  if (idx <= 0 || idx === composite.length - 1) {
    return null
  }
  return {
    itemId: composite.slice(0, idx),
    commentId: composite.slice(idx + 1),
  }
}

const DEFAULT_COMMENT_PAGE_SIZE = 20
const MAX_COMMENT_PAGE_SIZE = 50

function adaptComment(item: DouyinCommentItem, itemId: string): EngagementComment {
  return {
    id: itemId
      ? encodeReplyId(itemId, item.comment_id)
      : item.comment_id,
    message: item.content || '',
    author: {
      username: item.nickname || item.comment_user_id || 'Unknown',
      avatar: item.avatar || '',
    },
    createdAt: item.create_time
      ? new Date(item.create_time * 1000).toISOString()
      : '',
    hasReplies: (item.reply_comment_total || 0) > 0,
  }
}

/**
 * Douyin Engagement Provider — real impl over Open Platform comment APIs.
 *
 * Capability matrix:
 *   - fetchUserPosts        unsupported    Open Platform `archive/viewlist`
 *                                          is stubbed in DouyinApiService;
 *                                          will light up automatically once
 *                                          that stub is replaced with a real
 *                                          call.
 *   - getMetaPostDetail     unsupported    Same reason.
 *   - fetchPostComments     real           data/external/item/comment/list/
 *   - fetchCommentReplies   real           data/external/item/reply/list/
 *                                          Composite id required.
 *   - commentOnPost         unsupported    Open Platform exposes NO top-level
 *                                          comment write at user scope.
 *   - replyToComment        real           api/douyin/v1/video/create_comment_reply/
 *                                          Composite id required.
 *
 * NOTE on testing posture: the underlying API methods are wired to real
 * Douyin Open Platform endpoints with the same axios + structured-error
 * pattern as the existing `getAccountInfo` flow, but they have NOT been
 * verified against a live corp account in this repo. The first deploy
 * with comment scopes provisioned should run a smoke test before this
 * provider is relied upon in production paths.
 */
@Injectable()
export class DouyinEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(DouyinEngagementProvider.name)

  constructor(
    private readonly douyinService: DouyinService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // Unsupported branches — return honest stubs with structured logs,
  // matching the BaseUnsupportedEngagementProvider contract.
  // ──────────────────────────────────────────────────────────────────

  async fetchUserPosts(
    accountId: string,
    _pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<PostsResponseVo> {
    this.logger.warn({
      path: 'douyin.fetchUserPosts.unsupported',
      reason: 'DouyinApiService.archive list is still stubbed',
      accountId,
    })
    return { posts: [], cursor: { before: '', after: '' } }
  }

  async getMetaPostDetail(accountId: string, postId: string): Promise<PostVo> {
    this.logger.warn({
      path: 'douyin.getMetaPostDetail.unsupported',
      reason: 'DouyinApiService.getArcStat is still stubbed',
      accountId,
      postId,
    })
    return {
      id: postId,
      platform: 'douyin',
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

  async commentOnPost(
    accountId: string,
    postId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    this.logger.warn({
      path: 'douyin.commentOnPost.unsupported',
      reason: 'Douyin Open Platform exposes no top-level comment write at user scope',
      accountId,
      postId,
    })
    return {
      success: false,
      error: 'Douyin Open Platform does not allow posting top-level comments via API. Only reply-to-comment is supported.',
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Real branches — Open Platform comment APIs.
  // ──────────────────────────────────────────────────────────────────

  async fetchPostComments(
    accountId: string,
    postId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const keyset = pagination as KeysetPagination | null
    const cursor = keyset?.after || '0'
    const count = Math.min(
      keyset?.limit ?? DEFAULT_COMMENT_PAGE_SIZE,
      MAX_COMMENT_PAGE_SIZE,
    )

    let res
    try {
      res = await this.douyinService.listItemComments(
        accountId,
        postId,
        cursor,
        count,
      )
    }
    catch (err) {
      this.logger.error({
        path: 'douyin.fetchPostComments.api',
        accountId,
        postId,
        cursor,
        count,
        err,
      })
      throw err
    }

    const comments = (res.list || []).map(item => adaptComment(item, postId))
    return {
      comments,
      cursor: {
        before: '',
        after: res.has_more ? String(res.cursor) : '',
      },
    }
  }

  async fetchCommentReplies(
    accountId: string,
    commentId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const decoded = decodeReplyId(commentId)
    if (!decoded) {
      this.logger.warn({
        path: 'douyin.fetchCommentReplies.invalidId',
        reason: 'commentId must be in `itemId:commentId` form for douyin',
        accountId,
        commentId,
      })
      return { comments: [], cursor: { before: '', after: '' } }
    }

    const keyset = pagination as KeysetPagination | null
    const cursor = keyset?.after || '0'
    const count = Math.min(
      keyset?.limit ?? DEFAULT_COMMENT_PAGE_SIZE,
      MAX_COMMENT_PAGE_SIZE,
    )

    let res
    try {
      res = await this.douyinService.listCommentReplies(
        accountId,
        decoded.itemId,
        decoded.commentId,
        cursor,
        count,
      )
    }
    catch (err) {
      this.logger.error({
        path: 'douyin.fetchCommentReplies.api',
        accountId,
        commentId,
        cursor,
        count,
        err,
      })
      throw err
    }

    const comments = (res.list || []).map(item =>
      adaptComment(item, decoded.itemId),
    )
    return {
      comments,
      cursor: {
        before: '',
        after: res.has_more ? String(res.cursor) : '',
      },
    }
  }

  async replyToComment(
    accountId: string,
    commentId: string,
    message: string,
  ): Promise<PublishCommentResponse> {
    const decoded = decodeReplyId(commentId)
    if (!decoded) {
      this.logger.warn({
        path: 'douyin.replyToComment.invalidId',
        reason: 'commentId must be in `itemId:commentId` form for douyin',
        accountId,
        commentId,
      })
      return {
        success: false,
        error: 'Douyin replyToComment requires a composite `itemId:commentId` value',
      }
    }

    try {
      const res = await this.douyinService.createCommentReply(
        accountId,
        decoded.itemId,
        decoded.commentId,
        message,
      )
      if (!res?.comment_id) {
        return {
          success: false,
          error: 'Douyin reply did not return a comment_id',
        }
      }
      return {
        id: encodeReplyId(decoded.itemId, res.comment_id),
        success: true,
      }
    }
    catch (err) {
      this.logger.error({
        path: 'douyin.replyToComment.api',
        accountId,
        commentId,
        err,
      })
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
