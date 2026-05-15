import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import {
  InstagramInsightsRequest,
  InstagramInsightsResponse,
  InstagramMediaInsightsRequest,
} from '../libs/instagram/instagram.interfaces'
import {
  ChannelAccountDataBulk,
  ChannelAccountDataCube,
  ChannelArcDataBulk,
  ChannelArcDataCube,
} from '../platforms/common'
import { InstagramService } from '../platforms/meta/instagram.service'
import { DataCubeBase } from './data.base'

/**
 * Default analytics window: trailing 28 days. Matches the YouTube
 * Analytics service default and what most Insights dashboards show.
 */
const DEFAULT_WINDOW_DAYS = 28

/**
 * Account-level metrics that the Graph API guarantees support `period=day`
 * with `since`/`until` for time-series. Excludes:
 *   - `replies` and `follows_and_unfollows` — were in the previous code
 *     but are NOT Instagram Insights metrics (those names belong to
 *     Threads / Page-level surfaces). They would 400.
 *   - `accounts_engaged` and `total_interactions` — only support
 *     `total_value`, not `period=day`.
 *
 * If we need any of those, they go in a separate aggregated call,
 * not the daily series. Keep this list strict.
 *
 * Reference:
 * https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
 */
const ACCOUNT_DAILY_METRICS = ['reach', 'views', 'likes', 'comments', 'shares'] as const
type AccountDailyMetric = typeof ACCOUNT_DAILY_METRICS[number]

interface ParsedDailyMetric {
  /** Metric name as returned by Graph API */
  name: AccountDailyMetric
  /** ISO-formatted bucket boundary returned by IG (`end_time`) */
  endTime: string
  value: number
}

function parseEndTimeToDay(value: unknown): string {
  if (typeof value === 'string')
    return value.slice(0, 10)
  return ''
}

/**
 * Project the IG Insights response (one entry per metric, each with a
 * values[] of per-day buckets) into a flat per-day-per-metric list.
 */
function flattenDaily(
  res: InstagramInsightsResponse | null | undefined,
): ParsedDailyMetric[] {
  if (!res?.data?.length)
    return []
  const out: ParsedDailyMetric[] = []
  for (const result of res.data) {
    if (!ACCOUNT_DAILY_METRICS.includes(result.name as AccountDailyMetric))
      continue
    for (const v of result.values ?? []) {
      // Each `v` for `period=day` is `{ value, end_time }`; ignore
      // breakdowns since we don't request any.
      const value = typeof v.value === 'number' ? v.value : 0
      const endTime = parseEndTimeToDay(
        (v as { end_time?: unknown }).end_time,
      )
      if (!endTime)
        continue
      out.push({
        name: result.name as AccountDailyMetric,
        endTime,
        value,
      })
    }
  }
  return out
}

/**
 * Group flat per-day-per-metric records into one bucket per day, mapped
 * onto the unified `ChannelAccountDataCube` shape. Days with no data
 * are dropped — IG only returns days that have at least one event.
 */
function groupByDay(
  parsed: ParsedDailyMetric[],
): Array<ChannelAccountDataCube & { day: string }> {
  const byDay = new Map<string, ChannelAccountDataCube & { day: string }>()
  for (const m of parsed) {
    let bucket = byDay.get(m.endTime)
    if (!bucket) {
      bucket = { day: m.endTime }
      byDay.set(m.endTime, bucket)
    }
    switch (m.name) {
      case 'views':
      case 'reach':
        // Both metrics map to playNum; views is the more accurate field
        // post-2024 IG migration. If both come back, views wins because
        // we iterate metrics in ACCOUNT_DAILY_METRICS order.
        bucket.playNum = m.value
        break
      case 'likes':
        bucket.likeNum = m.value
        break
      case 'comments':
        bucket.commentNum = m.value
        break
      case 'shares':
        bucket.shareNum = m.value
        break
    }
  }
  // Sort by day ascending so consumers can chart without resorting.
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
}

function defaultWindow(): { since: number, until: number } {
  const now = Math.floor(Date.now() / 1000)
  return { since: now - DEFAULT_WINDOW_DAYS * 86_400, until: now }
}

