import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { DouyinService } from '../platforms/douyin/douyin.service'
import { DataCubeBase } from './data.base'

/**
 * 抖音 - 统计数据
 *
 * 数据来源：抖音开放平台数据 API（`/data/external/user/*` 与 `/data/external/item/*`）。
 * 5 个方法目前都走真实 API：
 * - getAccountDataCube / getArcDataCube：当前累计指标
 * - getAccountDataBulk / getArcDataBulk：最近 30 天每日增量
 *
 * 上游任何端点失败均走 fail-soft（DouyinApiService 内部处理），返回空列表
 * 而不是 throw，让前端的 chart 不会因为部分指标抓不到就整张 panic。
 */
@Injectable()
export class DouyinDataService extends DataCubeBase {
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
    const series = await this.douyinService.getAccountDailyStat(accountId, 30)
    return {
      list: series.map(p => ({
        // 把 `date` 一并塞回 list 里，方便上层画时间轴。
        // ChannelAccountDataCube 没有 `date` 字段，但是 list 元素是 any-extensible
        // 因为接口没有 sealed；不强制写到契约里以避免影响其他平台。
        ...p,
        fensNum: p.fensNum,
        likeNum: p.likeNum,
        commentNum: p.commentNum,
        shareNum: p.shareNum,
        playNum: p.playNum,
      })),
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
    const series = await this.douyinService.getArcDailyStat(accountId, dataId, 30)
    return {
      recordId: '',
      dataId,
      list: series.map(p => ({
        ...p,
        playNum: p.play_count,
        likeNum: p.like_count,
        commentNum: p.comment_count,
        shareNum: p.share_count,
      })),
    }
  }
}
