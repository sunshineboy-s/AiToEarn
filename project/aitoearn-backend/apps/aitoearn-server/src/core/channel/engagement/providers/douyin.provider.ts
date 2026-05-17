import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { DouyinService } from '../../platforms/douyin/douyin.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 抖音 Engagement Provider
 *
 * 抖音开放平台支持的互动能力：
 * - /item/comment/list/ — 获取视频评论列表
 * - /item/comment/reply/list/ — 获取评论的回复列表
 * - /item/comment/reply/ — 回复评论
 *
 * NOTE: 发布顶级评论（commentOnPost）抖音开放平台暂不支持，
 * 此处留占位返回 success: false。
 *
 * @see https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/interaction-management/comment-management-user/comment-list
 */
@Injectable()
export class DouyinEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(DouyinEngagementProvider.name)

  constructor(
    private readonly douyinService: DouyinService,
  ) {}

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    // 抖音无 Meta-style post detail 端点，返回空壳
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

  async fetchUserPosts(accountId: string, _pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    this.logger.log(`fetchUserPosts called for accountId=${accountId}`)
    // TODO: 接 /video/list/ 端点获取作者视频列表
    return {
      posts: [],
      cursor: { before: '', after: '' },
    }
  }

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.log(`fetchPostComments accountId=${accountId} postId=${postId}`)
    // TODO: 接 /item/comment/list/
    // 需要 access_token + open_id + item_id + cursor + count
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
    // TODO: 接 /item/comment/reply/list/
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
    // 抖音开放平台不支持主动发布顶级评论
    return { success: false, error: 'Douyin Open API does not support posting top-level comments' }
  }

  async replyToComment(accountId: string, commentId: string, message: string): Promise<PublishCommentResponse> {
    this.logger.log(`replyToComment accountId=${accountId} commentId=${commentId} message=${message}`)
    // TODO: 接 /item/comment/reply/
    // 需要 access_token + open_id + item_id + comment_id + content
    return { success: false, error: 'Not yet implemented — awaiting /item/comment/reply/ integration' }
  }
}
