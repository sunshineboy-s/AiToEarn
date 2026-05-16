import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType, AppException } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { ChannelAccountDataBulk, ChannelArcDataBulk } from '../platforms/common'
import { YoutubeService } from '../platforms/youtube/youtube.service'
import { AudienceDemographicsRow, DataCubeBase } from './data.base'

function isYoutubeResponse(value: unknown): value is { items?: unknown[] } {
  return value !== null && typeof value === 'object' && !(value instanceof AppException) && 'items' in value
}

interface AnalyticsQueryResponse {
  columnHeaders?: { name: string }[]
  rows?: (string | number)[][]
}

function isAnalyticsResponse(value: unknown): value is AnalyticsQueryResponse {
  return value !== null && typeof value === 'object' && !(value instanceof AppException) && ('rows' in value || 'columnHeaders' in value)
}

/**
 * 把 YouTube Analytics 的二维表（columnHeaders + rows）拍平成 dimension -> metricMap 的列表。
 * 给上层 controller / dashboard 直接消费。
 */
function flattenAnalytics(resp: AnalyticsQueryResponse): Array<Record<string, string | number>> {
  if (!resp.rows || !resp.columnHeaders)
    return []
  const headers = resp.columnHeaders.map(h => h.name)
  return resp.rows.map((row) => {
    const obj: Record<string, string | number> = {}
    headers.forEach((h, i) => {
      obj[h] = row[i]
    })
    return obj
  })
}

