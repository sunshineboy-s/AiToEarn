import crypto from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { config } from '../../../../config'
import {
  DouyinAccessTokenInfo,
  DouyinClientTokenInfo,
  DouyinFansDataPoint,
  DouyinItemBaseStat,
  DouyinItemDailyStat,
  DouyinOpenTicketInfo,
  DouyinShareSchemaOptions,
  DouyinUserInfo,
  DouyRefreshTokenInfo,
} from './common'

/**
 * 抖音开放平台数据接口的统一返回包装。
 * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission
 */
interface DouyinDataEnvelope<T> {
  data: T & {
    error_code?: number
    description?: string
  }
  extra: {
    error_code: number // 0 表示成功
    description: string
    sub_error_code: number
    sub_description: string
    logid: string
    now: number
  }
}

@Injectable()
export class DouyinApiService {
  private readonly logger = new Logger(DouyinApiService.name)
  private readonly appId: string
  private readonly appSecret: string

  constructor() {
    const cfg = config.channel.douyin
    this.appId = cfg.id
    this.appSecret = cfg.secret
  }

  /**
   * 获取登陆授权页
   * @param redirectURL 回调地址
   * @returns
   */
  getAuthPage(redirectURL: string, taskId: string) {
    // 数据 API 需要额外申请 scope，且需要在抖音开放平台完成应用审核。
    // 对未通过 scope 审核的应用，开放平台会自动忽略未授权 scope，不影响 user_info 部分。
    const scopes = ['user_info', 'data.external.user', 'data.external.item.base']
    const url = `https://open.douyin.com/platform/oauth/connect?client_key=${this.appId}&response_type=code&scope=${scopes.join(',')}&redirect_uri=${redirectURL}&state=${taskId}`
    return {
      url,
      taskId,
    }
  }

