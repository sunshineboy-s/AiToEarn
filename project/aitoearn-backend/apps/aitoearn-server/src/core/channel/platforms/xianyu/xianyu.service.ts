import { Inject, Injectable, Logger } from '@nestjs/common'
import { AccountType, PublishType } from '@yikart/aitoearn-server-client'
import { AppException, ResponseCode } from '@yikart/common'
import { RelayClientService } from '../../../relay/relay-client.service'
import { PlatformBaseService, WorkDetailInfo } from '../base.service'
import {
  XianyuItemDetail,
  XianyuRelayPublishPayload,
  XianyuRelayPublishResult,
} from './xianyu.interfaces'

/**
 * 闲鱼（Xianyu / Goofish）平台 Service。
 *
 * 闲鱼对个人用户没有公开的 OAuth 发布接口，因此本 Service 的所有
 * "写操作"都需通过两条非 OAuth 通路之一完成：
 *
 * 1. Relay（B 端中继账号）：账号文档里的 `relayAccountRef` 指向中继服务里的真实账号；
 *    `RelayClientService` 会代理调用 `/xianyu/*` 接口。
 * 2. Electron 桌面端 Cookie 注入：本仓库 `aitoearn-electron` 子项目里的
 *    `modules/plat/xianyu` 负责，本服务不会走那条路。
 *
 * 因此，对于不带 `relayAccountRef` 的本地账号，所有写操作都会抛
 * `ResponseCode.XianyuOAuthUnsupported`，把意图明确告知调用方。
 *
 * 读操作（链接解析、作品详情）支持任意账号；当账号是 relay 账号时，
 * 详情会通过 relay 拉取，否则会返回 `null`（语义同小红书空壳实现）。
 */
@Injectable()
export class XianyuService extends PlatformBaseService {
  protected override readonly platform: AccountType = AccountType.XIANYU
  protected override readonly logger = new Logger(XianyuService.name)

  @Inject(RelayClientService)
  private readonly relayClientService: RelayClientService

  constructor() {
    super()
  }

  async getAccessTokenStatus(accountId: string): Promise<number> {
    const account = await this.accountRepository.getById(accountId)
    if (!account) {
      return 0
    }
    // Relay 账号的状态由 RelayClient 统一查询，这里直接信任本地存储
    return account.status ?? 1
  }

  /**
   * 解析作品链接到 `(dataId, type)`。
   *
   * 闲鱼链接形态丰富，覆盖：
   *   - https://www.goofish.com/item?id=ITEM_ID
   *   - https://www.goofish.com/item/ITEM_ID
   *   - https://2.taobao.com/item.htm?id=ITEM_ID
   *   - https://h5.m.goofish.com/item?id=ITEM_ID
   *   - https://m.tb.cn/h.XXXX (闲鱼短链：仅返回短码作占位)
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
    const itemId = this.parseXianyuUrl(workLink) || dataId || ''
    if (!itemId) {
      throw new AppException(ResponseCode.InvalidWorkLink)
    }
    return {
      dataId: itemId,
      uniqueId: `${accountType}_${itemId}`,
      // 闲鱼商品在仓库里没有专属枚举，统一以 ARTICLE 兜底（用于通用素材）
      type: PublishType.ARTICLE,
    }
  }

  /**
   * 拉取作品详情。Relay 账号会调用 `/xianyu/items/:itemId`，否则返回 null。
   */
  override async getWorkDetail(accountId: string, dataId: string): Promise<WorkDetailInfo | null> {
    const account = await this.accountRepository.getById(accountId)
    if (account?.relayAccountRef && this.relayClientService.enabled) {
      try {
        const detail = await this.relayClientService.get<XianyuItemDetail>(
          `/xianyu/items/${encodeURIComponent(dataId)}`,
          { accountId: account.relayAccountRef },
        )
        return {
          dataId: detail.itemId,
          title: detail.title,
          desc: detail.desc,
          coverUrl: detail.imageUrls?.[0],
          videoUrl: detail.videoUrl,
          imgUrlList: detail.imageUrls,
          publishTime: detail.publishTime ? new Date(detail.publishTime) : undefined,
          type: 'image',
          rawData: detail as unknown as Record<string, unknown>,
        }
      }
      catch (err) {
        this.logger.warn(`relay xianyu getItemDetail failed: ${(err as Error).message}`)
        return null
      }
    }
    return null
  }

  /**
   * 删除商品。仅 Relay 账号支持；本地 OAuth 账号会抛 XianyuOAuthUnsupported。
   */
  override async deletePost(accountId: string, postId: string): Promise<boolean> {
    const account = await this.accountRepository.getById(accountId)
    if (!account?.relayAccountRef) {
      throw new AppException(ResponseCode.XianyuOAuthUnsupported)
    }
    if (!this.relayClientService.enabled) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }
    await this.relayClientService.delete(`/xianyu/items/${encodeURIComponent(postId)}`, {
      accountId: account.relayAccountRef,
    })
    return true
  }

  /**
   * 通过 Relay 发布闲鱼商品。
   *
   * 调用前会校验账号必须是 Relay 账号；对内仅供 publishing/providers/xianyu.service 使用。
   */
  async publishViaRelay(
    accountId: string,
    payload: XianyuRelayPublishPayload,
  ): Promise<XianyuRelayPublishResult> {
    const account = await this.accountRepository.getById(accountId)
    if (!account?.relayAccountRef) {
      throw new AppException(ResponseCode.XianyuOAuthUnsupported)
    }
    if (!this.relayClientService.enabled) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }
    return this.relayClientService.post<XianyuRelayPublishResult>('/xianyu/items', {
      ...payload,
      accountId: account.relayAccountRef,
    })
  }

  /** 是否当前账号走 Relay 通路。 */
  async isRelayAccount(accountId: string): Promise<boolean> {
    const account = await this.accountRepository.getById(accountId)
    return !!account?.relayAccountRef
  }

  /**
   * 闲鱼链接解析。返回 itemId 或 null。
   */
  private parseXianyuUrl(workLink: string): string | null {
    let url: URL
    try {
      url = new URL(workLink)
    }
    catch {
      return null
    }

    const hostname = url.hostname.replace(/^www\./, '').replace(/^h5\./, '').replace(/^m\./, '')

    // goofish.com / 2.taobao.com 站点：?id= 优先
    if (
      hostname === 'goofish.com'
      || hostname === '2.taobao.com'
      || hostname === 'tb.cn'
      || hostname.endsWith('.goofish.com')
      || hostname.endsWith('.taobao.com')
    ) {
      const idFromQuery = url.searchParams.get('id')
      if (idFromQuery) {
        return idFromQuery.split(/[?&#]/)[0]
      }
      // /item/ITEM_ID 形态
      const match = url.pathname.match(/\/item(?:\/|\.htm)?\/?([\w-]+)?/)
      if (match?.[1]) {
        return match[1]
      }
      // 兜底：闲鱼短链 m.tb.cn/h.XXXX，返回短码
      const tail = url.pathname.replace(/^\//, '').split(/[?&#/]/)[0]
      return tail || null
    }

    return null
  }
}
