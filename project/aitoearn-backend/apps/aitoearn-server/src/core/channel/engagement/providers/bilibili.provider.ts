import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { BilibiliService } from '../../platforms/bilibili/bilibili.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * Bilibili Engagement Provider
 *
 * B 站评论 API:
 * - GET https://api.bilibili.com/x/v2/reply?type=1&oid={aid}&pn={page}&ps=20
 * - POST https://api.bilibili.com/x/v2/reply/add (发表评论/回复)
 *
 * NOTE: B 站 OAuth 不提供这些端点——它们是 cookie-based web API。
 * 本 provider 按接口形状实现骨架，真实调用需要 BrowserAutomationModule
 * 或者用户登录态 cookie（从 Electron 端同步）。
 */
@Injectable()
export class BilibiliEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(BilibiliEngagementProvider.name)

  constructor(
    private readonly bilibiliService: BilibiliService,
  ) {}

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // B站：GET /x/space/arc/search (需要 cookie)
    // TODO: 接入视频列表
    return { posts: [], cursor: { before: '', after: '' } }
  }

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    return {
      id: '',
      platform: 'bilibili',
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
    // B站：GET /x/v2/reply?type=1&oid={aid}
    // TODO: 需要 cookie 或 wbi 签名
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchCommentReplies called for accountId=${accountId}, commentId=${commentId}`)
    // B站：GET /x/v2/reply/reply?type=1&oid={aid}&root={rpid}
    void pagination
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async commentOnPost(accountId: string, postId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`commentOnPost called for accountId=${accountId}, postId=${postId}, message length=${message.length}`)
    // B站：POST /x/v2/reply/add (需要 csrf + cookie)
    return { success: false, error: 'Bilibili comment API requires cookie auth — not yet wired' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment called for accountId=${accountId}, commentId=${commentId}, message length=${message.length}`)
    return { success: false, error: 'Bilibili comment API requires cookie auth — not yet wired' }
  }
}
