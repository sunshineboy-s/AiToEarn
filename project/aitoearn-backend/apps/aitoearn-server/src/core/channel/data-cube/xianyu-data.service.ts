import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { XianyuService } from '../platforms/xianyu/xianyu.service'
import { DataCubeBase } from './data.base'

/**
 * 闲鱼数据回流（Data Cube）。
 *
 * 设计要点：
 *   - 字段做语义映射：闲鱼的"我想要"=likeNum、"我也要"=collectNum、
 *     `onSaleCount`/`totalItemCount` 合并为 arcNum（在售优先）。
 *   - 7 / 30 天增量（getAccountDataBulk / getArcDataBulk）目前未实现。
 *     原因：Relay 端尚未约定增量接口。占位返回空 list，控制台不会崩。
 *   - `XianyuService` 已经把"本地 OAuth vs Relay"判断收敛在内部，
 *     所以这一层无需关心账号种类，本地账号会得到全 0。
 */
@Injectable()
export class XianyuDataService extends DataCubeBase {
  private readonly logger = new Logger(XianyuDataService.name)

  constructor(
    private readonly xianyuService: XianyuService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  /**
   * 账号创建后立即拉一次数据写到 account 表，与其它平台行为一致。
   */
  @OnEvent(`account.create.${AccountType.XIANYU}`)
  async accountPortraitReport(accountId: string) {
    try {
      const stats = await this.getAccountDataCube(accountId)
      await this.accountRepository.updateAccountStatistics(accountId, {
        workCount: stats.arcNum,
        fansCount: stats.fensNum,
        readCount: stats.playNum,
        likeCount: stats.likeNum,
        commentCount: stats.commentNum,
        collectCount: stats.collectNum,
      })
    }
    catch (err) {
      this.logger.warn(`[xianyu] accountPortraitReport failed for ${accountId}: ${(err as Error).message}`)
    }
  }

  async getAccountDataCube(accountId: string) {
    const stats = await this.xianyuService.getAccountStats(accountId)
    return {
      fensNum: stats.followersCount,
      arcNum: stats.onSaleCount || stats.totalItemCount,
      playNum: stats.viewCount,
      likeNum: stats.likeCount,
      commentNum: stats.commentCount,
      collectNum: stats.favoriteCount,
    }
  }

  async getAccountDataBulk(accountId: string) {
    // TODO(xianyu): Relay 增量接口 (`/xianyu/account/stats/bulk?days=7|30`) 落地后接进来
    this.logger.log(`getAccountDataBulk(${accountId}) not implemented for xianyu`)
    return { list: [] }
  }

  async getArcDataCube(accountId: string, dataId: string) {
    const stats = await this.xianyuService.getItemStats(accountId, dataId)
    return {
      // 商品维度没有 fens 概念；保留字段，置 0
      fensNum: 0,
      playNum: stats.viewCount,
      likeNum: stats.likeCount,
      commentNum: stats.commentCount,
      collectNum: stats.favoriteCount,
      shareNum: stats.shareCount,
    }
  }

  async getArcDataBulk(accountId: string, dataId: string) {
    this.logger.log(`getArcDataBulk(${accountId}, ${dataId}) not implemented for xianyu`)
    return {
      recordId: '',
      dataId,
      list: [],
    }
  }
}
