import { Injectable, Logger } from '@nestjs/common'
import { AccountType } from '@yikart/aitoearn-server-client'
import { AppException, PostsResponseVo, PostVo, ResponseCode } from '@yikart/common'
import { DouyinApiService } from '../../libs/douyin/douyin-api.service'
import { ChannelAccountService } from '../../platforms/channel-account.service'
import { DouyinService } from '../../platforms/douyin/douyin.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementComment, EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * 抖音 Engagement Provider
 *
 * 抖音开放平台对评论 API 有以下限制（在 libs/douyin/common.ts 顶部也有说明）：
 *   - 第三方应用 **不能** 主动在他人作品下发表"顶级评论"。
 *     -> commentOnPost 在抖音上抛 ResponseCode.PlatformOperationNotSupported
 *   - 允许 reply 评论，前提是:
 *       a) 该评论挂在自己作品下；或
 *       b) 评论里 @ 了自己。
 *
 * 由于 reply 端点需要 (open_id, item_id, comment_id) 三元组，但
 * EngagementProvider.replyToComment 的接口只传 commentId，所以
 * 我们在 fetchPostComments / fetchCommentReplies 阶段把 commentId
 * 编码成 `${itemId}:${commentId}`，replyToComment 再解开使用。
 *
 * 这是抖音平台特有的折衷，未来若把 EngagementProvider 接口扩成支持
 * `extra` 字段，可以拆开。详见 docs/rfcs/0001-platform-deepening.md §6.1。
 */
@Injectable()
export class DouyinEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(DouyinEngagementProvider.name)
  private readonly platform = AccountType.Douyin

  constructor(
    private readonly douyinService: DouyinService,
    private readonly douyinApiService: DouyinApiService,
    private readonly channelAccountService: ChannelAccountService,
  ) {}

  private async getOpenIdAndToken(accountId: string) {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (!account)
      throw new AppException(ResponseCode.ChannelAccountNotFound)
    const accessToken = await this.douyinService.getAccountAccessToken(accountId)
    return { openId: account.uid, accessToken }
  }

  /** EngagementProvider 用 commentId 复合编码 itemId:commentId */
  private encodeCommentId(itemId: string, commentId: string) {
    return `${itemId}:${commentId}`
  }

  private decodeCommentId(composite: string): { itemId: string, commentId: string } {
    const idx = composite.indexOf(':')
    if (idx === -1) {
      throw new AppException(ResponseCode.ValidationFailed, {
        field: 'commentId',
        message: `douyin commentId must be encoded as "itemId:commentId", got "${composite}"`,
      })
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
    const { openId, accessToken } = await this.getOpenIdAndToken(accountId)
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const limit = (pagination as KeysetPagination)?.limit || 20
    const resp = await this.douyinApiService.getVideoList(
      accessToken,
      openId,
      cursor,
      limit,
    )

    return {
      posts: (resp.list ?? []).map(item => ({
        id: item.item_id,
        platform: 'douyin',
        title: item.title ?? '',
        content: item.title ?? '',
        medias: item.cover ? [{ url: item.cover, type: 'image' as const }] : [],
        permalink: item.share_url ?? '',
        publishTime: item.create_time ?? 0,
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

  async getMetaPostDetail(_accountId: string, _postId: string): Promise<PostVo> {
    // 抖音 Display API 不提供单作品 metadata 端点；fetchUserPosts 已包含
    // 等价信息。如果上层需要单帖详情，请用 fetchUserPosts 后在本地过滤。
    this.logger.warn('getMetaPostDetail not supported on Douyin; returning empty PostVo')
    return {
      id: _postId,
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
    const { openId, accessToken } = await this.getOpenIdAndToken(accountId)
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const limit = (pagination as KeysetPagination)?.limit || 20

    const resp = await this.douyinApiService.getCommentList(
      accessToken,
      openId,
      postId,
      cursor,
      limit,
    )

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
        limit,
      } as KeysetPagination,
    }
  }

  async fetchCommentReplies(
    accountId: string,
    commentId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    const { openId, accessToken } = await this.getOpenIdAndToken(accountId)
    const { itemId, commentId: rawCommentId } = this.decodeCommentId(commentId)
    const cursor = Number((pagination as KeysetPagination)?.after) || 0
    const limit = (pagination as KeysetPagination)?.limit || 20

    const resp = await this.douyinApiService.getCommentReplies(
      accessToken,
      openId,
      itemId,
      rawCommentId,
      cursor,
      limit,
    )

    const comments: EngagementComment[] = (resp.list ?? []).map(c => ({
      id: this.encodeCommentId(itemId, c.comment_id),
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
        limit,
      } as KeysetPagination,
    }
  }

  async commentOnPost(
    _accountId: string,
    _postId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    // 抖音开放平台禁止第三方代发顶级评论
    return {
      success: false,
      error: 'Douyin Open Platform does not allow third-party apps to post top-level comments. Use replyToComment instead.',
    }
  }

  async replyToComment(
    accountId: string,
    commentId: string,
    message: string,
  ): Promise<PublishCommentResponse> {
    const { openId, accessToken } = await this.getOpenIdAndToken(accountId)
    const { itemId, commentId: rawCommentId } = this.decodeCommentId(commentId)

    try {
      const resp = await this.douyinApiService.replyToComment(
        accessToken,
        openId,
        itemId,
        rawCommentId,
        message,
      )
      return {
        id: resp.comment_id,
        success: true,
      }
    }
    catch (e) {
      this.logger.error(`douyin replyToComment failed for accountId=${accountId} commentId=${commentId}: ${(e as Error).message}`)
      return {
        success: false,
        error: (e as Error).message,
      }
    }
  }
}
