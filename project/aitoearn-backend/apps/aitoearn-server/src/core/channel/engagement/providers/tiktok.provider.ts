import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { TiktokService } from '../../platforms/tiktok/tiktok.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * TikTok Engagement Provider
 *
 * TikTok 的评论能力通过 Display API v2 / Research API 提供：
 * - /v2/video/list/ — 获取用户视频
 * - /v2/video/comment/list/ — 获取视频评论（需要 research API scope）
 * - /v2/video/comment/reply/list/ — 获取评论回复
 *
 * NOTE: 评论读取需要 Research API 权限（仅对学术/商业合作伙伴开放）。
 * 发布评论/回复目前 TikTok 官方 API 不支持。
 *
 * @see https://developers.tiktok.com/doc/research-api-specs-query-videos/
 */
@Injectable()
export class TiktokEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(TiktokEngagementProvider.name)

  constructor(
    private readonly tiktokService: TiktokService,
  ) {}

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

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // TODO: 接 /v2/video/list/ with fields
    return {
      posts: [],
      cursor: { before: '', after: '' },
    }
  }

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments accountId=${accountId} postId=${postId}`)
    // TODO: 需要 Research API scope — /v2/video/comment/list/
    const comments: EngagementComment[] = []
    return {
      comments,
      cursor: {
        before: '',
        after: (pagination as KeysetPagination)?.after || '',
      },
    }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchCommentReplies accountId=${accountId} commentId=${commentId}`)
    // TODO: /v2/video/comment/reply/list/
    const comments: EngagementComment[] = []
    return {
      comments,
      cursor: {
        before: '',
        after: (pagination as KeysetPagination)?.after || '',
      },
    }
  }

  async commentOnPost(_accountId: string, _postId: string, _message: string): Promise<PublishCommentResponse> {
    // TikTok API 不支持通过 API 发布评论
    return { success: false, error: 'TikTok API does not support posting comments programmatically' }
  }

  async replyToComment(_accountId: string, _commentId: string, _message: string): Promise<PublishCommentResponse> {
    // TikTok API 不支持通过 API 回复评论
    return { success: false, error: 'TikTok API does not support replying to comments programmatically' }
  }
}
