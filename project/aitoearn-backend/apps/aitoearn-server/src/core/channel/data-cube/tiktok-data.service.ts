import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { TiktokService } from '../platforms/tiktok/tiktok.service'
import { DataCubeBase } from './data.base'

const ACCOUNT_INFO_FIELDS
  = 'open_id,union_id,avatar_url,username,display_name,follower_count,following_count,video_count'

const VIDEO_INFO_FIELDS
  = 'id,view_count,like_count,comment_count,share_count'

/**
 * TikTok - 统计数据
 *
 * 通过 /v2/user/info/ 拿账号粉丝/作品数；
 * 通过 /v2/video/list/ 拿单作品的 view/like/comment/share。
 *
 * NOTE:
 * - TikTok Display API 没有按日增量端点，DataBulk 接口暂返回空列表。
 * - User-level like count 字段 (`likes_count`) 在 Display API 返回上并不稳定，
 *   依赖具体 scope，故此 service 不在 account-level 暴露 likeNum；
 *   作品维度的 `like_count` 是稳定字段。
 */
@Injectable()
export class TiktokDataService extends DataCubeBase {
  private readonly logger = new Logger(TiktokDataService.name)
  constructor(
    readonly tiktokService: TiktokService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.TIKTOK}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      fansCount: res.fensNum,
      workCount: res.arcNum,
    })
  }

  async getAccountDataCube(accountId: string) {
    const res = await this.tiktokService.getUserInfo(accountId, ACCOUNT_INFO_FIELDS)
    const user = res?.data?.user
    return {
      fensNum: user?.follower_count ?? 0,
      arcNum: user?.video_count ?? 0,
    }
  }

  async getAccountDataBulk(accountId: string) {
    // TikTok Display API 不提供按日增量；后续接 Research API 时在此补全
    this.logger.log('getAccountDataBulk', accountId)
    return {
      list: [],
    }
  }

  async getArcDataCube(accountId: string, dataId: string) {
    const res = await this.tiktokService.getUserVideos(accountId, VIDEO_INFO_FIELDS)
    const video = res?.data?.videos?.find(v => v.id === dataId)
    if (!video) {
      this.logger.warn(`tiktok arc not found for accountId=${accountId} dataId=${dataId}`)
      return {
        playNum: 0,
        likeNum: 0,
        commentNum: 0,
        shareNum: 0,
      }
    }
    return {
      playNum: video.view_count ?? 0,
      likeNum: video.like_count ?? 0,
      commentNum: video.comment_count ?? 0,
      shareNum: video.share_count ?? 0,
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