@Injectable()
export class YoutubeDataService extends DataCubeBase {
  private readonly logger = new Logger(YoutubeDataService.name)
  constructor(
    readonly youtubeService: YoutubeService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.YOUTUBE}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      fansCount: res.fensNum,
      workCount: res.arcNum,
      readCount: res.playNum,
    })
  }

  // 账户数据
  async getAccountDataCube(accountId: string) {
    this.logger.log(`getAccountDataCube accountId: ${accountId}`)
    const res = await this.youtubeService.getChannelsList(accountId, undefined, undefined, undefined, true)

    if (!isYoutubeResponse(res)) {
      return { fensNum: 0, arcNum: 0, playNum: 0 }
    }
    const statData = (res.items as Array<{ statistics?: Record<string, string> }>)?.[0]?.statistics

    return {
      fensNum: Number.parseInt(statData?.['subscriberCount'] || '0') || 0,
      arcNum: Number.parseInt(statData?.['videoCount'] || '0') || 0,
      playNum: Number.parseInt(statData?.['viewCount'] || '0') || 0,
    }
  }

  /**
   * 账户增量数据（最近 30 天，按日）
   *
   * 来源：YouTube Analytics API `reports.query`
   * - dimensions=day
   * - metrics=views,likes,shares,comments,subscribersGained,subscribersLost
   *
   * 频道 OAuth 必须包含 `yt-analytics.readonly` scope（已在 OAUTH_SCOPES 声明）。
   * Analytics API 数据有 ~24-48h 延迟，最新的几天可能为 0。
   */
  async getAccountDataBulk(accountId: string): Promise<ChannelAccountDataBulk> {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 30)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = today.toISOString().slice(0, 10)

    const res = await this.youtubeService.getAnalyticsReport(accountId, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,likes,comments,shares,subscribersGained,subscribersLost',
      dimensions: 'day',
      sort: 'day',
    })

    if (!isAnalyticsResponse(res)) {
      this.logger.warn(`getAccountDataBulk: analytics call failed for accountId=${accountId}`)
      return { list: [] }
    }

    const rows = flattenAnalytics(res)
    return {
      list: rows.map(r => ({
        playNum: Number(r['views']) || 0,
        likeNum: Number(r['likes']) || 0,
        commentNum: Number(r['comments']) || 0,
        shareNum: Number(r['shares']) || 0,
        // 净涨粉 = subscribersGained - subscribersLost
        fensNum: (Number(r['subscribersGained']) || 0) - (Number(r['subscribersLost']) || 0),
      })),
    }
  }

  // 作品数据
  async getArcDataCube(accountId: string, dataId: string) {
    this.logger.log('getArcDataCube', accountId, dataId)
    const res = await this.youtubeService.getVideosList(accountId, undefined, [dataId])

    if (!isYoutubeResponse(res)) {
      return { fensNum: 0, likeNum: 0, playNum: 0, commentNum: 0 }
    }
    const statData = (res.items as Array<{ statistics?: Record<string, string> }>)?.[0]?.statistics

    return {
      fensNum: Number.parseInt(statData?.['favoriteCount'] || '0') || 0,
      likeNum: Number.parseInt(statData?.['likeCount'] || '0') || 0,
      playNum: Number.parseInt(statData?.['viewCount'] || '0') || 0,
      commentNum: Number.parseInt(statData?.['commentCount'] || '0') || 0,
    }
  }

  /**
   * 作品增量数据（最近 30 天，按日）
   *
   * 来源：YouTube Analytics API `reports.query` filtered by `video=={videoId}`
   * - dimensions=day
   * - metrics=views,likes,comments,shares,averageViewDuration
   */
  async getArcDataBulk(accountId: string, dataId: string): Promise<ChannelArcDataBulk> {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 30)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = today.toISOString().slice(0, 10)

    const res = await this.youtubeService.getAnalyticsReport(accountId, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,likes,comments,shares',
      dimensions: 'day',
      filters: `video==${dataId}`,
      sort: 'day',
    })

    if (!isAnalyticsResponse(res)) {
      this.logger.warn(`getArcDataBulk: analytics call failed for accountId=${accountId} dataId=${dataId}`)
      return { recordId: '', dataId, list: [] }
    }

    const rows = flattenAnalytics(res)
    return {
      recordId: '',
      dataId,
      list: rows.map(r => ({
        playNum: Number(r['views']) || 0,
        likeNum: Number(r['likes']) || 0,
        commentNum: Number(r['comments']) || 0,
        shareNum: Number(r['shares']) || 0,
      })),
    }
  }

  /**
   * 受众画像 — 按年龄/性别分布
   * https://developers.google.com/youtube/analytics/dimensions#Demographics_Dimensions
   *
   * 实现 DataCubeBase.getAudienceDemographics 的 YouTube 版本。
   * value 是 viewerPercentage（0-100），unit='percentage'。
   */
  override async getAudienceDemographics(
    accountId: string,
    options: { startDate?: string, endDate?: string } = {},
  ): Promise<AudienceDemographicsRow[]> {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 90)
    const startDate = options.startDate ?? start.toISOString().slice(0, 10)
    const endDate = options.endDate ?? today.toISOString().slice(0, 10)

    const res = await this.youtubeService.getAnalyticsReport(accountId, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup,gender',
    })

    if (!isAnalyticsResponse(res))
      return []
    return flattenAnalytics(res).map(row => ({
      ageGroup: typeof row['ageGroup'] === 'string' ? row['ageGroup'] : undefined,
      gender: typeof row['gender'] === 'string' ? row['gender'] : undefined,
      value: Number(row['viewerPercentage']) || 0,
      unit: 'percentage' as const,
    }))
  }

  /**
   * 流量来源分布（搜索 / 推荐 / 外部 / 浏览功能 ...）
   * https://developers.google.com/youtube/analytics/dimensions#Traffic_Source_Dimensions
   */
  async getTrafficSources(
    accountId: string,
    options: { startDate?: string, endDate?: string } = {},
  ) {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 30)
    const startDate = options.startDate ?? start.toISOString().slice(0, 10)
    const endDate = options.endDate ?? today.toISOString().slice(0, 10)

    const res = await this.youtubeService.getAnalyticsReport(accountId, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views',
    })

    if (!isAnalyticsResponse(res))
      return []
    return flattenAnalytics(res)
  }

  /**
   * 设备类型分布（手机 / 桌面 / TV / 平板）
   */
  async getDeviceTypes(
    accountId: string,
    options: { startDate?: string, endDate?: string } = {},
  ) {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 30)
    const startDate = options.startDate ?? start.toISOString().slice(0, 10)
    const endDate = options.endDate ?? today.toISOString().slice(0, 10)

    const res = await this.youtubeService.getAnalyticsReport(accountId, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration',
      dimensions: 'deviceType',
      sort: '-views',
    })

    if (!isAnalyticsResponse(res))
      return []
    return flattenAnalytics(res)
  }

  /**
   * 视频留存率曲线（按 elapsedVideoTimeRatio 分桶）
   *
   * 注意：这个端点只支持在 channel==MINE 下查询自己的视频，
   * 且部分指标（audienceWatchRatio, relativeRetentionPerformance）
   * 需要 yt-analytics.readonly + yt-analytics-monetary.readonly。
   */
  async getVideoRetention(accountId: string, videoId: string) {
    const res = await this.youtubeService.getAnalyticsReport(accountId, {
      ids: 'channel==MINE',
      startDate: '2000-01-01', // 视频生命周期内的全量数据
      endDate: new Date().toISOString().slice(0, 10),
      metrics: 'audienceWatchRatio,relativeRetentionPerformance',
      dimensions: 'elapsedVideoTimeRatio',
      filters: `video==${videoId};audienceType==ORGANIC`,
      sort: 'elapsedVideoTimeRatio',
    })

    if (!isAnalyticsResponse(res))
      return []
    return flattenAnalytics(res)
  }
}
