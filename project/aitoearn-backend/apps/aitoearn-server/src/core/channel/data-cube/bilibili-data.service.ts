/*
 * @Author: nevin
 * @Date: 2025-02-15 20:59:55
 * @LastEditTime: 2025-04-27 17:58:21
 * @LastEditors: nevin
 * @Description: b站-统计数据
 */
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { BilibiliService } from '../platforms/bilibili/bilibili.service'
import { DataCubeBase } from './data.base'

@Injectable()
export class BilibiliDataService extends DataCubeBase {
  private readonly logger = new Logger(BilibiliDataService.name)
  constructor(
    readonly bilibiliService: BilibiliService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.BILIBILI}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      workCount: res.arcNum,
      fansCount: res.fensNum,
    })
  }

  async getAccountDataCube(accountId: string) {
    const res = await this.bilibiliService.getUserStat(accountId)
    return {
      fensNum: res.follower,
      arcNum: res.arc_passed_total,
    }
  }

  /**
   * 账户增量数据
   *
   * 来源：B 站开放平台 GET `/arcopen/fn/data/arc/inc-stats`
   *
   * ⚠️ 重要限制：
   *   B 站开放平台**不提供按日的时序数据 API**。`inc-stats` 只返回
   *   "昨天一整天的增量聚合"——一行 8 个字段（点击/投币/弹幕/充电/收藏/
   *   点赞/评论/分享），没有日期粒度，也没有过去 N 天历史。
   *
   *   作为对比：
   *   - YouTube Analytics: ✅ 可以拉 30 天每日
   *   - Instagram Insights: ✅ period=day
   *   - 抖音开放平台 user/item: ✅ 可以传 date_type=7/15/30
   *   - **B 站开放平台**: ❌ 只能拿到 yesterday 的一个聚合数
   *
   *   "按日时序"想做需要在我们后端建一个定时任务，每天拉一次写入 DB，
   *   自己累积成历史。这是后续工作（见 RFC §6.4），不在本 PR 范围。
   *
   * 当前实现：把昨天的增量包成 `list: [{...}]` 单元素列表返回，并附上 ts。
   * 用户至少能看到"昨日数据"而不是空列表。
   */
  async getAccountDataBulk(accountId: string) {
    try {
      const res = await this.bilibiliService.getArcIncStat(accountId)
      // inc-stats 没有 date 字段，按文档语义视为"昨天"
      const yesterday = new Date()
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      yesterday.setUTCHours(0, 0, 0, 0)

      return {
        list: [
          {
            ts: yesterday.getTime(),
            playNum: res.inc_click ?? 0,
            likeNum: res.inc_like ?? 0,
            commentNum: res.inc_reply ?? 0,
            shareNum: res.inc_share ?? 0,
            collectNum: res.inc_fav ?? 0,
            // B 站特有字段（其他平台没有，前端按需消费）
            coinNum: res.inc_coin ?? 0,
            danmakuNum: res.inc_dm ?? 0,
            elecNum: res.inc_elec ?? 0,
          },
        ],
      }
    }
    catch (err) {
      this.logger.warn(`getAccountDataBulk failed for ${accountId}: ${(err as Error).message}`)
      return { list: [] }
    }
  }

  async getArcDataCube(accountId: string, dataId: string) {
    const res = await this.bilibiliService.getArcStat(accountId, dataId)

    return {
      fensNum: res.favorite,
      playNum: res.view,
      commentNum: res.reply,
      likeNum: res.like,
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
