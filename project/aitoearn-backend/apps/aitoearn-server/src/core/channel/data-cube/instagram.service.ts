import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import {
  InstagramInsightsBreakdownResult,
  InstagramInsightsRequest,
  InstagramInsightsResult,
  InstagramMediaInsightsRequest,
} from '../libs/instagram/instagram.interfaces'
import { InstagramService } from '../platforms/meta/instagram.service'
import { DataCubeBase } from './data.base'

/**
 * 把同一个时间戳下的多个 metric 拍平成一行，便于上层直接 JSON 返回。
 *
 * IG `getAccountInsights` 在 `period=day` 下的返回形如:
 *   data: [
 *     { name: 'views',    period: 'day', values: [{ end_time, value }, ...] },
 *     { name: 'reach',    period: 'day', values: [{ end_time, value }, ...] },
 *     { name: 'likes',    period: 'day', values: [{ end_time, value }, ...] },
 *     ...
 *   ]
 *
 * 我们要的是 ChannelAccountDataBulk 的扁平结构（每个时间点一行，
 * 各 metric 作为列），所以按 end_time 分组重新拼装。
 *
 * `values` 上没有 end_time 字段的（IG 的 `total_value`-only metric），
 * 这里直接忽略——它们由 getAccountDataCube 覆盖。
 */
function flattenTimeSeries(data: InstagramInsightsResult[]): Array<Record<string, number>> {
  const buckets = new Map<string, Record<string, number>>()
  for (const result of data) {
    for (const v of result.values ?? []) {
      const endTime = (v as { end_time?: string }).end_time
      if (!endTime || typeof v.value !== 'number')
        continue
      let row = buckets.get(endTime)
      if (!row) {
        row = { ts: Date.parse(endTime) }
        buckets.set(endTime, row)
      }
      row[result.name] = v.value
    }
  }
  return [...buckets.values()].sort((a, b) => (a['ts'] ?? 0) - (b['ts'] ?? 0))
}

/**
 * 把 `total_value.breakdowns` 结构拍平成 [{dim_a, dim_b, value}, ...]
 *
 * IG demographics / city / country 等 breakdown metric 在
 * metric_type=total_value 下返回:
 *   total_value: [{
 *     breakdowns: [{
 *       dimension_keys: ['age', 'gender'],
 *       results: [{ dimension_values: ['25-34', 'male'], value: 123 }, ...]
 *     }]
 *   }]
 */