@Injectable()
export class InstagramDataService extends DataCubeBase {
  private readonly logger = new Logger(InstagramDataService.name)
  constructor(
    readonly instagramService: InstagramService,
    private readonly accountRepository: AccountRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.INSTAGRAM}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      workCount: res.arcNum,
      fansCount: res.fensNum,
    })
  }

  // ──────────────────────────────────────────────────────────────────
  // Current totals — unchanged behaviour, types tightened.
  // ──────────────────────────────────────────────────────────────────

  async getAccountDataCube(accountId: string): Promise<ChannelAccountDataCube> {
    const query = {
      fields: 'media_count,followers_count,follows_count',
    }
    const res = await this.instagramService.getAccountInfo(accountId, query)
    return {
      fensNum: res?.followers_count ?? 0,
      arcNum: res?.media_count ?? 0,
    }
  }

  async getArcDataCube(accountId: string, dataId: string): Promise<ChannelArcDataCube> {
    const query: InstagramMediaInsightsRequest = {
      metric: 'comments,likes,shares,views',
      period: 'lifetime',
    }
    const res = await this.instagramService.getMediaInsights(accountId, dataId, query)
    const findFirst = (name: string) =>
      res?.data?.find(item => item.name === name)?.values?.[0]?.value ?? 0
    return {
      commentNum: findFirst('comments'),
      likeNum: findFirst('likes'),
      shareNum: findFirst('shares'),
      playNum: findFirst('views'),
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Daily time series — wired to the existing /insights endpoint that
  // was already authorized but whose response was previously thrown
  // away. Default window: trailing 28 days.
  //
  // If the underlying Graph call fails (new account with no events,
  // transient quota error, expired token), we degrade to an empty list
  // and emit a structured warn — matching the YouTube Analytics
  // contract (RFC 0001 §7).
  // ──────────────────────────────────────────────────────────────────

  async getAccountDataBulk(accountId: string): Promise<ChannelAccountDataBulk> {
    return this.getAccountDataBulkWithWindow(accountId, defaultWindow())
  }

  async getAccountDataBulkWithWindow(
    accountId: string,
    window: { since: number, until: number },
  ): Promise<ChannelAccountDataBulk> {
    const query: InstagramInsightsRequest = {
      metric: ACCOUNT_DAILY_METRICS.join(','),
      period: 'day',
      since: window.since,
      until: window.until,
    }
    let res: InstagramInsightsResponse | null = null
    try {
      res = await this.instagramService.getAccountInsights(accountId, query)
    }
    catch (err) {
      this.logger.warn({
        path: 'instagram.dataCube.getAccountDataBulk.degraded',
        accountId,
        window,
        reason: 'insights query failed; returning empty list',
        err: err instanceof Error ? err.message : String(err),
      })
      return { list: [] }
    }
    const days = groupByDay(flattenDaily(res))
    // Strip the day-key off entries to match ChannelAccountDataCube
    // shape exactly. Day ordering is preserved.
    return {
      list: days.map(({ day: _day, ...rest }) => rest),
    }
  }

  /**
   * Per-post bulk data. Instagram Insights does NOT support `period=day`
   * for most media metrics — `views` is the only daily-bucketed media
   * metric, and even that only for video/reels. To avoid lying with
   * partial data, we keep this method as a structured stub that emits
   * a warn log on hit, matching the unsupported-base contract from
   * RFC 0001 §7.
   *
   * If a future product need wants per-post daily series, the path is
   * to (a) call media_insights with `metric=views,period=day` on
   * video/reel content only, and (b) fall back to multiple lifetime
   * snapshots stitched server-side for image posts. Both warrant their
   * own RFC review for cost vs value.
   */
  async getArcDataBulk(accountId: string, dataId: string): Promise<ChannelArcDataBulk> {
    this.logger.warn({
      path: 'instagram.dataCube.getArcDataBulk.unsupported',
      accountId,
      dataId,
      reason: 'IG Insights does not support per-day per-media bulk; see RFC 0001 §7',
    })
    return {
      recordId: '',
      dataId: '',
      list: [],
    }
  }
}
