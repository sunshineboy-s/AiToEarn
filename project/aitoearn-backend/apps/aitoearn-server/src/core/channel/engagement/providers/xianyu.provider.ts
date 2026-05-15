import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { XianyuService } from '../../platforms/xianyu/xianyu.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 闲鱼（Xianyu）的 Engagement Provider。
 *
 * 与传统社交平台不同，闲鱼的"作品"是商品（item），"评论"是商品下的留言。
 * 这里把闲鱼概念映射到通用 Engagement 模型：
 *
 *   item        ↔ post
 *   message     ↔ comment
 *   message reply ↔ comment reply
 *
 * 适用账号：仅 Relay 账号会真正调用接口；本地 OAuth 账号一律返回空结果，
 * 写操作（commentOnPost / replyToComment）会抛 XianyuOAuthUnsupported。
 */
@Injectable()
export class XianyuEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(XianyuEngagementProvider.name)

  constructor(
    private readonly xianyuService: XianyuService,
  ) {}

  async fetchUserPosts(
    accountId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<PostsResponseVo> {
    const limit = (pagination as KeysetPagination)?.limit || 50
    const cursor = (pagination as KeysetPagination)?.after || undefined
    const page = await this.xianyuService.listItems(accountId, cursor, limit)

    const posts = page.list.map(item => ({
      id: item.itemId,
      platform: 'xianyu',
      title: item.title,
      content: '',
      medias: item.imageUrls.map(url => ({
        url,
        type: 'image' as const,
      })),
      permalink: item.workLink,
      publishTime: item.publishTime ? new Date(item.publishTime).getTime() : 0,
      viewCount: item.viewCount || 0,
      commentCount: item.commentCount || 0,
      likeCount: item.likeCount || 0,
      shareCount: 0,
      clickCount: 0,
      impressionCount: 0,
      favoriteCount: item.favoriteCount || 0,
    }))

    return {
      posts,
      cursor: {
        before: '',
        after: page.nextCursor || '',
      } as KeysetPagination,
    }
  }

  /**
   * 闲鱼商品详情：复用 XianyuService.getWorkDetail。
   * 不存在 / 不可用时返回空 PostVo（与 YouTube provider 行为一致）。
   */
  async getMetaPostDetail(accountId: string, postId: string): Promise<PostVo> {
    const empty: PostVo = {
      id: postId,
      platform: 'xianyu',
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
    const detail = await this.xianyuService.getWorkDetail(accountId, postId)
    if (!detail) {
      return empty
    }
    const medias = (detail.imgUrlList || [])
      .filter((url): url is string => !!url)
      .map(url => ({ url, type: 'image' as const }))
    if (detail.videoUrl) {
      medias.unshift({ url: detail.videoUrl, type: 'image' as const })
    }
    // 如果有商品维度统计就并进来
    const stats = await this.xianyuService.getItemStats(accountId, postId)
    return {
      id: detail.dataId,
      platform: 'xianyu',
      title: detail.title || '',
      content: detail.desc || '',
      medias,
      permalink: `https://www.goofish.com/item?id=${encodeURIComponent(detail.dataId)}`,
      publishTime: detail.publishTime ? detail.publishTime.getTime() : 0,
      viewCount: stats.viewCount,
      commentCount: stats.commentCount,
      likeCount: stats.likeCount,
      shareCount: stats.shareCount,
      clickCount: 0,
      impressionCount: 0,
      favoriteCount: stats.favoriteCount,
    }
  }

  async fetchPostComments(
    accountId: string,
    postId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const limit = (pagination as KeysetPagination)?.limit || 50
    const cursor = (pagination as KeysetPagination)?.after || undefined
    const page = await this.xianyuService.listItemMessages(accountId, postId, cursor, limit)

    const comments: EngagementComment[] = page.list.map(m => ({
      id: m.id,
      message: m.content,
      author: {
        username: m.author.nickname || m.author.userId,
        avatar: m.author.avatar,
      },
      createdAt: m.createdAt,
      hasReplies: m.hasReplies,
    }))
    return {
      comments,
      cursor: {
        before: '',
        after: page.nextCursor || '',
      },
    }
  }

  async fetchCommentReplies(
    accountId: string,
    commentId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const limit = (pagination as KeysetPagination)?.limit || 50
    const cursor = (pagination as KeysetPagination)?.after || undefined
    const page = await this.xianyuService.listMessageReplies(accountId, commentId, cursor, limit)

    const comments: EngagementComment[] = page.list.map(m => ({
      id: m.id,
      message: m.content,
      author: {
        username: m.author.nickname || m.author.userId,
        avatar: m.author.avatar,
      },
      createdAt: m.createdAt,
      hasReplies: false,
    }))
    return {
      comments,
      cursor: {
        before: '',
        after: page.nextCursor || '',
      },
    }
  }

  async commentOnPost(
    accountId: string,
    postId: string,
    message: string,
  ): Promise<PublishCommentResponse> {
    try {
      const result = await this.xianyuService.publishItemMessage(accountId, postId, message)
      return { id: result.id, success: true }
    }
    catch (err) {
      const errMsg = (err as Error).message
      this.logger.warn(`xianyu commentOnPost failed: ${errMsg}`)
      return { success: false, error: errMsg }
    }
  }

  async replyToComment(
    accountId: string,
    commentId: string,
    message: string,
  ): Promise<PublishCommentResponse> {
    try {
      const result = await this.xianyuService.replyToItemMessage(accountId, commentId, message)
      return { id: result.id, success: true }
    }
    catch (err) {
      const errMsg = (err as Error).message
      this.logger.warn(`xianyu replyToComment failed: ${errMsg}`)
      return { success: false, error: errMsg }
    }
  }
}
