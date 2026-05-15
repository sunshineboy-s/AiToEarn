import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType, AppException } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import {
  YoutubeAnalyticsCountryRow,
  YoutubeAnalyticsDailyPoint,
  YoutubeAnalyticsDemographicsRow,
  YoutubeAnalyticsRetentionRow,
  YoutubeAnalyticsTrafficSourceRow,
} from '../libs/youtube/youtube-analytics.interface'
import { YoutubeAnalyticsService } from '../libs/youtube/youtube-analytics.service'
import {
  ChannelAccountDataBulk,
  ChannelAccountDataCube,
  ChannelArcDataBulk,
  ChannelArcDataCube,
} from '../platforms/common'
import { YoutubeService } from '../platforms/youtube/youtube.service'
import { DataCubeBase } from './data.base'

interface YoutubeChannelStatistics {
  subscriberCount?: string
  videoCount?: string
  viewCount?: string
}

interface YoutubeVideoStatistics {
  favoriteCount?: string
  likeCount?: string
  viewCount?: string
  commentCount?: string
}

interface YoutubeChannelItem {
  statistics?: YoutubeChannelStatistics
}

interface YoutubeVideoItem {
  statistics?: YoutubeVideoStatistics
}

interface YoutubeListResponse<T> {
  items?: T[]
}

function isYoutubeResponse<T>(value: unknown): value is YoutubeListResponse<T> {
  return value !== null
    && typeof value === 'object'
    && !(value instanceof AppException)
    && 'items' in value
}

/**
 * Default analytics window: trailing 28 days. Matches what YouTube Studio
 * shows by default in the Audience tab. Callers needing a different window
 * use the public `*WithWindow` methods below.
 */
const DEFAULT_WINDOW_DAYS = 28

function defaultWindow() {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - DEFAULT_WINDOW_DAYS)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

@Injectable()
export class YoutubeDataService extends DataCubeBase {
  private readonly logger = new Logger(YoutubeDataService.name)