function flattenBreakdown(result: InstagramInsightsResult | undefined): Array<Record<string, string | number>> {
  if (!result?.total_value)
    return []
  const out: Array<Record<string, string | number>> = []
  for (const tv of result.total_value) {
    for (const bd of tv.breakdowns ?? []) {
      const keys = bd.dimension_keys
      for (const r of bd.results as InstagramInsightsBreakdownResult[]) {
        const row: Record<string, string | number> = { value: r.value }
        keys.forEach((k, i) => {
          row[k] = r.dimension_values[i]
        })
        out.push(row)
      }
    }
  }
  return out
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

  async getAccountDataCube(accountId: string) {
    const query = {
      fields: 'media_count,followers_count,follows_count',
    }
    const res = await this.instagramService.getAccountInfo(accountId, query)
    return {
      fensNum: res?.followers_count,
      arcNum: res?.media_count,
    }
  }

  /**
   * 账户增量数据（最近 30 天，按日）
   *
   * 来源：Instagram Graph API GET `/{ig-user-id}/insights`
   * - period=day
   * - metric=views,reach,likes,comments,shares,saved,follows_and_unfollows
   *
   * 注意：
   * - 不同 metric 在 period=day 下的可用性不同（例如 `follows_and_unfollows`
   *   只在 metric_type=total_value 下可用，不会出现在每日时序里）。
   * - 数据有 ~24h 延迟，最新一天可能为 0。
   */
  async getAccountDataBulk(accountId: string) {
    const now = Math.floor(Date.now() / 1000)
    const since = now - 30 * 24 * 3600
    const query: InstagramInsightsRequest = {
      metric: 'views,reach,likes,comments,shares,saved',
      period: 'day',
      since,
      until: now,
    }
    try {
      const res = await this.instagramService.getAccountInsights(accountId, query)
      const rows = flattenTimeSeries(res?.data ?? [])
      return {
        list: rows.map(r => ({
          playNum: r['views'] ?? 0,
          reachNum: r['reach'] ?? 0,
          likeNum: r['likes'] ?? 0,
          commentNum: r['comments'] ?? 0,
          shareNum: r['shares'] ?? 0,
          collectNum: r['saved'] ?? 0,
          ts: r['ts'] ?? 0,
        })),
      }
    }
    catch (err) {
      this.logger.warn(`getAccountDataBulk failed for ${accountId}: ${(err as Error).message}`)
      return { list: [] }
    }
  }

  async getArcDataCube(accountId: string, dataId: string) {
    const query: InstagramMediaInsightsRequest = {
      metric: 'comments,likes,shares,views',
      period: 'lifetime',
    }
    const res = await this.instagramService.getMediaInsights(accountId, dataId, query)
    return {
      commentNum: res?.data?.filter(item => item.name === 'comments')[0]?.values[0]?.value || 0,
      likeNum: res?.data?.filter(item => item.name === 'likes')[0]?.values[0]?.value || 0,
      shareNum: res?.data?.filter(item => item.name === 'shares')[0]?.values[0]?.value || 0,
      viewNum: res?.data?.filter(item => item.name === 'views')[0]?.values[0]?.value || 0,
    }
  }

  // Todo : Implement bulk data retrieval for crawler service
  async getArcDataBulk(accountId: string, dataId: string) {
    this.logger.log('getArcDataBulk', accountId, dataId)
    return {
      recordId: '',
      dataId: '',
      list: [],
    }
  }

  /**
   * 受众画像 — 性别 × 年龄分布
   *
   * 来源：IG Graph API `engaged_audience_demographics` metric
   *      with breakdown=age,gender, metric_type=total_value, timeframe=last_30_days
   *
   * 文档：https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
   *
   * 返回 [{ age: '25-34', gender: 'M', value: 123 }, ...]
   */
  async getAudienceDemographics(accountId: string) {
    try {
      const res = await this.instagramService.getAccountInsights(accountId, {
        metric: 'engaged_audience_demographics',
        // eslint-disable-next-line ts/no-explicit-any
        breakdown: 'age,gender' as any, // IG API 接受逗号分隔的 breakdown 列表，类型枚举只列单值
        metric_type: 'total_value',
        // eslint-disable-next-line ts/no-explicit-any
        timeframe: 'last_30_days' as any,
      } as InstagramInsightsRequest)
      const result = res?.data?.find(d => d.name === 'engaged_audience_demographics')
      return flattenBreakdown(result)
    }
    catch (err) {
      this.logger.warn(`getAudienceDemographics failed for ${accountId}: ${(err as Error).message}`)
      return []
    }
  }

  /**
   * 受众地理分布（按国家）
   *
   * 来源：IG `engaged_audience_demographics` with breakdown=country
   * 返回 [{ country: 'US', value: 1234 }, ...]
   */
  async getAudienceByCountry(accountId: string) {
    try {
      const res = await this.instagramService.getAccountInsights(accountId, {
        metric: 'engaged_audience_demographics',
        // eslint-disable-next-line ts/no-explicit-any
        breakdown: 'country' as any,
        metric_type: 'total_value',
        // eslint-disable-next-line ts/no-explicit-any
        timeframe: 'last_30_days' as any,
      } as InstagramInsightsRequest)
      const result = res?.data?.find(d => d.name === 'engaged_audience_demographics')
      return flattenBreakdown(result)
    }
    catch (err) {
      this.logger.warn(`getAudienceByCountry failed for ${accountId}: ${(err as Error).message}`)
      return []
    }
  }

  /**
   * 受众地理分布（按城市）
   * IG 限制：仅 top 100 城市，且需要满足最少观众数（约 100 人）才会返回结果。
   */
  async getAudienceByCity(accountId: string) {
    try {
      const res = await this.instagramService.getAccountInsights(accountId, {
        metric: 'engaged_audience_demographics',
        // eslint-disable-next-line ts/no-explicit-any
        breakdown: 'city' as any,
        metric_type: 'total_value',
        // eslint-disable-next-line ts/no-explicit-any
        timeframe: 'last_30_days' as any,
      } as InstagramInsightsRequest)
      const result = res?.data?.find(d => d.name === 'engaged_audience_demographics')
      return flattenBreakdown(result)
    }
    catch (err) {
      this.logger.warn(`getAudienceByCity failed for ${accountId}: ${(err as Error).message}`)
      return []
    }
  }

  /**
   * 关注 / 取关明细（最近 30 天，total_value 维度）
   *
   * IG 在 metric_type=total_value 下把这两个数合并到 follows_and_unfollows
   * metric 里，breakdown=follow_type 拆出 followers / unfollowers。
   */
  async getFollowsBreakdown(accountId: string) {
    try {
      const res = await this.instagramService.getAccountInsights(accountId, {
        metric: 'follows_and_unfollows',
        // eslint-disable-next-line ts/no-explicit-any
        breakdown: 'follow_type' as any,
        metric_type: 'total_value',
        // eslint-disable-next-line ts/no-explicit-any
        timeframe: 'last_30_days' as any,
      } as InstagramInsightsRequest)
      const result = res?.data?.find(d => d.name === 'follows_and_unfollows')
      return flattenBreakdown(result)
    }
    catch (err) {
      this.logger.warn(`getFollowsBreakdown failed for ${accountId}: ${(err as Error).message}`)
      return []
    }
  }
}
