import crypto from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { config } from '../../../../config'
import {
  DouyinAccessTokenInfo,
  DouyinClientTokenInfo,
  DouyinCommentListResp,
  DouyinCommentRepliesResp,
  DouyinCommentReplyResp,
  DouyinDataEnvelope,
  DouyinItemBaseResp,
  DouyinItemCommentResp,
  DouyinItemLikeResp,
  DouyinItemPlayResp,
  DouyinItemShareResp,
  DouyinOpenTicketInfo,
  DouyinShareSchemaOptions,
  DouyinUserFansResp,
  DouyinUserInfo,
  DouyinVideoListResp,
  DouyRefreshTokenInfo,
} from './common'

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
    const url = `https://open.douyin.com/platform/oauth/connect?client_key=${this.appId}&response_type=code&scope=user_info&redirect_uri=${redirectURL}&state=${taskId}`
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

      // if (video_path) {
      //   query.append('video_path', getZhFileUrl(video_path))
      //   query.append('share_to_publish', '1')
      // }
      // if (image_list_path) {
      //   query.append('image_list_path', JSON.stringify(image_list_path.map(getZhFileUrl)))
      // }

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

  // ============================================================
  // 数据开放服务 (Data Open API)
  // 所有接口共用的请求规范：
  // - GET 方法
  // - header `access-token`: 用户 access_token
  // - query `open_id`: 用户的 open_id
  // - 当 envelope.data.error_code !== 0 抛 Error
  //
  // 字段名根据公开 SDK 和文档样例总结，首次接入请用
  // scripts/probe-douyin.ts 校验一次
  // ============================================================

  /** 抖音数据开放 API 通用请求 */
  private async dataApiGet<T>(
    accessToken: string,
    path: string,
    query: Record<string, string | number>,
  ): Promise<T> {
    const start = Date.now()
    try {
      const res = await axios.get<DouyinDataEnvelope<T>>(
        `https://open.douyin.com${path}`,
        {
          params: query,
          headers: {
            'Content-Type': 'application/json',
            'access-token': accessToken,
          },
        },
      )
      const errCode = res.data.data?.error_code ?? res.data.extra?.error_code
      if (errCode !== 0) {
        const desc
          = res.data.data?.description
            || res.data.extra?.description
            || `douyin data api error_code=${errCode}`
        this.logger.error({
          path,
          query,
          latencyMs: Date.now() - start,
          errorCode: errCode,
          description: desc,
        })
        throw new Error(desc)
      }
      this.logger.log({
        path,
        query: { open_id: query['open_id'] },
        latencyMs: Date.now() - start,
      })
      return res.data.data
    }
    catch (error) {
      // axios 抛异常时也走这里
      if ((error as Error).message?.startsWith('douyin data api'))
        throw error
      this.logger.error({
        path,
        query,
        latencyMs: Date.now() - start,
        error: String(error),
      })
      throw new Error(String(error))
    }
  }

  /**
   * 获取用户视频列表
   * GET /api/douyin/v1/video/video_list/
   * @param accessToken 用户 access_token
   * @param openId 用户 open_id
   * @param cursor 翻页游标，首次传 0
   * @param count 每页数量，最大 20
   */
  async getVideoList(
    accessToken: string,
    openId: string,
    cursor = 0,
    count = 20,
  ): Promise<DouyinVideoListResp> {
    return this.dataApiGet<DouyinVideoListResp>(
      accessToken,
      '/api/douyin/v1/video/video_list/',
      { open_id: openId, cursor, count },
    )
  }

  /**
   * 获取用户数据
   *
   * 抖音数据开放服务把"账号粉丝"和"作品总数"拆成了不同端点：
   * - 粉丝总数：GET /data/external/user/fans/
   * - 作品总数：通过 /api/douyin/v1/video/video_list/ 翻页累计；当 has_more=false 时即为总数
   *
   * 此方法封装两次请求，返回与原 stub 形状兼容的对象：
   * { arc_passed_total, follower, following }
   *
   * NOTE follower 取最近一天的 total_fans；following 端点抖音开放平台未提供（个人主页才暴露），
   *      因此恒为 0。如需精确"关注数"，需要走另一组私域接口或忽略。
   */
  async getUserStat(accessToken: string, openId: string) {
    // 粉丝总数：拉最近 1 天即可
    const today = new Date()
    const dateStr = (d: Date) => d.toISOString().slice(0, 10)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    const fansResp = await this.dataApiGet<DouyinUserFansResp>(
      accessToken,
      '/data/external/user/fans/',
      {
        open_id: openId,
        date_type: 7,
        start_date: dateStr(yesterday),
        end_date: dateStr(today),
      },
    )
    const follower
      = fansResp.result_list?.[fansResp.result_list.length - 1]?.total_fans ?? 0

    // 作品总数：翻页累计，限制最多 50 页（1000 条）
    let cursor = 0
    let arcCount = 0
    for (let i = 0; i < 50; i++) {
      const page = await this.getVideoList(accessToken, openId, cursor, 20)
      arcCount += page.list?.length ?? 0
      if (!page.has_more)
        break
      cursor = page.cursor
    }

    return {
      arc_passed_total: arcCount,
      follower,
      following: 0,
    }
  }

  /**
   * 获取稿件数据（基础累计：截至当日）
   * GET /data/external/item/base/
   * @param accessToken 用户 access_token
   * @param openId 用户 open_id
   * @param itemId 视频 item_id
   * @returns 与原 stub 形状兼容的对象：{ view, like, reply, share, favorite, ... }
   */
  async getArcStat(
    accessToken: string,
    openId: string,
    itemId: string,
  ) {
    const today = new Date()
    const dateStr = (d: Date) => d.toISOString().slice(0, 10)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    const resp = await this.dataApiGet<DouyinItemBaseResp>(
      accessToken,
      '/data/external/item/base/',
      {
        open_id: openId,
        item_id: itemId,
        date_type: 7,
        start_date: dateStr(yesterday),
        end_date: dateStr(today),
      },
    )

    const latest = resp.result_list?.[resp.result_list.length - 1]
    return {
      coin: 0,
      danmaku: 0,
      favorite: latest?.total_collect ?? 0,
      like: latest?.total_like ?? 0,
      ptime: 0,
      reply: latest?.total_comment ?? 0,
      share: latest?.total_share ?? 0,
      title: '',
      view: latest?.total_play ?? 0,
    }
  }

  /**
   * 获取稿件按日增量数据（默认最近 7 天）
   * 通过四个独立的端点合并：play / like / comment / share
   *
   * NOTE 抖音没有提供"全字段一次拿完"的端点，需要分别请求 4 个 path。
   *      返回 { daily, summary }：
   *        - daily: 按日数组，方便上层做时序图
   *        - summary: 7 天汇总（与旧 stub 形状兼容，作为返回值的一部分）
   */
  async getArcIncStat(
    accessToken: string,
    openId: string,
    itemId: string,
    days = 7,
  ) {
    const today = new Date()
    const dateStr = (d: Date) => d.toISOString().slice(0, 10)
    const startAt = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
    const params = {
      open_id: openId,
      item_id: itemId,
      date_type: days,
      start_date: dateStr(startAt),
      end_date: dateStr(today),
    }

    const [playR, likeR, commentR, shareR] = await Promise.all([
      this.dataApiGet<DouyinItemPlayResp>(accessToken, '/data/external/item/play/', params),
      this.dataApiGet<DouyinItemLikeResp>(accessToken, '/data/external/item/like/', params),
      this.dataApiGet<DouyinItemCommentResp>(accessToken, '/data/external/item/comment/', params),
      this.dataApiGet<DouyinItemShareResp>(accessToken, '/data/external/item/share/', params),
    ])

    // 以 play.result_list 为基准 join 其他三个端点（按 date 对齐）
    const byDate = new Map<string, { play: number, like: number, comment: number, share: number }>()
    const ensure = (date: string) => {
      let row = byDate.get(date)
      if (!row) {
        row = { play: 0, like: 0, comment: 0, share: 0 }
        byDate.set(date, row)
      }
      return row
    }
    for (const r of playR.result_list ?? [])
      ensure(r.date).play = r.play ?? 0
    for (const r of likeR.result_list ?? [])
      ensure(r.date).like = r.like ?? 0
    for (const r of commentR.result_list ?? [])
      ensure(r.date).comment = r.comment ?? 0
    for (const r of shareR.result_list ?? [])
      ensure(r.date).share = r.share ?? 0

    const daily = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }))

    const sum = (k: 'play' | 'like' | 'comment' | 'share') =>
      daily.reduce((acc, x) => acc + x[k], 0)

    return {
      daily,
      // 兼容原 stub 的形状
      inc_click: sum('play'),
      inc_coin: 0,
      inc_dm: 0,
      inc_elec: 0,
      inc_fav: 0,
      inc_like: sum('like'),
      inc_reply: sum('comment'),
      inc_share: sum('share'),
    }
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

  // ============================================================
  // 互动开放服务 (Interaction API)
  // 端点：
  //   GET  /api/douyin/v1/comment/list/         - 作品评论列表
  //   GET  /api/douyin/v1/comment/list_replies/ - 评论的回复列表
  //   POST /api/douyin/v1/comment/reply/        - 回复评论
  //
  // 顶级评论（commentOnPost）抖音开放平台 **不允许** 第三方代发，
  // 因此本服务只提供 reply 能力。
  // ============================================================

  /** 抖音 POST 类 API 的通用请求（仅互动相关 path 用） */
  private async interactionApiPost<T>(
    accessToken: string,
    path: string,
    body: Record<string, string | number>,
  ): Promise<T> {
    const start = Date.now()
    try {
      const res = await axios.post<DouyinDataEnvelope<T>>(
        `https://open.douyin.com${path}`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'access-token': accessToken,
          },
        },
      )
      const errCode = res.data.data?.error_code ?? res.data.extra?.error_code
      if (errCode !== 0) {
        const desc
          = res.data.data?.description
            || res.data.extra?.description
            || `douyin interaction api error_code=${errCode}`
        this.logger.error({
          path,
          body: { open_id: body['open_id'], item_id: body['item_id'] },
          latencyMs: Date.now() - start,
          errorCode: errCode,
          description: desc,
        })
        throw new Error(desc)
      }
      this.logger.log({
        path,
        body: { open_id: body['open_id'] },
        latencyMs: Date.now() - start,
      })
      return res.data.data
    }
    catch (error) {
      if ((error as Error).message?.startsWith('douyin interaction api'))
        throw error
      this.logger.error({
        path,
        body: { open_id: body['open_id'] },
        latencyMs: Date.now() - start,
        error: String(error),
      })
      throw new Error(String(error))
    }
  }

  /**
   * 获取作品评论列表
   * GET /api/douyin/v1/comment/list/
   */
  async getCommentList(
    accessToken: string,
    openId: string,
    itemId: string,
    cursor = 0,
    count = 20,
    sortType: 0 | 1 = 0, // 0: 默认/热度, 1: 时间倒序
  ): Promise<DouyinCommentListResp> {
    return this.dataApiGet<DouyinCommentListResp>(
      accessToken,
      '/api/douyin/v1/comment/list/',
      {
        open_id: openId,
        item_id: itemId,
        cursor,
        count,
        sort_type: sortType,
      },
    )
  }

  /**
   * 获取一条评论下面的回复
   * GET /api/douyin/v1/comment/list_replies/
   */
  async getCommentReplies(
    accessToken: string,
    openId: string,
    itemId: string,
    commentId: string,
    cursor = 0,
    count = 20,
  ): Promise<DouyinCommentRepliesResp> {
    return this.dataApiGet<DouyinCommentRepliesResp>(
      accessToken,
      '/api/douyin/v1/comment/list_replies/',
      {
        open_id: openId,
        item_id: itemId,
        comment_id: commentId,
        cursor,
        count,
      },
    )
  }

  /**
   * 回复一条评论
   * POST /api/douyin/v1/comment/reply/
   *
   * NOTE 抖音开放平台不允许第三方应用主动发起"顶级评论"，
   *      此方法只能在已有评论的上下文里 reply。
   */
  async replyToComment(
    accessToken: string,
    openId: string,
    itemId: string,
    commentId: string,
    content: string,
  ): Promise<DouyinCommentReplyResp> {
    return this.interactionApiPost<DouyinCommentReplyResp>(
      accessToken,
      '/api/douyin/v1/comment/reply/',
      {
        open_id: openId,
        item_id: itemId,
        comment_id: commentId,
        content,
      },
    )
  }
}