  constructor(
    readonly youtubeService: YoutubeService,
    private readonly youtubeAnalyticsService: YoutubeAnalyticsService,
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

  // ──────────────────────────────────────────────────────────────────
  // Data API v3 — current totals (existing behaviour, types tightened)
  // ──────────────────────────────────────────────────────────────────

  async getAccountDataCube(accountId: string): Promise<ChannelAccountDataCube> {
    this.logger.log(`getAccountDataCube accountId: ${accountId}`)
    const res = await this.youtubeService.getChannelsList(
      accountId,
      undefined,
      undefined,
      undefined,
      true,
    )

    if (!isYoutubeResponse<YoutubeChannelItem>(res)) {
      return { fensNum: 0, arcNum: 0, playNum: 0 }
    }
    const stats = res.items?.[0]?.statistics
    return {
      fensNum: Number.parseInt(stats?.subscriberCount ?? '0', 10) || 0,
      arcNum: Number.parseInt(stats?.videoCount ?? '0', 10) || 0,
      playNum: Number.parseInt(stats?.viewCount ?? '0', 10) || 0,
    }
  }

  async getArcDataCube(accountId: string, dataId: string): Promise<ChannelArcDataCube> {
    this.logger.log('getArcDataCube', accountId, dataId)
    const res = await this.youtubeService.getVideosList(
      accountId,
      undefined,
      [dataId],
    )

    if (!isYoutubeResponse<YoutubeVideoItem>(res)) {
      return { fensNum: 0, likeNum: 0, playNum: 0, commentNum: 0 }
    }
    const stats = res.items?.[0]?.statistics
    return {
      fensNum: Number.parseInt(stats?.favoriteCount ?? '0', 10) || 0,
      likeNum: Number.parseInt(stats?.likeCount ?? '0', 10) || 0,
      playNum: Number.parseInt(stats?.viewCount ?? '0', 10) || 0,
      commentNum: Number.parseInt(stats?.commentCount ?? '0', 10) || 0,
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Analytics API v2 — daily time series for the standard data-cube
  // bulk methods. Default window: trailing 28 days.
  //
  // If the account has not yet generated viewing data (new channel) or
  // the request fails for any reason, we return an empty list rather
  // than throwing — DataCubeBase.getAccountDataBulk callers expect a
  // response, not a 5xx — and we leave a structured warn for ops.
  // ──────────────────────────────────────────────────────────────────

  async getAccountDataBulk(accountId: string): Promise<ChannelAccountDataBulk> {
    return this.getAccountDataBulkWithWindow(accountId, defaultWindow())
  }

  async getArcDataBulk(accountId: string, dataId: string): Promise<ChannelArcDataBulk> {
    const points = await this.queryVideoDailyMetrics(accountId, dataId, defaultWindow())
    return {
      recordId: '',
      dataId,
      list: points.map(p => this.toArcDataCube(p)),
    }
  }

  /**
   * Same as `getAccountDataBulk` but with an explicit window. Window is
   * `{ startDate: YYYY-MM-DD, endDate: YYYY-MM-DD }`, end inclusive.
   */
  async getAccountDataBulkWithWindow(
    accountId: string,
    window: { startDate: string, endDate: string },
  ): Promise<ChannelAccountDataBulk> {
    const points = await this.queryChannelDailyMetrics(accountId, window)
    return {
      list: points.map(p => this.toAccountDataCube(p)),
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Analytics API v2 — extra read surfaces.
  //
  // Not yet routed through DataCubeController (its interface is fixed
  // to the five DataCubeBase methods). Callers that know specifically
  // about YouTube can DI this service and ask for these directly. RFC
  // 0001 §6.3 will introduce a richer adapter contract that exposes
  // these uniformly.
  // ──────────────────────────────────────────────────────────────────

  async getAudienceDemographics(
    accountId: string,
    window?: { startDate: string, endDate: string },
  ): Promise<YoutubeAnalyticsDemographicsRow[]> {
    const auth = await this.youtubeService.buildAuthedOAuth2Client(accountId)
    return this.youtubeAnalyticsService.getAudienceDemographics(auth, window ?? defaultWindow())
  }

  async getCountryBreakdown(
    accountId: string,
    window?: { startDate: string, endDate: string },
    maxResults?: number,
  ): Promise<YoutubeAnalyticsCountryRow[]> {
    const auth = await this.youtubeService.buildAuthedOAuth2Client(accountId)
    return this.youtubeAnalyticsService.getCountryBreakdown(
      auth,
      window ?? defaultWindow(),
      maxResults,
    )
  }

  async getTrafficSources(
    accountId: string,
    window?: { startDate: string, endDate: string },
  ): Promise<YoutubeAnalyticsTrafficSourceRow[]> {
    const auth = await this.youtubeService.buildAuthedOAuth2Client(accountId)
    return this.youtubeAnalyticsService.getTrafficSources(auth, window ?? defaultWindow())
  }

  async getVideoRetention(
    accountId: string,
    videoId: string,
    window?: { startDate: string, endDate: string },
  ): Promise<YoutubeAnalyticsRetentionRow[]> {
    const auth = await this.youtubeService.buildAuthedOAuth2Client(accountId)
    return this.youtubeAnalyticsService.getVideoRetention(
      auth,
      videoId,
      window ?? defaultWindow(),
    )
  }

  // ──────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────

  private async queryChannelDailyMetrics(
    accountId: string,
    window: { startDate: string, endDate: string },
  ): Promise<YoutubeAnalyticsDailyPoint[]> {
    try {
      const auth = await this.youtubeService.buildAuthedOAuth2Client(accountId)
      return await this.youtubeAnalyticsService.getChannelDailyMetrics(auth, window)
    }
    catch (err) {
      this.logger.warn({
        path: 'youtube.dataCube.getAccountDataBulk.degraded',
        accountId,
        window,
        reason: 'analytics query failed; returning empty list',
        err: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }

  private async queryVideoDailyMetrics(
    accountId: string,
    videoId: string,
    window: { startDate: string, endDate: string },
  ): Promise<YoutubeAnalyticsDailyPoint[]> {
    try {
      const auth = await this.youtubeService.buildAuthedOAuth2Client(accountId)
      return await this.youtubeAnalyticsService.getVideoDailyMetrics(auth, videoId, window)
    }
    catch (err) {
      this.logger.warn({
        path: 'youtube.dataCube.getArcDataBulk.degraded',
        accountId,
        videoId,
        window,
        reason: 'analytics query failed; returning empty list',
        err: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }

  private toAccountDataCube(p: YoutubeAnalyticsDailyPoint): ChannelAccountDataCube {
    return {
      playNum: p.views,
      likeNum: p.likes,
      commentNum: p.comments,
      shareNum: p.shares,
      // YouTube reports gain/loss separately; expose net subscriber delta
      // as fensNum so the unified shape stays meaningful for charts.
      fensNum: p.subscribersGained - p.subscribersLost,
    }
  }

  private toArcDataCube(p: YoutubeAnalyticsDailyPoint): ChannelArcDataCube {
    return {
      playNum: p.views,
      likeNum: p.likes,
      commentNum: p.comments,
      shareNum: p.shares,
      fensNum: p.subscribersGained - p.subscribersLost,
    }
  }
}