  /**
   * 设置用户的授权Token
   *curl --location 'https://open.douyin.com/oauth/access_token/' \
--header 'content-type: application/x-www-form-urlencoded' \
--data-urlencode 'client_key=tt10abc****' \
--data-urlencode 'client_secret=7802f4e6f243e659d51135445fe******' \
--data-urlencode 'code=ffab5ec26cd958fditn2GNr8Wx5m0i******' \
--data-urlencode 'grant_type=authorization_code'
   * @param code
   * @returns
   */
  async getAccessToken(code: string) {
    try {
      const messageRes = await axios.post<{
        data: DouyinAccessTokenInfo
        message: 'success' | 'error'
      }>('https://open.douyin.com/oauth/access_token/', {
        client_key: this.appId,
        client_secret: this.appSecret,
        code,
        grant_type: 'authorization_code',
      })
      if (messageRes.data.message !== 'success') {
        this.logger.error({
          path: 'douyin getAccessToken error',
          data: messageRes.data,
        })
        throw new Error(messageRes.data.data.description)
      }
      return messageRes.data.data
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getAccessToken error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 刷新授权Token
   * curl --location --request POST 'https://open.douyin.com/oauth/refresh_token/' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_key=tt10abc****' \
--data-urlencode 'grant_type=refresh_token' \
--data-urlencode 'refresh_token=rft.a736b70544519999a623d67******'
   */
  async refreshAccessToken(refreshToken: string): Promise<DouyinAccessTokenInfo> {
    try {
      const messageRes = await axios.post<{
        data: DouyinAccessTokenInfo
        message: 'success' | 'error'
      }>('https://open.douyin.com/oauth/refresh_token/', {
        client_key: this.appId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      if (messageRes.data.message !== 'success') {
        this.logger.error({
          path: 'douyin refreshAccessToken error',
          data: messageRes.data,
        })
        throw new Error(messageRes.data.data.description)
      }
      return messageRes.data.data
    }
    catch (error) {
      this.logger.error({
        path: 'douyin refreshAccessToken error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 重置刷新token
   * curl --location --request POST 'https://open.douyin.com/oauth/renew_refresh_token/' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_key=tt10abc******' \
--data-urlencode 'refresh_token=rft.a736b70544519999a6******'
   * @param refreshToken
   * @returns
   */
  async renewRefreshToken(refreshToken: string): Promise<DouyRefreshTokenInfo> {
    try {
      const messageRes = await axios.post<{
        data: DouyRefreshTokenInfo
        message: 'success' | 'error'
      }>('https://open.douyin.com/oauth/renew_refresh_token/', {
        client_key: this.appId,
        refresh_token: refreshToken,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      if (messageRes.data.message !== 'success') {
        this.logger.error({
          path: 'douyin refreshAccessToken error',
          data: messageRes.data,
        })
        throw new Error(messageRes.data.data.description)
      }
      return messageRes.data.data
    }
    catch (error) {
      this.logger.error({
        path: 'douyin refreshAccessToken error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 获取授权用户信息
   * curl --location --request POST 'https://open.douyin.com/oauth/userinfo/' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'open_id=ba253642-0590-40bc-9bdf-9a1334******' \
--data-urlencode 'access_token=act.1d1021d2aee3d41fee2d2add43456badMFZnrhFhfWotu3Ecuiuka2******'
   * @param accessToken
   * @returns
   */
  async getAccountInfo(accessToken: string, openId: string): Promise<DouyinUserInfo> {
    try {
      const messageRes = await axios.post<{
        err_msg: string// "access_token无效",
        log_id: string // "2025032716200991A181xxxx0A01C4DF",
        data: DouyinUserInfo
        err_no: number // 28001003 | 0
      }>('https://open.douyin.com/oauth/userinfo/', {
        access_token: accessToken,
        open_id: openId,
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      if (messageRes.data.err_no !== 0) {
        this.logger.error({
          path: 'douyin getAccountInfo error',
          data: messageRes.data,
        })
        throw new Error(messageRes.data.err_msg)
      }
      this.logger.log({
        path: 'douyin getAccountInfo',
        data: messageRes.data,
      })
      return messageRes.data.data
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getAccountInfo error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 获取发布的ClientToken
   * curl --location 'https://open.douyin.com/oauth/client_token/' \
--header 'Content-Type: application/json' \
--data '{
    "grant_type": "client_credential",
    "client_key": "ttxxxxxx",
    "client_secret": "7802f4e6f243e659d51135445fe********"
}'
   * 注意事项
client_token 的有效时间为 2 个小时，重复获取 client_token 后会使上次的 client_token 失效（但有 5 分钟的缓冲时间，连续多次获取 client_token 只会保留最新的两个 client_token）。
禁止频繁调用 access-token 接口（频控规则：5 分钟内超过 500 次接口调用，接口报错，错误码 10020）。
   * @returns
   */
  async getClientToken(): Promise<DouyinClientTokenInfo> {
    try {
      const messageRes = await axios.post<{
        data: DouyinClientTokenInfo
        message: 'success' | 'error'
      }>('https://open.douyin.com/oauth/client_token/', {
        client_key: this.appId,
        client_secret: this.appSecret,
        grant_type: 'client_credential',
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (messageRes.data.message !== 'success') {
        this.logger.error({
          path: 'douyin getClientToken error',
          data: messageRes.data,
        })
        throw new Error(messageRes.data.data.description)
      }
      return messageRes.data.data
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getClientToken error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 获取发布的Ticket
   * curl --location --request GET 'https://open.douyin.com/open/getticket/' \
--header 'access-token: 0801121846735352506a356a6' \
--header 'content-type: application/json' \
   * @param accessToken
   * @returns
   */
  async getOpenTicket(accessToken: string): Promise<DouyinOpenTicketInfo> {
    try {
      const messageRes = await axios.get<{
        data: DouyinOpenTicketInfo
        extra: {
          error_code: number // 194419824476518240,
          description: string// "4ofLsgut31",
          sub_error_code: number// 6379673012362899000,
          sub_description: string// "LxPxJC1huy",
          logid: string// "202008121419360101980821035705926A",
          now: number// 7828129512053491000
        }
      }>('https://open.douyin.com/open/getticket/', {
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken,
        },
      })
      return messageRes.data.data
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getOpenTicket error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 获取分享ID
   * curl --location --request GET 'https://open.douyin.com/share-id/?need_callback=&source_style_id=&default_hashtag=&link_param=' \
--header 'access-token: clt.943da17996fb5cebfbc70c044c3fc25a57T54DcjT6HNKGqnUdxzy1KcxFnZ' \
   * @param clientToken
   * @returns
   */
  async getShareid(clientToken: string): Promise<string> {
    try {
      const messageRes = await axios.get<{
        extra: {
          description: string// "",
          sub_error_code: number// 0,
          sub_description: string// "",
          logid: string// "202008121419360101980821035705926A",
          now: number// 1597213176393,
          error_code: number// 0
        }
        data: {
          share_id: string// "15674132978",
          error_code: number// 0,
          description: string// ""
        }
      }>(`https://open.douyin.com/share-id/?need_callback=true&default_hashtag=hashtag`, {
        headers: {
          'Content-Type': 'application/json',
          'access-token': clientToken,
        },
      })
      if (messageRes.data.extra.error_code !== 0) {
        this.logger.error({
          path: 'douyin getShareid error',
          data: messageRes.data,
        })
        throw new Error(messageRes.data.data.description)
      }
      return messageRes.data.data.share_id
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getShareid error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  /**
   * 生成分享 Schema
   * @param ticket Open Ticket
   * @param options 分享选项
   * @returns 分享 Schema URL
   */
  async generateShareSchema(ticket: string, options: DouyinShareSchemaOptions): Promise<string> {
    const { video_path, image_list_path } = options
    try {
      const nonceStr = this.generateNonceStr(32)
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signature = this.generateSignature(ticket, nonceStr, timestamp)

      const url = new URL('snssdk1128://openplatform/share')
      const query = url.searchParams
      query.append('client_key', this.appId)
      if (options?.shareId) {
        query.append('state', options.shareId)
      }
      query.append('nonce_str', nonceStr)
      if (options?.title) {
        query.append('title', options.title)
      }
      if (options?.short_title) {
        query.append('short_title', options.short_title)
      }
      query.append('timestamp', timestamp)
      query.append('signature', signature)
      query.append('share_type', 'h5')

      if (video_path) {
        query.append('video_path', video_path)
        query.append('share_to_publish', '1')
      }
      if (image_list_path) {
        query.append('image_list_path', JSON.stringify(image_list_path))
      }

      if (options?.hashtag_list) {
        query.append('hashtag_list', JSON.stringify(options.hashtag_list))
      }
      if (options?.title_hashtag_list?.length) {
        query.append('title_hashtag_list', JSON.stringify(options.title_hashtag_list))
      }
      if (options?.downloadType) {
        query.append('download_type', String(options.downloadType))
      }
      if (options?.privateStatus !== undefined) {
        query.append('private_status', String(options.privateStatus))
      }
      return url.toString().replace(/\+/g, '%20')
    }
    catch (error) {
      this.logger.error({
        path: 'douyin generateShareSchema error',
        data: error,
      })
      throw new Error(String(error))
    }
  }

  private generateNonceStr(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const randomValues = new Uint32Array(length)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length]
    }
    return result
  }

  /**
   * 生成签名
   * 根据 ticket 和其它字段进行签名计算
参与签名的字段包括：•nonce_str（随机字符串）•有效的 ticket •timestamp（秒级时间戳，类型为 String）
例如：
参数 nonce_str ticket timestamp
签名计算：
1.
对所有待签名参数按照字段名的 ASCII 码从小到大排序（字典序）后，使用 URL 键值对的格式（即 key1=value1&key2=value2…）拼接成字符串 string1：nonce_str=Wm3WZYTPz0wzccnW&ticket=@ml6sqYBGgTKmQNajnKNkaj8yksCAY++adIhlGIqfTiKyvBqOIkzdJ6WRgP+nO+wtVItqKbX4iZ+mFIYkyPJjpQ==&timestamp=1650941858
2.
对 string1 进行 MD5 签名，得到 signature:3f7b739a91a52cb7d85c4f89c5f611fe。
   * @param ticket Open Ticket
   * @param nonceStr 随机字符串
   * @param timestamp 时间戳
   * @returns 签名
   */
  private generateSignature(ticket: string, nonceStr: string, timestamp: string): string {
    const signStr = `nonce_str=${nonceStr}&ticket=${ticket}&timestamp=${timestamp}`
    return crypto.createHash('md5').update(signStr).digest('hex')
  }

  /**
   * 调用抖音开放平台数据 API 的统一封装
   *
   * - 所有 data API 请求都需要 `access-token` header + `open_id` query param
   * - 成功时 `extra.error_code === 0`
   * - 失败时返回 envelope 仍是 200，需读 `extra.error_code` / `description`
   *
   * 错误处理策略：fail-soft —— 即使业务报错（如未授权 scope / open_id 不匹配 /
   * 数据为空）也只打 warn 日志并由调用方决定 fallback。这样不会破坏现有的
   * data-cube 接口契约（返回 0 而不是 throw）。
   */
  private async callDataApi<T>(
    path: string,
    accessToken: string,
    openId: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<DouyinDataEnvelope<T> | null> {
    const query = new URLSearchParams()
    query.append('open_id', openId)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value))
      }
    }
    const url = `https://open.douyin.com${path}?${query.toString()}`

    try {
      const res = await axios.get<DouyinDataEnvelope<T>>(url, {
        headers: {
          'access-token': accessToken,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      })
      const env = res.data
      if (env?.extra?.error_code !== 0) {
        this.logger.warn({
          path: `douyin data api ${path} returned error`,
          extra: env?.extra,
          // 不打 access_token，但保留 open_id 以便排障
          openId,
          params,
        })
        return null
      }
      return env
    }
    catch (error) {
      // 网络/HTTP 错误 → 也走 fail-soft，让 data-cube 返回 0 而不是把整个请求挂掉
      this.logger.error({
        path: `douyin data api ${path} request failed`,
        message: error instanceof Error ? error.message : String(error),
        openId,
        params,
      })
      return null
    }
  }

  /**
   * 获取用户数据（账号粉丝/作品总数）
   *
   * 抖音开放平台没有"全量账号统计"的单一端点。这里取最近 30 天的粉丝数据点的
   * 末位 `total_fans` 作为粉丝数；作品总数走 `data/external/user/item`。
   *
   * - GET /data/external/user/fans?open_id=xxx&date_type=30
   * - GET /data/external/user/item?open_id=xxx&date_type=30
   *
   * @returns 与历史 stub 兼容的字段（arc_passed_total / follower / following）。
   *          API 不返回 following 时填 0 — 这是数据 API 的客观约束。
   */
  async getUserStat(accessToken: string, openId: string) {
    const fallback = {
      arc_passed_total: 0,
      follower: 0,
      following: 0,
    }
    if (!openId) {
      this.logger.warn('douyin getUserStat: empty openId, returning fallback')
      return fallback
    }

    const [fansEnv, itemEnv] = await Promise.all([
      this.callDataApi<{ result_list: DouyinFansDataPoint[] }>(
        '/data/external/user/fans/',
        accessToken,
        openId,
        { date_type: 30 },
      ),
      this.callDataApi<{ result_list: { new_issue: number, total_issue?: number, date: string }[] }>(
        '/data/external/user/item/',
        accessToken,
        openId,
        { date_type: 30 },
      ),
    ])

    const lastFans = fansEnv?.data?.result_list?.at(-1)
    const itemList = itemEnv?.data?.result_list || []
    const arcPassedTotal = itemList.reduce((sum, p) => sum + (p.new_issue || 0), 0)

    return {
      arc_passed_total: arcPassedTotal,
      follower: lastFans?.total_fans ?? 0,
      following: 0, // 抖音数据 API 不暴露 following 数；保留 0 以兼容历史契约
    }
  }

  /**
   * 获取稿件数据（单条作品的累计 stat）
   *
   * - GET /data/external/item/base?open_id=xxx&item_id=xxx
   */
  async getArcStat(accessToken: string, resourceId: string, openId?: string) {
    const fallback = {
      coin: 0,
      danmaku: 0,
      favorite: 0,
      like: 0,
      ptime: 0,
      reply: 0,
      share: 0,
      title: '',
      view: 0,
    }
    if (!openId || !resourceId) {
      this.logger.warn('douyin getArcStat: empty openId or resourceId, returning fallback')
      return fallback
    }

    const env = await this.callDataApi<DouyinItemBaseStat>(
      '/data/external/item/base/',
      accessToken,
      openId,
      { item_id: resourceId },
    )
    if (!env) {
      return fallback
    }

    const stat = env.data
    return {
      coin: 0, // 抖音不分硬币 — 仅 B 站概念，保留以兼容跨平台契约
      danmaku: 0, // 抖音作品默认无弹幕计数
      favorite: stat.favourite_count ?? 0,
      like: stat.like_count ?? stat.digg_count ?? 0,
      ptime: stat.publish_time ?? 0,
      reply: stat.comment_count ?? 0,
      share: stat.share_count ?? 0,
      title: stat.title ?? '',
      view: stat.play_count ?? stat.video_play_count ?? 0,
    }
  }

  /**
   * 获取稿件增量数据（账号最近 30 天内所有作品的合计增量）
   *
   * 当前实现：累加最近 30 天 daily 列表里 like/comment/share/play 的增量。
   * 抖音的硬币/弹幕/电池字段都不存在，这里保留 0 以保持跨平台返回契约一致。
   *
   * 注意：每个指标单独一个端点。这里一次性并发 5 个请求；如果某个端点失败
   * 走 fail-soft 仅该指标返回 0。
   */
  async getArcIncStat(accessToken: string, openId?: string) {
    const fallback = {
      inc_click: 0,
      inc_coin: 0,
      inc_dm: 0,
      inc_elec: 0,
      inc_fav: 0,
      inc_like: 0,
      inc_reply: 0,
      inc_share: 0,
    }
    if (!openId) {
      this.logger.warn('douyin getArcIncStat: empty openId, returning fallback')
      return fallback
    }

    const sumDailyMetric = async (path: string, metricKey: string) => {
      const env = await this.callDataApi<{
        result_list: Array<Record<string, number | string>>
      }>(path, accessToken, openId, { date_type: 30 })
      const list = env?.data?.result_list || []
      return list.reduce<number>((sum, point) => {
        const v = point?.[metricKey]
        return sum + (typeof v === 'number' ? v : 0)
      }, 0)
    }

    const [
      incLike,
      incReply,
      incShare,
      incFav,
      incClick,
    ] = await Promise.all([
      sumDailyMetric('/data/external/user/like/', 'new_like'),
      sumDailyMetric('/data/external/user/comment/', 'new_comment'),
      sumDailyMetric('/data/external/user/share/', 'new_share'),
      sumDailyMetric('/data/external/user/profile/', 'profile_uv'),
      sumDailyMetric('/data/external/user/play/', 'play_count'),
    ])

    return {
      inc_click: incClick,
      inc_coin: 0,
      inc_dm: 0,
      inc_elec: 0,
      inc_fav: incFav,
      inc_like: incLike,
      inc_reply: incReply,
      inc_share: incShare,
    }
  }

  /**
   * 获取账号按日维度的增量数据，用于绘制趋势图。
   *
   * 抖音的 `data/external/user/{fans|like|comment|share|play|profile}` 端点形状一致：
   *   { result_list: [{ date: 'yyyy-MM-dd', <metric>: number, ... }] }
   *
   * - fans: total_fans / new_fans (用 total_fans 做粉丝数序列)
   * - like / comment / share / play: 直接对应名称
   * - profile: profile_uv 作为"主页访问"，目前没有跨平台契约字段，暂不输出
   *
   * 任何端点失败 → 走 fail-soft，此项缺失填 0；不让一个指标失败拖垮整个 trend。
   */
  async getAccountDailyStat(
    accessToken: string,
    openId: string,
    dateType: 7 | 15 | 30 = 30,
  ): Promise<Array<{
    date: string
    fensNum: number
    likeNum: number
    commentNum: number
    shareNum: number
    playNum: number
  }>> {
    if (!openId) {
      this.logger.warn('douyin getAccountDailyStat: empty openId, returning empty list')
      return []
    }
    const params = { date_type: dateType }
    const [fansEnv, likeEnv, commentEnv, shareEnv, playEnv] = await Promise.all([
      this.callDataApi<{ result_list: DouyinFansDataPoint[] }>('/data/external/user/fans/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, new_like: number }[] }>('/data/external/user/like/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, new_comment: number }[] }>('/data/external/user/comment/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, new_share: number }[] }>('/data/external/user/share/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, play_count: number }[] }>('/data/external/user/play/', accessToken, openId, params),
    ])

    interface Row {
      date: string
      fensNum: number
      likeNum: number
      commentNum: number
      shareNum: number
      playNum: number
    }
    const merged = new Map<string, Row>()
    const ensure = (date: string): Row => {
      let row = merged.get(date)
      if (!row) {
        row = { date, fensNum: 0, likeNum: 0, commentNum: 0, shareNum: 0, playNum: 0 }
        merged.set(date, row)
      }
      return row
    }
    for (const p of fansEnv?.data?.result_list || []) {
      ensure(p.date).fensNum = p.total_fans ?? 0
    }
    for (const p of likeEnv?.data?.result_list || []) {
      ensure(p.date).likeNum = p.new_like ?? 0
    }
    for (const p of commentEnv?.data?.result_list || []) {
      ensure(p.date).commentNum = p.new_comment ?? 0
    }
    for (const p of shareEnv?.data?.result_list || []) {
      ensure(p.date).shareNum = p.new_share ?? 0
    }
    for (const p of playEnv?.data?.result_list || []) {
      ensure(p.date).playNum = p.play_count ?? 0
    }
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 获取作品按日维度的增量数据，用于绘制趋势图。
   * 抖音的 `data/external/item/like|comment|share|play` 端点形状一致：
   *   { result_list: [{ date: 'yyyy-MM-dd', metric: number }] }
   */
  async getArcDailyStat(
    accessToken: string,
    openId: string,
    itemId: string,
    dateType: 7 | 15 | 30 = 30,
  ): Promise<DouyinItemDailyStat[]> {
    const params = { item_id: itemId, date_type: dateType }
    const [likeEnv, commentEnv, shareEnv, playEnv] = await Promise.all([
      this.callDataApi<{ result_list: { date: string, like_count: number }[] }>('/data/external/item/like/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, comment_count: number }[] }>('/data/external/item/comment/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, share_count: number }[] }>('/data/external/item/share/', accessToken, openId, params),
      this.callDataApi<{ result_list: { date: string, play_count: number }[] }>('/data/external/item/play/', accessToken, openId, params),
    ])

    const merged = new Map<string, DouyinItemDailyStat>()
    const ensure = (date: string) => {
      let row = merged.get(date)
      if (!row) {
        row = { date, like_count: 0, comment_count: 0, share_count: 0, play_count: 0 }
        merged.set(date, row)
      }
      return row
    }
    for (const p of likeEnv?.data?.result_list || []) {
      ensure(p.date).like_count = p.like_count
    }
    for (const p of commentEnv?.data?.result_list || []) {
      ensure(p.date).comment_count = p.comment_count
    }
    for (const p of shareEnv?.data?.result_list || []) {
      ensure(p.date).share_count = p.share_count
    }
    for (const p of playEnv?.data?.result_list || []) {
      ensure(p.date).play_count = p.play_count
    }
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  async deleteArchive(accessToken: string, videoId: string) {
    this.logger.log('deleteArchive', accessToken, videoId)
    return {
      code: 0,
      message: '0',
      ttl: 1,
      data: {
        resource_id: videoId,
      },
    }
  }
}
