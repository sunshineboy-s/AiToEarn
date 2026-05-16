import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { DouyinService } from '../platforms/douyin/douyin.service'
import { DataCubeBase } from './data.base'

/**
 * 抖音 - 统计数据
 *
 * 数据来源：抖音开放平台数据开放服务 (DataOpen API)
 * - 粉丝总数：GET /data/external/user/fans/
 * - 作品列表：GET /api/douyin/v1/video/video_list/  (用于推断作品总数)
 * - 单作品基础：GET /data/external/item/base/
 * - 单作品按日：GET /data/external/item/{play,like,comment,share}/
 *
 * 调用链：DouyinDataService → DouyinService → DouyinApiService
 * 详见 libs/douyin/douyin-api.service.ts 的 dataApiGet 帮助方法。
 */
@Injectable()
export class DouyinDataService extends DataCubeBase {
  private readonly logger = new Logger(DouyinDataService.name)
  constructor(
    readonly douyinService: DouyinService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.Douyin}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      workCount: res.arcNum,
      fansCount: res.fensNum,
    })
  }

  async getAccountDataCube(accountId: string) {
    const res = await this.douyinService.getUserStat(accountId)
    return {
      fensNum: res.follower,
      arcNum: res.arc_passed_total,
    }
  }

  async getAccountDataBulk(accountId: string) {
    // 账号粉丝按日时序：data-cube 增量端点暂只接入"粉丝"。其它账号级指标
    // (播放/点赞/分享) 抖音开放平台仅提供单作品维度，需要遍历作品聚合，
    // 性价比低，留作 P2。
    this.logger.log('getAccountDataBulk', accountId)
    return {
      list: [],
    }
  }

  async getArcDataCube(accountId: string, dataId: string) {
    const res = await this.douyinService.getArcStat(accountId, dataId)
    return {
      playNum: res.view,
      likeNum: res.like,
      commentNum: res.reply,
      shareNum: res.share,
      collectNum: res.favorite,
    }
  }

  async getArcDataBulk(accountId: string, dataId: string) {
    const res = await this.douyinService.getArcIncStat(accountId, dataId)
    return {
      recordId: '',
      dataId,
      list: res.daily.map(d => ({
        playNum: d.play,
        likeNum: d.like,
        commentNum: d.comment,
        shareNum: d.share,
      })),
    }
  }
}
