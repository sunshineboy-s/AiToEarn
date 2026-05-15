import { Injectable, Logger } from '@nestjs/common'
import { AssetsService } from '@yikart/assets'
import { AppException, ResponseCode } from '@yikart/common'
import { PublishRecord, PublishStatus } from '@yikart/mongodb'
import { XianyuPublishOption } from '../../platforms/xianyu/xianyu.interfaces'
import { XianyuService } from '../../platforms/xianyu/xianyu.service'
import { CreatePublishDto } from '../publish.dto'
import { PublishingException } from '../publishing.exception'
import { PublishingTaskResult, VerifyPublishResult } from '../publishing.interface'
import { PublishService } from './base.service'

/**
 * 闲鱼发布 Provider。
 *
 * 路径选择：
 *   - 账号若是 Relay 账号 -> 通过 RelayClient 调 `/xianyu/items` 完成商品发布；
 *   - 账号若没绑定 Relay -> 抛 XianyuOAuthUnsupported（闲鱼对个人没有 OAuth）。
 *
 * 桌面端 Cookie 注入路径并不在主服务发布流程里 —— Electron 子项目自己完成
 * 商品发布并仅在事后回调主服务以创建 PublishRecord。所以这里不处理那条路。
 */
@Injectable()
export class XianyuPubService extends PublishService {
  private readonly logger = new Logger(XianyuPubService.name)

  constructor(
    private readonly xianyuService: XianyuService,
    private readonly assetsService: AssetsService,
  ) {
    super()
  }

  override async validatePublishParams(publishTask: CreatePublishDto): Promise<{ success: boolean, message?: string }> {
    const base = await super.validatePublishParams(publishTask)
    if (!base.success) {
      return base
    }
    if (!publishTask.title || publishTask.title.trim().length === 0) {
      return { success: false, message: '闲鱼商品必须填写标题' }
    }
    if (!publishTask.imgUrlList || publishTask.imgUrlList.length === 0) {
      return { success: false, message: '闲鱼商品至少需要 1 张图片' }
    }
    if (publishTask.imgUrlList.length > 9) {
      return { success: false, message: '闲鱼商品最多 9 张图片' }
    }
    const opt = publishTask.option?.xianyu as XianyuPublishOption | undefined
    if (!opt || (opt.price === undefined && opt.reservePrice === undefined)) {
      return { success: false, message: '闲鱼商品必须设置一口价或起拍价' }
    }
    if (opt.price !== undefined && opt.price <= 0) {
      return { success: false, message: '闲鱼商品价格必须大于 0' }
    }
    return { success: true }
  }

  async immediatePublish(publishTask: PublishRecord): Promise<PublishingTaskResult> {
    if (!publishTask.accountId) {
      throw PublishingException.nonRetryable('publishTask 缺少 accountId')
    }

    const isRelay = await this.xianyuService.isRelayAccount(publishTask.accountId)
    if (!isRelay) {
      // 本地 OAuth 账号：闲鱼不支持，落在错误处理上抛固定错误
      throw new AppException(ResponseCode.XianyuOAuthUnsupported)
    }

    // 资源 URL 通过 AssetsService 转为外网可访问的 URL
    const imgUrlList = (publishTask.imgUrlList || []).map(url => this.assetsService.buildUrl(url))
    const videoUrl = publishTask.videoUrl ? this.assetsService.buildUrl(publishTask.videoUrl) : undefined
    const option = (publishTask.option?.xianyu as XianyuPublishOption | undefined) ?? {}

    const result = await this.xianyuService.publishViaRelay(publishTask.accountId, {
      accountId: publishTask.accountId,
      title: publishTask.title || '',
      desc: publishTask.desc || '',
      topics: publishTask.topics,
      imgUrlList,
      videoUrl,
      option,
    })

    return {
      postId: result.itemId,
      permalink: result.workLink,
      status: result.status === 'on_sale' ? PublishStatus.PUBLISHED : PublishStatus.PUBLISHING,
    }
  }

  async verifyAndCompletePublish(publishRecord: PublishRecord): Promise<VerifyPublishResult> {
    if (!publishRecord.dataId || !publishRecord.accountId) {
      return { success: false, errorMsg: '发布记录缺少 dataId / accountId' }
    }
    try {
      const detail = await this.xianyuService.getWorkDetail(publishRecord.accountId, publishRecord.dataId)
      if (!detail) {
        return { success: false, errorMsg: '闲鱼商品详情不可用（仅 Relay 账号支持）' }
      }
      const workLink = `https://www.goofish.com/item?id=${publishRecord.dataId}`
      return { success: true, workLink }
    }
    catch (error) {
      this.logger.error(`Verify Xianyu publish failed: ${(error as Error).message}`)
      return { success: false, errorMsg: (error as Error).message }
    }
  }
}
