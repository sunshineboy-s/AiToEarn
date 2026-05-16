import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 小红书 Engagement Provider
 *
 * 小红书没有官方开放平台 API，所有评论操作需要：
 * - 浏览器自动化（Playwright）抓取评论列表
 * - 或者 cookie-based 私有 API（维护成本高）
 *
 * 本 provider 先按接口形状实现骨架。真实调用等 BrowserAutomationModule 就绪后接入。
 * 评论挖掘（识别"求链接""怎么买"等信号）会在 EngagementService 层统一做，
 * provider 只负责 CRUD。
 */
@Injectable()
export class XiaohongshuEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(XiaohongshuEngagementProvider.name)

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // XHS: 私有 API /api/sns/web/v1/user_posted
    // TODO: 需要 cookie + x-s 签名
    return { posts: [], cursor: { before: '', after: '' } }
  }

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

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments called for accountId=${accountId}, postId=${postId}`)
    // XHS: 私有 API /api/sns/web/v2/comment/page
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchCommentReplies called for accountId=${accountId}, commentId=${commentId}`)
    // XHS: 私有 API /api/sns/web/v2/comment/sub/page
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async commentOnPost(accountId: string, postId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`commentOnPost called for accountId=${accountId}, postId=${postId}, message length=${message.length}`)
    // XHS: POST /api/sns/web/v1/comment/post
    return { success: false, error: 'Xiaohongshu comment API requires browser automation — not yet wired' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment called for accountId=${accountId}, commentId=${commentId}, message length=${message.length}`)
    return { success: false, error: 'Xiaohongshu comment API requires browser automation — not yet wired' }
  }
}
