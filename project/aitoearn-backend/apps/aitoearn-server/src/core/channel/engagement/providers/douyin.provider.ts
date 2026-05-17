import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { DouyinService } from '../../platforms/douyin/douyin.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 抖音 Engagement Provider
 *
 * 抖音开放平台支持的互动能力：
 * - GET  /api/douyin/v1/video/comment_list/        获取视频评论列表
 * - GET  /api/douyin/v1/video/comment_reply_list/  获取评论的回复列表
 * - POST /api/douyin/v1/video/comment_reply/       回复评论
 *
 * 关于 EngagementProvider 接口与抖音的不匹配点：
 * 抖音回复评论接口需要 `(item_id, comment_id)` 二元组，而本接口只传单个
 * `commentId`。我们用 `{itemId}:{commentId}` 复合编码绕过 — 所有从
 * fetchPostComments 出去的 comment.id 都已带前缀，replyToComment 拿到时再解。
 *
 * 顶级评论（自由发表）：抖音开放平台不开放给第三方应用，commentOnPost
 * 显式返回 success=false。
 *
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/douyin-v2/comment/get-comment-list
 */
@Injectable()
export class DouyinEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(DouyinEngagementProvider.name)

  constructor(
    private readonly douyinService: DouyinService,
  ) {}

  /** Encode (itemId, commentId) into a single string the EngagementProvider interface allows. */
  private encodeCommentId(itemId: string, commentId: string): string {
    return `${itemId}:${commentId}`
  }

  /** Decode the composite id; returns null if format is wrong. */
  private decodeCommentId(composite: string): { itemId: string, commentId: string } | null {
    const idx = composite.indexOf(':')
    if (idx <= 0 || idx === composite.length - 1)
      return null
    return {
      itemId: composite.slice(0, idx),
      commentId: composite.slice(idx + 1),
    }
  }

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    // 抖音开放平台没有等价的"单作品 metadata"端点，返回空壳
    return {
      id: _postId,
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

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.warn(`fetchUserPosts not yet wired for douyin accountId=${accountId} — needs /video/list/`)
    return {
      posts: [],
      cursor: { before: '', after: '' },
    }
  }

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const count = (pagination as KeysetPagination)?.limit || 20

    const res = await this.douyinService.getCommentList(accountId, postId, cursor, count)
    const comments: EngagementComment[] = res.list.map(c => ({
      id: this.encodeCommentId(postId, c.comment_id),
      message: c.content,
      author: { username: c.comment_user_id },
      createdAt: new Date((c.create_time || 0) * 1000).toISOString(),
      hasReplies: (c.reply_comment_total ?? 0) > 0,
    }))
    return {
      comments,
      cursor: {
        before: '',
        after: res.has_more ? String(res.cursor) : '',
      },
    }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    const decoded = this.decodeCommentId(commentId)
    if (!decoded) {
      this.logger.warn(`fetchCommentReplies received un-encoded commentId=${commentId}; douyin requires "{itemId}:{commentId}"`)
      return { comments: [], cursor: { before: '', after: '' } }
    }
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const count = (pagination as KeysetPagination)?.limit || 20

    const res = await this.douyinService.getCommentReplyList(
      accountId,
      decoded.itemId,
      decoded.commentId,
      cursor,
      count,
    )
    const comments: EngagementComment[] = res.list.map(c => ({
      id: this.encodeCommentId(decoded.itemId, c.comment_id),
      message: c.content,
      author: { username: c.comment_user_id },
      createdAt: new Date((c.create_time || 0) * 1000).toISOString(),
      hasReplies: false,
    }))
    return {
      comments,
      cursor: {
        before: '',
        after: res.has_more ? String(res.cursor) : '',
      },
    }
  }

  async commentOnPost(_accountId: string, _postId: string, _message: string): Promise<PublishCommentResponse> {
    return {
      success: false,
      error: 'Douyin open platform does not allow third-party apps to post top-level comments. Use replyToComment on an existing thread instead.',
    }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    const decoded = this.decodeCommentId(commentId)
    if (!decoded) {
      return {
        success: false,
        error: 'douyin commentId must be formatted as "{itemId}:{commentId}". Did you call fetchPostComments first?',
      }
    }
    try {
      const res = await this.douyinService.replyComment(
        accountId,
        decoded.itemId,
        decoded.commentId,
        message,
      )
      return { id: res.comment_id, success: true }
    }
    catch (e) {
      this.logger.error(`douyin replyToComment failed accountId=${accountId} commentId=${commentId}: ${(e as Error).message}`)
      return { success: false, error: (e as Error).message }
    }
  }
}
