import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { DouyinService } from '../../platforms/douyin/douyin.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 抖音 Engagement Provider — 接抖音开放平台 Comment API
 *
 * 端点：
 * - GET /api/douyin/v1/video/video_list/         自己的视频
 * - GET /api/douyin/v1/video/item_comment_list/  作品评论
 * - GET /api/douyin/v1/video/item_comment_reply_list/  评论的回复
 * - POST /api/douyin/v1/video/item_comment_reply/      回复评论
 *
 * 抖音平台限制：
 * 1. 第三方应用 **不允许** 在任意作品下发"顶级评论"。
 *    -> commentOnPost 总是返回 success=false（PlatformOperationNotSupported 语义）
 * 2. replyToComment 只在以下情况合法：
 *    a) 评论挂在自己作品下；或
 *    b) 评论 @ 了自己。
 *
 * 接口约束：EngagementProvider.replyToComment(commentId, message) 只传一个 id，
 * 但抖音 reply 端点需要 (open_id, item_id, comment_id) 三元组。
 * 折衷：fetchPostComments / fetchCommentReplies 阶段把 id 编码成
 * `${itemId}:${commentId}`，replyToComment 再解开。
 *
 * 这是抖音特有的折衷，未来若把 EngagementProvider 接口扩成支持 `extra` 字段，
 * 再去掉这层包装。详见 docs/rfcs/0001-platform-deepening.md §6.1。
 */
@Injectable()
export class DouyinEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(DouyinEngagementProvider.name)

  constructor(
    private readonly douyinService: DouyinService,
  ) {}

  private encodeCommentId(itemId: string, commentId: string) {
    return `${itemId}:${commentId}`
  }

  private decodeCommentId(composite: string): { itemId: string, commentId: string } | null {
    const idx = composite.indexOf(':')
    if (idx === -1) {
      this.logger.warn(`douyin commentId is not in "itemId:commentId" form: ${composite}`)
      return null
    }
    return {
      itemId: composite.slice(0, idx),
      commentId: composite.slice(idx + 1),
    }
  }

  async fetchUserPosts(
    accountId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<PostsResponseVo> {
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const limit = (pagination as KeysetPagination)?.limit || 20
    const resp = await this.douyinService.getVideoList(accountId, cursor, limit)

    return {
      posts: (resp.list ?? []).map(item => ({
        id: item.item_id,
        platform: 'douyin',
        title: item.title ?? '',
        content: item.title ?? '',
        medias: item.cover ? [{ url: item.cover, type: 'image' as const }] : [],
        permalink: item.share_url ?? '',
        publishTime: (item.create_time ?? 0) * 1000,
        viewCount: item.statistics?.play_count ?? 0,
        commentCount: item.statistics?.comment_count ?? 0,
        likeCount: item.statistics?.digg_count ?? 0,
        shareCount: item.statistics?.share_count ?? 0,
        clickCount: 0,
        impressionCount: 0,
        favoriteCount: 0,
      })),
      cursor: {
        before: '',
        after: resp.has_more ? String(resp.cursor) : '',
      },
    }
  }

  async getMetaPostDetail(_accountId: string, postId: string): Promise<PostVo> {
    // 抖音开放平台没有"按 itemId 单查作品 metadata"的端点；调用者请用
    // fetchUserPosts 拿到列表后在内存里挑出指定 id。这里返回一个空 PostVo
    // 以满足接口契约，并给上层一个明确的可观测信号。
    this.logger.warn(`getMetaPostDetail is a no-op on Douyin; returning empty PostVo for postId=${postId}`)
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

  async fetchPostComments(
    accountId: string,
    postId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const limit = (pagination as KeysetPagination)?.limit || 20

    const resp = await this.douyinService.getCommentList(accountId, postId, cursor, limit)

    const comments: EngagementComment[] = (resp.list ?? []).map(c => ({
      id: this.encodeCommentId(postId, c.comment_id),
      message: c.content,
      author: {
        username: c.nickname ?? c.comment_user_id,
        avatar: c.avatar,
      },
      createdAt: new Date(c.create_time * 1000).toISOString(),
      hasReplies: (c.reply_comment_total ?? 0) > 0,
    }))

    return {
      comments,
      cursor: {
        before: '',
        after: resp.has_more ? String(resp.cursor) : '',
      },
    }
  }

  async fetchCommentReplies(
    accountId: string,
    commentId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const decoded = this.decodeCommentId(commentId)
    if (!decoded) {
      return { comments: [], cursor: { before: '', after: '' } }
    }
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const limit = (pagination as KeysetPagination)?.limit || 20

    const resp = await this.douyinService.getCommentReplies(
      accountId,
      decoded.itemId,
      decoded.commentId,
      cursor,
      limit,
    )

    const comments: EngagementComment[] = (resp.list ?? []).map(c => ({
      id: this.encodeCommentId(decoded.itemId, c.comment_id),
      message: c.content,
      author: {
        username: c.nickname ?? c.comment_user_id,
        avatar: c.avatar,
      },
      createdAt: new Date(c.create_time * 1000).toISOString(),
      hasReplies: false,
    }))

    return {
      comments,
      cursor: {
        before: '',
        after: resp.has_more ? String(resp.cursor) : '',
      },
    }
  }

  async commentOnPost(
    _accountId: string,
    _postId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    // 抖音开放平台不允许第三方应用代发顶级评论（仅可 reply 到自己作品下的评论
    // 或 @ 了自己的评论）。明确告诉上层这条路在抖音上走不通。
    return {
      success: false,
      error: 'Douyin does not allow third-party apps to post top-level comments. Use replyToComment instead.',
    }
  }

  async replyToComment(
    accountId: string,
    commentId: string,
    message: string,
  ): Promise<PublishCommentResponse> {
    const decoded = this.decodeCommentId(commentId)
    if (!decoded) {
      return {
        success: false,
        error: 'Douyin commentId must be in "itemId:commentId" form (returned by fetchPostComments / fetchCommentReplies)',
      }
    }
    try {
      const resp = await this.douyinService.replyToComment(
        accountId,
        decoded.itemId,
        decoded.commentId,
        message,
      )
      return { id: resp.comment_id, success: true }
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.error(`douyin replyToComment failed for accountId=${accountId} commentId=${commentId}: ${msg}`)
      return { success: false, error: msg }
    }
  }
}
