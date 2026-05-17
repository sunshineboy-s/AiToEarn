import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 小红书 Engagement Provider
 *
 * ⚠️ 小红书没有官方开放平台的互动 API。
 * 所有评论读取/发布能力需要通过浏览器自动化或 cookie 注入实现。
 *
 * 本 provider 当前是接口占位。真正实现需要：
 * 1. BrowserAutomationModule (Playwright) 支撑
 * 2. 单独的安全评审 & 反爬维护策略
 *
 * 一旦 BrowserAutomationModule (P1) 就绪，可在此填充：
 * - fetchPostComments: 通过 cookie + /api/sns/web/v2/comment/page 获取
 * - replyToComment: 通过 cookie + /api/sns/web/v1/comment/post 发布
 */
@Injectable()
export class XiaohongshuEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(XiaohongshuEngagementProvider.name)

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    return {
      id: '',
      platform: 'xiaohongshu',
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
    // TODO: 需要 BrowserAutomationModule
    return {
      posts: [],
      cursor: { before: '', after: '' },
    }
  }

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments accountId=${accountId} postId=${postId}`)
    // TODO: cookie + /api/sns/web/v2/comment/page
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
    // TODO: cookie + /api/sns/web/v2/comment/sub/page
    const comments: EngagementComment[] = []
    return {
      comments,
      cursor: {
        before: '',
        after: (pagination as KeysetPagination)?.after || '',
      },
    }
  }

  async commentOnPost(accountId: string, postId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`commentOnPost accountId=${accountId} postId=${postId} message=${message}`)
    // TODO: cookie + /api/sns/web/v1/comment/post
    return { success: false, error: 'Not yet implemented — requires BrowserAutomationModule (P1)' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment accountId=${accountId} commentId=${commentId} message=${message}`)
    // TODO: cookie + /api/sns/web/v1/comment/post (with target_comment_id)
    return { success: false, error: 'Not yet implemented — requires BrowserAutomationModule (P1)' }
  }
}
