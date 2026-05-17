import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { BilibiliService } from '../../platforms/bilibili/bilibili.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * B站 Engagement Provider
 *
 * B站创作者开放平台能力：
 * - /x/v2/reply — 获取评论列表
 * - /x/v2/reply/reply — 获取评论回复
 * - /x/v2/reply/add — 发布评论/回复
 *
 * NOTE: B站的创作者开放平台部分接口需要通过浏览器 cookie 认证，
 * 具体接入取决于 BilibiliApiService 的 auth 能力。
 *
 * @see https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/comment/list.md
 */
@Injectable()
export class BilibiliEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(BilibiliEngagementProvider.name)

  constructor(
    private readonly bilibiliService: BilibiliService,
  ) {}

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

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // TODO: 接 B站 /x/space/wbi/arc/search 获取用户投稿列表
    return {
      posts: [],
      cursor: { before: '', after: '' },
    }
  }

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments accountId=${accountId} postId=${postId}`)
    // TODO: 接 /x/v2/reply?type=1&oid={aid}&pn=X&ps=20
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
    // TODO: 接 /x/v2/reply/reply?type=1&oid={aid}&root={rpid}&pn=X
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
    // TODO: 接 /x/v2/reply/add type=1&oid={aid}&message={message}
    return { success: false, error: 'Not yet implemented — awaiting B站 reply/add integration' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment accountId=${accountId} commentId=${commentId} message=${message}`)
    // TODO: 接 /x/v2/reply/add type=1&oid={aid}&root={rpid}&parent={rpid}&message={message}
    return { success: false, error: 'Not yet implemented — awaiting B站 reply/add integration' }
  }
}
