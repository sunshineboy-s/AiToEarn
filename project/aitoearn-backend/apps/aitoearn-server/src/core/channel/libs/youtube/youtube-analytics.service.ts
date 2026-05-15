import { Injectable, Logger } from '@nestjs/common'
import { Auth, google, youtubeAnalytics_v2 } from 'googleapis'
import {
  YoutubeAnalyticsCountryRow,
  YoutubeAnalyticsDailyPoint,
  YoutubeAnalyticsDemographicsRow,
  YoutubeAnalyticsQueryWindow,
  YoutubeAnalyticsRetentionRow,
  YoutubeAnalyticsTrafficSourceRow,
} from './youtube-analytics.interface'

/**
 * YouTube Analytics API v2 wrapper.
 *
 * Sister to `YoutubeApiService` (which wraps Data API v3). Kept separate
 * because:
 *   - the underlying client is a different `google.youtubeAnalytics`
 *     namespace, not `google.youtube`
 *   - Data API v3 is the truth for "current totals"; Analytics API v2 is
 *     the truth for "time series, demographics, retention" — different
 *     reliability and rate-limit profiles
 *   - keeping them separate makes the two cost centres (Data quota vs
 *     Analytics quota) observable
 *
 * Auth: every method takes a fresh `OAuth2Client` from the caller. We do
 * not retain a client instance on this service to avoid the shared-state
 * concurrency footgun that exists in YoutubeService.oauth2Client today
 * (RFC 0001 §6.3 will address the broader concurrency story; this service
 * just sidesteps it).
 */
@Injectable()
export class YoutubeAnalyticsService {
  private readonly logger = new Logger(YoutubeAnalyticsService.name)

  /** Build a per-call analytics client; never reused across requests. */
  private buildClient(auth: Auth.OAuth2Client) {
    return google.youtubeAnalytics({ version: 'v2', auth })
  }

  /**
   * Map a `reports.query` response (columnHeaders + rows) to a typed array.
   * Skips rows that are missing required columns; logs once per shape.
   */
  private mapRows<T extends object>(
    res: youtubeAnalytics_v2.Schema$QueryResponse,
    project: (lookup: (col: string) => unknown) => T | null,
  ): T[] {
    const headers = res.columnHeaders ?? []
    const rows = res.rows ?? []
    const indexByName = new Map<string, number>()
    headers.forEach((h, i) => {
      if (h.name)
        indexByName.set(h.name, i)
    })
    const out: T[] = []
    for (const row of rows) {
      const lookup = (col: string): unknown => {
        const idx = indexByName.get(col)
        return idx === undefined ? undefined : row[idx]
      }
      const projected = project(lookup)
      if (projected !== null)
        out.push(projected)
    }
    return out
  }

  private toNum(v: unknown): number {
    if (typeof v === 'number')
      return v
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    return 0
  }

  private toStr(v: unknown): string {
    return typeof v === 'string' ? v : ''
  }

  /**
   * Channel-level daily time series.
   *
   * Returns one point per day in the requested window, sorted ascending.
   * Use for `getAccountDataBulk` time series.
   */
  async getChannelDailyMetrics(
    auth: Auth.OAuth2Client,
    window: YoutubeAnalyticsQueryWindow,
  ): Promise<YoutubeAnalyticsDailyPoint[]> {
    try {
      const client = this.buildClient(auth)
      const res = await client.reports.query({
        ids: 'channel==MINE',
        startDate: window.startDate,
        endDate: window.endDate,
        metrics: [
          'views',
          'averageViewDuration',
          'averageViewPercentage',
          'estimatedMinutesWatched',
          'likes',
          'comments',
          'shares',
          'subscribersGained',
          'subscribersLost',
        ].join(','),
        dimensions: 'day',
        sort: 'day',
      })
      return this.mapRows<YoutubeAnalyticsDailyPoint>(res.data, lookup => ({
        day: this.toStr(lookup('day')),
        views: this.toNum(lookup('views')),
        averageViewDuration: this.toNum(lookup('averageViewDuration')),
        averageViewPercentage: this.toNum(lookup('averageViewPercentage')),
        estimatedMinutesWatched: this.toNum(lookup('estimatedMinutesWatched')),
        likes: this.toNum(lookup('likes')),
        comments: this.toNum(lookup('comments')),
        shares: this.toNum(lookup('shares')),
        subscribersGained: this.toNum(lookup('subscribersGained')),
        subscribersLost: this.toNum(lookup('subscribersLost')),
      }))
    }
    catch (err) {
      this.logger.error({
        path: 'youtube.analytics.getChannelDailyMetrics',
        window,
        err,
      })
      throw err
    }
  }

  /**
   * Per-video daily time series. Same metrics as channel-daily, scoped
   * to a single videoId. Use for `getArcDataBulk` time series.
   */
  async getVideoDailyMetrics(
    auth: Auth.OAuth2Client,
    videoId: string,
    window: YoutubeAnalyticsQueryWindow,
  ): Promise<YoutubeAnalyticsDailyPoint[]> {
    try {
      const client = this.buildClient(auth)
      const res = await client.reports.query({
        ids: 'channel==MINE',
        startDate: window.startDate,
        endDate: window.endDate,
        filters: `video==${videoId}`,
        metrics: [
          'views',
          'averageViewDuration',
          'averageViewPercentage',
          'estimatedMinutesWatched',
          'likes',
          'comments',
          'shares',
          'subscribersGained',
          'subscribersLost',
        ].join(','),
        dimensions: 'day',
        sort: 'day',
      })
      return this.mapRows<YoutubeAnalyticsDailyPoint>(res.data, lookup => ({
        day: this.toStr(lookup('day')),
        views: this.toNum(lookup('views')),
        averageViewDuration: this.toNum(lookup('averageViewDuration')),
        averageViewPercentage: this.toNum(lookup('averageViewPercentage')),
        estimatedMinutesWatched: this.toNum(lookup('estimatedMinutesWatched')),
        likes: this.toNum(lookup('likes')),
        comments: this.toNum(lookup('comments')),
        shares: this.toNum(lookup('shares')),
        subscribersGained: this.toNum(lookup('subscribersGained')),
        subscribersLost: this.toNum(lookup('subscribersLost')),
      }))
    }
    catch (err) {
      this.logger.error({
        path: 'youtube.analytics.getVideoDailyMetrics',
        videoId,
        window,
        err,
      })
      throw err
    }
  }

