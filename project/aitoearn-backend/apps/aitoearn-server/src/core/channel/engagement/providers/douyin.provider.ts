import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { DouyinService } from '../../platforms/douyin/douyin.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 抖音 Engagement Provider
 *
 * 抖音开放平台提供评论管理 API：
 * - GET /item/comment/list/ 获取视频评论列表
 * - POST /item/comment/reply/ 回复评论
 *
 * NOTE: 抖音评论 API 需要 `video.comment` scope，
 * 目前 OAuth 授权还没有请求该 scope，需要后续在 createAuthTask 里加上。
 * 此 provider 先按接口形状实现，等 scope 加好后即可直接工作。
 */
@Injectable()
export class DouyinEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(DouyinEngagementProvider.name)

  constructor(
    private readonly douyinService: DouyinService,
  ) {}

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // 抖音开放平台：GET /video/list/ (需要 video.list scope)
    // TODO: 接入 DouyinApiService.getVideoList 方法
    return { posts: [], cursor: { before: '', after: '' } }
  }

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    return {
      id: '',
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

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments called for accountId=${accountId}, postId=${postId}`)
    // 抖音开放平台：GET /item/comment/list/
    // TODO: 实现真实调用（需要 video.comment scope）
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchCommentReplies called for accountId=${accountId}, commentId=${commentId}`)
    // 抖音开放平台：GET /item/comment/reply/list/
    // TODO: 实现真实调用
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async commentOnPost(accountId: string, postId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`commentOnPost called for accountId=${accountId}, postId=${postId}, message length=${message.length}`)
    // 抖音开放平台：POST /item/comment/reply/ (top-level comment)
    // TODO: 实现真实调用
    return { success: false, error: 'Douyin comment API not yet wired — need video.comment scope' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment called for accountId=${accountId}, commentId=${commentId}, message length=${message.length}`)
    // 抖音开放平台：POST /item/comment/reply/
    // TODO: 实现真实调用
    return { success: false, error: 'Douyin comment API not yet wired — need video.comment scope' }
  }
}
