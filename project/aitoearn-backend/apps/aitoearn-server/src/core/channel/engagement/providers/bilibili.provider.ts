import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { ArchiveListItem, ArchiveStatus, ArcStatData } from '../../libs/bilibili/common'
import { BilibiliService } from '../../platforms/bilibili/bilibili.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import {
  EngagementProvider,
  FetchPostCommentsResponse,
  PublishCommentResponse,
} from '../engagement.interface'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

/**
 * Bilibili Engagement Provider
 *
 * 能力矩阵（基于 Bilibili Open Platform 已开放的能力）：
 * - ✅ fetchUserPosts        — `archive/viewlist` + 每条 `arc/stat` 富化
 * - ✅ getMetaPostDetail     — `arc/stat`
 * - ❌ fetchPostComments     — Open Platform 未开放评论列表 scope
 * - ❌ fetchCommentReplies   — 同上
 * - ❌ commentOnPost / replyToComment — 同上
 *
 * 评论相关需要等 Bilibili 开放 `ATC_COMMENT` 或类似 scope；目前仅在
 * 站内 Web API（带 cookie 抓取）才能拿到，不在本 Open Platform 路线内。
 * 详见 RFC docs/rfcs/0001-platform-deepening.md §6.4。
 */
@Injectable()
export class BilibiliEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(BilibiliEngagementProvider.name)

  constructor(
    private readonly bilibiliService: BilibiliService,
  ) {}

  async fetchUserPosts(
    accountId: string,
    pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<PostsResponseVo> {
    const offsetPagination = pagination as OffsetPagination | null
    const pn = offsetPagination?.pageNo ?? 1
    const ps = Math.min(
      offsetPagination?.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    )

    let archives: ArchiveListItem[] = []
    try {
      const list = await this.bilibiliService.getArchiveList(accountId, {
        pn,
        ps,
        status: ArchiveStatus.pubed,
      })
      archives = list?.list ?? []
    }
    catch (err) {
      this.logger.error({
        path: 'bilibili.fetchUserPosts.getArchiveList',
        accountId,
        pn,
        ps,
        err,
      })
      return { posts: [], cursor: { before: '', after: '' } }
    }

    if (archives.length === 0) {
      return { posts: [], cursor: { before: '', after: '' } }
    }

    // ArchiveListItem 不包含 stat，按需逐个拉 arc/stat 富化。
    // 单次失败不应影响整页：使用 allSettled，失败的条目以 0 填充并打日志。
    const statResults = await Promise.allSettled(
      archives.map(item =>
        this.bilibiliService.getArcStat(accountId, item.resource_id),
      ),
    )

    const posts: PostVo[] = archives.map((item, index) => {
      const settled = statResults[index]
      const stat: ArcStatData
        = settled.status === 'fulfilled'
          ? settled.value
          : ({} as ArcStatData)

      if (settled.status === 'rejected') {
        this.logger.warn({
          path: 'bilibili.fetchUserPosts.getArcStat',
          accountId,
          resourceId: item.resource_id,
          err: settled.reason,
        })
      }

      const cover = item.cover || ''
      const shareUrl = item.video_info?.share_url || ''

      return {
        id: item.resource_id,
        platform: 'bilibili',
        title: item.title || '',
        content: item.desc || '',
        medias: [
          {
            url: shareUrl,
            type: 'video' as const,
            thumbnail: cover,
          },
        ],
        permalink: shareUrl,
        publishTime: (item.ptime || item.ctime || 0) * 1000,
        viewCount: stat.view ?? 0,
        commentCount: stat.reply ?? 0,
        likeCount: stat.like ?? 0,
        shareCount: stat.share ?? 0,
        clickCount: 0,
        impressionCount: 0,
        favoriteCount: stat.favorite ?? 0,
      }
    })

    return {
      posts,
      cursor: { before: '', after: '' },
    }
  }

  async getMetaPostDetail(accountId: string, postId: string): Promise<PostVo> {
    const stat = await this.bilibiliService.getArcStat(accountId, postId)
    return {
      id: postId,
      platform: 'bilibili',
      title: stat.title ?? '',
      content: '',
      medias: [],
      permalink: '',
      publishTime: (stat.ptime ?? 0) * 1000,
      viewCount: stat.view ?? 0,
      commentCount: stat.reply ?? 0,
      likeCount: stat.like ?? 0,
      shareCount: stat.share ?? 0,
      clickCount: 0,
      impressionCount: 0,
      favoriteCount: stat.favorite ?? 0,
    }
  }

  async fetchPostComments(
    accountId: string,
    postId: string,
    _pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    this.logger.warn({
      path: 'bilibili.fetchPostComments.unsupported',
      accountId,
      postId,
      reason: 'Bilibili Open Platform does not yet expose a comment-list scope',
    })
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async fetchCommentReplies(
    accountId: string,
    commentId: string,
    _pagination: KeysetPagination | OffsetPagination | null,
  ): Promise<FetchPostCommentsResponse> {
    this.logger.warn({
      path: 'bilibili.fetchCommentReplies.unsupported',
      accountId,
      commentId,
      reason: 'Bilibili Open Platform does not yet expose a comment-list scope',
    })
    return { comments: [], cursor: { before: '', after: '' } }
  }

  async commentOnPost(
    accountId: string,
    postId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    this.logger.warn({
      path: 'bilibili.commentOnPost.unsupported',
      accountId,
      postId,
    })
    return {
      success: false,
      error: 'Bilibili comment write is not supported by Open Platform yet',
    }
  }

  async replyToComment(
    accountId: string,
    commentId: string,
    _message: string,
  ): Promise<PublishCommentResponse> {
    this.logger.warn({
      path: 'bilibili.replyToComment.unsupported',
      accountId,
      commentId,
    })
    return {
      success: false,
      error: 'Bilibili comment write is not supported by Open Platform yet',
    }
  }
}
