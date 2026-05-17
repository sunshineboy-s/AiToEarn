import { Injectable, Logger } from '@nestjs/common'
import { PostsResponseVo, PostVo } from '@yikart/common'
import { ArchiveListItem, ArchiveStatus } from '../../libs/bilibili/common'
import { BilibiliService } from '../../platforms/bilibili/bilibili.service'
import { KeysetPagination, OffsetPagination } from '../engagement.dto'
import { EngagementProvider, FetchPostCommentsResponse, PublishCommentResponse } from '../engagement.interface'

/**
 * B 站 Engagement Provider
 *
 * ⚠️ 关于评论接口的真相：
 * B 站开放平台 (arcopen) **不开放**评论相关 API。所有第三方评论方案都依赖
 * 老 web API `api.bilibili.com/x/v2/reply` + cookie + WBI 签名 — 这是另一套
 * 完全不同的认证体系，不能复用 arcopen 的 OAuth Bearer。
 *
 * 因此本 provider 当前能力：
 * - ✅ fetchUserPosts: 真接入 — 通过 arcopen `getArchiveList + getArcStat` 拿稿件列表
 * - ✅ getMetaPostDetail: 真接入 — 通过 arcopen `getArcStat` 拿单作品数据
 * - ❌ fetchPostComments / fetchCommentReplies / commentOnPost / replyToComment:
 *      返回 not-supported 错误，等待 P1 BilibiliCookieSyncModule 接入
 *
 * 详情参考 docs/rfcs/0001-platform-deepening.md §6.4 "B 站评论：cookie 同步层"。
 */
@Injectable()
export class BilibiliEngagementProvider implements EngagementProvider {
  private readonly logger = new Logger(BilibiliEngagementProvider.name)

  constructor(
    private readonly bilibiliService: BilibiliService,
  ) {}

  private toPostVo(item: ArchiveListItem, stat?: { view: number, like: number, reply: number, share: number, favorite: number }): PostVo {
    return {
      id: item.resource_id,
      platform: 'bilibili',
      title: item.title,
      content: item.desc ?? '',
      medias: item.cover ? [{ url: item.cover, type: 'image' as const }] : [],
      permalink: item.video_info?.share_url ?? '',
      publishTime: (item.ptime || item.ctime || 0) * 1000,
      viewCount: stat?.view ?? 0,
      commentCount: stat?.reply ?? 0,
      likeCount: stat?.like ?? 0,
      shareCount: stat?.share ?? 0,
      clickCount: 0,
      impressionCount: 0,
      favoriteCount: stat?.favorite ?? 0,
    }
  }

  async getMetaPostDetail(accountId: string, postId: string): Promise<PostVo> {
    const stat = await this.bilibiliService.getArcStat(accountId, postId)
    return {
      id: postId,
      platform: 'bilibili',
      title: stat?.title ?? '',
      content: '',
      medias: [],
      permalink: '',
      publishTime: (stat?.ptime ?? 0) * 1000,
      viewCount: stat?.view ?? 0,
      commentCount: stat?.reply ?? 0,
      likeCount: stat?.like ?? 0,
      shareCount: stat?.share ?? 0,
      clickCount: 0,
      impressionCount: 0,
      favoriteCount: stat?.favorite ?? 0,
    }
  }

  async fetchUserPosts(accountId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<PostsResponseVo> {
    // arcopen 用 ps/pn 分页，把 KeysetPagination.after 当作 page number 解析
    const ps = (pagination as KeysetPagination)?.limit
      ?? (pagination as OffsetPagination)?.pageSize
      ?? 20
    const pn = Number((pagination as KeysetPagination)?.after)
      || (pagination as OffsetPagination)?.pageNo
      || 1

    const archiveList = await this.bilibiliService.getArchiveList(accountId, {
      ps,
      pn,
      status: ArchiveStatus.pubed,
    })

    if (!archiveList?.list) {
      return {
        posts: [],
        cursor: { before: '', after: '' },
      }
    }

    // 并发拉取每条作品的统计数据；arcopen 只暴露逐个作品的 stat 接口
    const posts = await Promise.all(
      archiveList.list.map(async (item) => {
        try {
          const stat = await this.bilibiliService.getArcStat(accountId, item.resource_id)
          return this.toPostVo(item, stat)
        }
        catch (e) {
          this.logger.warn(`bilibili getArcStat failed for resource_id=${item.resource_id}: ${(e as Error).message}`)
          return this.toPostVo(item)
        }
      }),
    )

    const total = archiveList.page?.total ?? 0
    const nextPn = pn * ps < total ? pn + 1 : 0

    return {
      posts,
      cursor: {
        before: pn > 1 ? String(pn - 1) : '',
        after: nextPn ? String(nextPn) : '',
      },
    }
  }

  async fetchPostComments(accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.warn(`fetchPostComments accountId=${accountId} postId=${postId} — bilibili open API does not expose comment endpoints`)
    return {
      comments: [],
      cursor: {
        before: '',
        after: (pagination as KeysetPagination)?.after || '',
      },
    }
  }

  async fetchCommentReplies(accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null): Promise<FetchPostCommentsResponse> {
    this.logger.warn(`fetchCommentReplies accountId=${accountId} commentId=${commentId} — bilibili open API does not expose comment endpoints`)
    return {
      comments: [],
      cursor: {
        before: '',
        after: (pagination as KeysetPagination)?.after || '',
      },
    }
  }

  async commentOnPost(_accountId: string, _postId: string, _message: string): Promise<PublishCommentResponse> {
    return {
      success: false,
      error: 'Bilibili open API (arcopen) does not expose comment endpoints. Posting/replying requires the legacy `api.bilibili.com/x/v2/reply` cookie+WBI flow, planned in BilibiliCookieSyncModule (P1).',
    }
  }

  async replyToComment(_accountId: string, _commentId: string, _message: string): Promise<PublishCommentResponse> {
    return {
      success: false,
      error: 'Bilibili open API (arcopen) does not expose comment endpoints. Posting/replying requires the legacy `api.bilibili.com/x/v2/reply` cookie+WBI flow, planned in BilibiliCookieSyncModule (P1).',
    }
  }
}
