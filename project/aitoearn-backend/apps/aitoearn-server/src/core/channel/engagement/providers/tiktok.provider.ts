import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { TiktokService } from '../../platforms/tiktok/tiktok.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * TikTok Engagement Provider
 *
 * TikTok Display API:
 * - GET /v2/video/list/ (用户视频列表)
 * - GET /v2/comment/list/ (视频评论列表 — 需要 comment.list scope)
 * - POST /v2/comment/reply/ (回复评论 — 需要 comment.list.manage scope)
 *
 * NOTE: TikTok 的评论 API 只对部分开发者开放（需审核）。
 * 本 provider 按接口形状实现骨架，后续评论 scope 审批通过后填入真实调用。
 */
@Injectable()
export class TiktokEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(TiktokEngagementProvider.name)

  constructor(
    private readonly tiktokService: TiktokService,
  ) {}

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // TikTok: GET /v2/video/list/ (已有 getUserVideos)
    // TODO: 适配为 PostsResponseVo 格式
    return { posts: [], cursor: { before: '', after: '' } }
  }

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    return {
      id: '',
      platform: 'tiktok',
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

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments called for accountId=${accountId}, postId=${postId}`)
    // TikTok: GET /v2/comment/list/ (需要 comment.list scope)
    // TODO: 实现真实调用
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchCommentReplies called for accountId=${accountId}, commentId=${commentId}`)
    // TikTok: GET /v2/comment/list/ with parent_comment_id
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async commentOnPost(accountId: string, postId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`commentOnPost called for accountId=${accountId}, postId=${postId}, message length=${message.length}`)
    // TikTok: POST /v2/comment/reply/ (top-level)
    return { success: false, error: 'TikTok comment API requires comment.list.manage scope — not yet approved' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment called for accountId=${accountId}, commentId=${commentId}, message length=${message.length}`)
    // TikTok: POST /v2/comment/reply/
    return { success: false, error: 'TikTok comment API requires comment.list.manage scope — not yet approved' }
  }
}
