import { Inject, Injectable, Logger } from '@nestjs/common'
import { AccountType, PublishType } from '@yikart/aitoearn-server-client'
import { AppException, ResponseCode } from '@yikart/common'
import { RelayClientService } from '../../../relay/relay-client.service'
import { PlatformBaseService, WorkDetailInfo } from '../base.service'

interface XhsRelayNoteDetail {
  noteId: string
  type: 'video' | 'normal' // normal = 图文
  title?: string
  desc?: string
  topics?: string[]
  coverUrl?: string
  videoUrl?: string
  imageUrls?: string[]
  publishTime?: string
  duration?: number
  authorId?: string
}

@Injectable()
export class XiaohongshuService extends PlatformBaseService {
  protected override readonly platform: AccountType = AccountType.Xhs
  protected override readonly logger = new Logger(XiaohongshuService.name)

  @Inject(RelayClientService)
  private readonly relayClientService: RelayClientService

  constructor() {
    super()
  }

  async getAccessTokenStatus(accountId: string): Promise<number> {
    const account = await this.accountRepository.getById(accountId)
    return account?.status ?? 0
  }

  /**
   * 获取作品信息
   * @param accountType
   * @param workLink
   * @param dataId
   */
  async getWorkLinkInfo(
    accountType: AccountType,
    workLink: string,
    dataId?: string,
  ): Promise<{
    dataId: string
    uniqueId: string
    type: PublishType
    videoType?: 'short' | 'long'
  }> {
    const noteId = this.parseXiaohongshuUrl(workLink)
    const resolvedDataId = noteId || dataId || ''
    if (!resolvedDataId) {
      throw new AppException(ResponseCode.InvalidWorkLink)
    }

    return {
      dataId: resolvedDataId,
      uniqueId: `${accountType}_${resolvedDataId}`,
      type: PublishType.VIDEO,
      videoType: 'short',
    }
  }

  /**
   * 获取笔记详情。Relay 账号通过中继拉详情；本地账号目前不支持，返回 null。
   */
  override async getWorkDetail(accountId: string, dataId: string): Promise<WorkDetailInfo | null> {
    const account = await this.accountRepository.getById(accountId)
    if (!account) {
      return null
    }
    if (account.relayAccountRef && this.relayClientService.enabled) {
      try {
        const detail = await this.relayClientService.get<XhsRelayNoteDetail>(
          `/xiaohongshu/notes/${encodeURIComponent(dataId)}`,
          { accountId: account.relayAccountRef },
        )
        return {
          dataId: detail.noteId,
          title: detail.title,
          desc: detail.desc,
          topics: detail.topics,
          coverUrl: detail.coverUrl,
          videoUrl: detail.videoUrl,
          imgUrlList: detail.imageUrls,
          publishTime: detail.publishTime ? new Date(detail.publishTime) : undefined,
          type: detail.type === 'video' ? 'video' : 'image',
          videoType: 'short',
          duration: detail.duration,
          rawData: detail as unknown as Record<string, unknown>,
        }
      }
      catch (err) {
        this.logger.warn(`relay xiaohongshu getWorkDetail failed: ${(err as Error).message}`)
        return null
      }
    }
    // 本地 OAuth 通路目前无 API，返回 null（与基类默认行为一致）
    return null
  }

  /**
   * 删除笔记。仅 Relay 账号支持；本地 OAuth 账号抛 PlatformNotSupported。
   */
  override async deletePost(accountId: string, postId: string): Promise<boolean> {
    const account = await this.accountRepository.getById(accountId)
    if (!account?.relayAccountRef) {
      throw new AppException(ResponseCode.PlatformNotSupported, '小红书本地账号暂不支持删除')
    }
    if (!this.relayClientService.enabled) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }
    await this.relayClientService.delete(`/xiaohongshu/notes/${encodeURIComponent(postId)}`, {
      accountId: account.relayAccountRef,
    })
    return true
  }

  /**
   * 验证作品归属。仅 Relay 账号能验证；本地 OAuth 账号默认返回 true（不验证）。
   */
  override async verifyWorkOwnership(accountId: string, dataId: string): Promise<boolean> {
    const detail = await this.getWorkDetail(accountId, dataId)
    if (!detail) {
      return true // 详情不可用时不阻塞流程
    }
    const account = await this.accountRepository.getById(accountId)
    const detailAuthorId = (detail.rawData as XhsRelayNoteDetail | undefined)?.authorId
    if (account?.uid && detailAuthorId && account.uid !== detailAuthorId) {
      throw new AppException(ResponseCode.WorkNotBelongToAccount)
    }
    return true
  }

  /**
   * 解析小红书 URL，提取笔记 ID。
   * 支持的 URL 格式：
   *   - https://www.xiaohongshu.com/explore/NOTE_ID
   *   - https://www.xiaohongshu.com/discovery/item/NOTE_ID
   *   - https://www.xiaohongshu.com/user/profile/USER_ID/NOTE_ID
   *   - https://xhslink.com/SHORT_CODE
   *   - https://xhslink.com/a/SHORT_CODE
   */
  private parseXiaohongshuUrl(workLink: string): string | null {
    let url: URL
    try {
      url = new URL(workLink)
    }
    catch {
      return null
    }

    const hostname = url.hostname.replace(/^www\./, '')

    if (hostname === 'xiaohongshu.com' || hostname.endsWith('.xiaohongshu.com')) {
      const pathname = url.pathname

      if (pathname.startsWith('/explore/')) {
        return pathname.slice('/explore/'.length).split(/[?&#/]/)[0] || null
      }
      if (pathname.startsWith('/discovery/item/')) {
        return pathname.slice('/discovery/item/'.length).split(/[?&#/]/)[0] || null
      }
      if (pathname.includes('/user/profile/')) {
        const parts = pathname.split('/').filter(Boolean)
        const noteId = parts[parts.length - 1]
        return noteId?.split(/[?&#]/)[0] || null
      }
    }
    else if (hostname === 'xhslink.com' || hostname.endsWith('.xhslink.com')) {
      // 短链：/a/CODE 或 /CODE
      const parts = url.pathname.replace(/^\/+/, '').split(/[?&#/]/).filter(Boolean)
      if (parts.length === 0)
        return null
      // 跳过路由前缀，取尾部短码
      return parts[parts.length - 1] || null
    }

    return null
  }
}