  /**
   * Audience demographics breakdown — age × gender × viewer percentage.
   * Aggregated over the window; not a time series.
   */
  async getAudienceDemographics(
    auth: Auth.OAuth2Client,
    window: YoutubeAnalyticsQueryWindow,
  ): Promise<YoutubeAnalyticsDemographicsRow[]> {
    try {
      const client = this.buildClient(auth)
      const res = await client.reports.query({
        ids: 'channel==MINE',
        startDate: window.startDate,
        endDate: window.endDate,
        metrics: 'viewerPercentage',
        dimensions: 'ageGroup,gender',
        sort: 'gender,ageGroup',
      })
      return this.mapRows<YoutubeAnalyticsDemographicsRow>(res.data, lookup => ({
        ageGroup: this.toStr(lookup('ageGroup')),
        gender: this.toStr(lookup('gender')),
        viewerPercentage: this.toNum(lookup('viewerPercentage')),
      }))
    }
    catch (err) {
      this.logger.error({
        path: 'youtube.analytics.getAudienceDemographics',
        window,
        err,
      })
      throw err
    }
  }

  /**
   * Geo breakdown — country × views/watch-time/avg duration. Aggregated
   * over the window. Default `maxResults=25` (top 25 countries by views).
   */
  async getCountryBreakdown(
    auth: Auth.OAuth2Client,
    window: YoutubeAnalyticsQueryWindow,
    maxResults = 25,
  ): Promise<YoutubeAnalyticsCountryRow[]> {
    try {
      const client = this.buildClient(auth)
      const res = await client.reports.query({
        ids: 'channel==MINE',
        startDate: window.startDate,
        endDate: window.endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration',
        dimensions: 'country',
        sort: '-views',
        maxResults,
      })
      return this.mapRows<YoutubeAnalyticsCountryRow>(res.data, lookup => ({
        country: this.toStr(lookup('country')),
        views: this.toNum(lookup('views')),
        estimatedMinutesWatched: this.toNum(lookup('estimatedMinutesWatched')),
        averageViewDuration: this.toNum(lookup('averageViewDuration')),
      }))
    }
    catch (err) {
      this.logger.error({
        path: 'youtube.analytics.getCountryBreakdown',
        window,
        err,
      })
      throw err
    }
  }

  /**
   * Where the views come from — search, suggested, external, etc.
   * Aggregated over the window.
   */
  async getTrafficSources(
    auth: Auth.OAuth2Client,
    window: YoutubeAnalyticsQueryWindow,
  ): Promise<YoutubeAnalyticsTrafficSourceRow[]> {
    try {
      const client = this.buildClient(auth)
      const res = await client.reports.query({
        ids: 'channel==MINE',
        startDate: window.startDate,
        endDate: window.endDate,
        metrics: 'views,estimatedMinutesWatched',
        dimensions: 'insightTrafficSourceType',
        sort: '-views',
      })
      return this.mapRows<YoutubeAnalyticsTrafficSourceRow>(res.data, lookup => ({
        insightTrafficSourceType: this.toStr(lookup('insightTrafficSourceType')),
        views: this.toNum(lookup('views')),
        estimatedMinutesWatched: this.toNum(lookup('estimatedMinutesWatched')),
      }))
    }
    catch (err) {
      this.logger.error({
        path: 'youtube.analytics.getTrafficSources',
        window,
        err,
      })
      throw err
    }
  }

  /**
   * Audience retention curve for a single video — at what % of the video
   * does each fraction of the audience drop off? Useful for hook tuning.
   */
  async getVideoRetention(
    auth: Auth.OAuth2Client,
    videoId: string,
    window: YoutubeAnalyticsQueryWindow,
  ): Promise<YoutubeAnalyticsRetentionRow[]> {
    try {
      const client = this.buildClient(auth)
      const res = await client.reports.query({
        ids: 'channel==MINE',
        startDate: window.startDate,
        endDate: window.endDate,
        filters: `video==${videoId};audienceType==ORGANIC`,
        metrics: 'audienceWatchRatio,relativeRetentionPerformance',
        dimensions: 'elapsedVideoTimeRatio',
        sort: 'elapsedVideoTimeRatio',
      })
      return this.mapRows<YoutubeAnalyticsRetentionRow>(res.data, lookup => ({
        elapsedVideoTimeRatio: this.toNum(lookup('elapsedVideoTimeRatio')),
        audienceWatchRatio: this.toNum(lookup('audienceWatchRatio')),
        relativeRetentionPerformance: this.toNum(lookup('relativeRetentionPerformance')),
      }))
    }
    catch (err) {
      this.logger.error({
        path: 'youtube.analytics.getVideoRetention',
        videoId,
        window,
        err,
      })
      throw err
    }
  }
}
