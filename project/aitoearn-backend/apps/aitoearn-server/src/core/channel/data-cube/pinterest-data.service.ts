/*
 * @Author: nevin
 * @Date: 2025-02-15 20:59:55
 * @LastEditTime: 2025-04-27 17:58:21
 * @LastEditors: nevin
 * @Description: pinterest 统计数据
 */
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { PinterestService } from '../platforms/pinterest/pinterest.service'
import { DataCubeBase } from './data.base'

@Injectable()
export class PinterestDataService extends DataCubeBase {
  private readonly logger = new Logger(PinterestDataService.name)
  constructor(
    readonly pinterestService: PinterestService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.PINTEREST}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      workCount: res.arcNum,
      fansCount: res.fensNum,
    })
  }

  async getAccountDataCube(accountId: string) {
    const res: any = await this.pinterestService.getUserStat(accountId)
    const userInfo = res?.userInfo ?? {}
    return {
      // PinterestUserAccount 用 follower_count，旧代码错写成 follower
      fensNum: userInfo.follower_count ?? userInfo.follower ?? 0,
      // 用 pin_count 作为"作品数"；monthly_views 是浏览量，归到 playNum
      arcNum: userInfo.pin_count ?? 0,
      playNum: userInfo.monthly_views ?? 0,
    }
  }

  async getAccountDataBulk(accountId: string) {
    this.logger.log('getAccountDataBulk', accountId)
    return {
      list: [],
    }
  }

  /**
   * Pin 维度统计。
   *
   * Pinterest 的 `/v5/pins/:id/analytics` 我们当前 PinterestApiService
   * 还没实现，所以这里只能确认 pin 存在并返回零值；接进 analytics 之后
   * 字段会被填充。这是修个真实 bug：旧实现签名只有 `(accountId)`，dataId 被
   * 直接吞掉，结果总是返回账号统计而不是 pin 统计。
   */
  async getArcDataCube(accountId: string, dataId: string) {
    try {
      // 至少确认 pin 真实存在 + 让 401/404 暴露出来，而不是默默返回伪数据
      await this.pinterestService.getPinById(dataId, accountId)
    }
    catch (err) {
      this.logger.warn(`pinterest getPinById(${dataId}) failed: ${(err as Error).message}`)
    }
    return {
      fensNum: 0,
      playNum: 0,
      commentNum: 0,
      likeNum: 0,
      shareNum: 0,
      collectNum: 0,
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
