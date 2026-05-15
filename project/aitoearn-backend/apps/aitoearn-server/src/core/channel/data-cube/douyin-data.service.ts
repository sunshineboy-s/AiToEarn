import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { DouyinService } from '../platforms/douyin/douyin.service'
import { DataCubeBase } from './data.base'

/**
 * 抖音 - 统计数据
 *
 * NOTE: 数据来源是抖音开放平台的 user/item 数据 API。
 * 目前 `DouyinApiService.getUserStat / getArcStat / getArcIncStat` 是占位实现
 * （返回 0），上层 data-cube 已经按真实形状 (`follower / arc_passed_total / view ...`)
 * 接好。后续在 `DouyinApiService` 里把 HTTP 调用补完，本服务无需任何改动即可
 * 自动返回真实数据。
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
    this.logger.log('getArcDataBulk', accountId, dataId)
    return {
      recordId: '',
      dataId: '',
      list: [],
    }
  }
}
