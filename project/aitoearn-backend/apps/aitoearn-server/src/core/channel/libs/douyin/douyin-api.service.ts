import crypto from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { config } from '../../../../config'
import {
  DouyinAccessTokenInfo,
  DouyinClientTokenInfo,
  DouyinOpenTicketInfo,
  DouyinShareSchemaOptions,
  DouyinUserInfo,
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
    // scopes (must match what's enabled on the Douyin Open Platform app):
    //   user_info     — read profile
    //   video.list    — list user's own videos
    //   video.data    — read per-video stats (views/likes/comments/shares)
    //   video.comment — list comments on user's videos and reply to them
    // 注意：增加 scope 后，已有授权用户需要重新授权才能拿到新权限。
    const scopes = ['user_info', 'video.list', 'video.data', 'video.comment'].join(',')
    const url = `https://open.douyin.com/platform/oauth/connect?client_key=${this.appId}&response_type=code&scope=${scopes}&redirect_uri=${redirectURL}&state=${taskId}`
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

  /**
   * 获取用户粉丝数 / 作品数等统计信息
   * 抖音开放平台：GET /data/external/user/fans/
   * https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission/account-data
   * @param accessToken
   */
  async getUserStat(accessToken: string) {
    const startTime = Date.now()
    try {
      const fansRes = await axios.get<{
        data: { error_code: number, description: string, fans_count?: number, total_count?: number, following_count?: number }
      }>('https://open.douyin.com/data/external/user/fans/', {
        headers: { 'access-token': accessToken },
        params: { date_type: 7 },
      })

      const itemRes = await axios.get<{
        data: { error_code: number, description: string, result_list?: { item_count?: number }[] }
      }>('https://open.douyin.com/data/external/user/item/', {
        headers: { 'access-token': accessToken },
        params: { date_type: 7 },
      })

      const fansData = fansRes.data.data
      const itemData = itemRes.data.data

      if (fansData.error_code !== 0) {
        this.logger.warn({
          path: 'douyin getUserStat fans error',
          data: fansData,
          latency: Date.now() - startTime,
        })
      }

      // 从 item 接口取作品总数（取最近一天的快照）
      const latestItemCount = itemData.result_list?.[itemData.result_list.length - 1]?.item_count ?? 0

      return {
        arc_passed_total: latestItemCount,
        follower: fansData.fans_count ?? fansData.total_count ?? 0,
        following: fansData.following_count ?? 0,
      }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getUserStat error',
        data: error,
        latency: Date.now() - startTime,
      })
      return {
        arc_passed_total: 0,
        follower: 0,
        following: 0,
      }
    }
  }

  /**
   * 获取单个视频/稿件的统计数据
   * 抖音开放平台：GET /data/external/item/base/
   * https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission/video-data/external-video-data
   * @param accessToken
   * @param resourceId 视频 item_id
   */
  async getArcStat(
    accessToken: string,
    resourceId: string,
  ) {
    const startTime = Date.now()
    try {
      const res = await axios.get<{
        data: {
          error_code: number
          description: string
          result_list?: {
            play?: number
            like?: number
            comment?: number
            share?: number
            favourite?: number
            title?: string
          }[]
        }
      }>('https://open.douyin.com/data/external/item/base/', {
        headers: { 'access-token': accessToken },
        params: { item_id: resourceId },
      })

      const data = res.data.data
      if (data.error_code !== 0) {
        this.logger.warn({
          path: 'douyin getArcStat error',
          resourceId,
          data,
          latency: Date.now() - startTime,
        })
        return {
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
      }

      const item = data.result_list?.[0]
      return {
        coin: 0, // 抖音没有投币概念
        danmaku: 0, // 抖音没有弹幕概念
        favorite: item?.favourite ?? 0,
        like: item?.like ?? 0,
        ptime: 0, // 发布时间需要另外接口
        reply: item?.comment ?? 0,
        share: item?.share ?? 0,
        title: item?.title ?? '',
        view: item?.play ?? 0,
      }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getArcStat error',
        resourceId,
        data: error,
        latency: Date.now() - startTime,
      })
      return {
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
    }
  }

  /**
   * 获取用户作品增量数据
   * 抖音开放平台：GET /data/external/user/item/
   * @param accessToken
   */
  async getArcIncStat(accessToken: string) {
    const startTime = Date.now()
    try {
      const res = await axios.get<{
        data: {
          error_code: number
          description: string
          result_list?: {
            new_play?: number
            new_like?: number
            new_comment?: number
            new_share?: number
            new_favourite?: number
          }[]
        }
      }>('https://open.douyin.com/data/external/user/item/', {
        headers: { 'access-token': accessToken },
        params: { date_type: 1 },
      })

      const data = res.data.data
      if (data.error_code !== 0) {
        this.logger.warn({
          path: 'douyin getArcIncStat error',
          data,
          latency: Date.now() - startTime,
        })
        return {
          inc_click: 0,
          inc_coin: 0,
          inc_dm: 0,
          inc_elec: 0,
          inc_fav: 0,
          inc_like: 0,
          inc_reply: 0,
          inc_share: 0,
        }
      }

      const latest = data.result_list?.[data.result_list.length - 1]
      return {
        inc_click: latest?.new_play ?? 0,
        inc_coin: 0,
        inc_dm: 0,
        inc_elec: 0,
        inc_fav: latest?.new_favourite ?? 0,
        inc_like: latest?.new_like ?? 0,
        inc_reply: latest?.new_comment ?? 0,
        inc_share: latest?.new_share ?? 0,
      }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getArcIncStat error',
        data: error,
        latency: Date.now() - startTime,
      })
      return {
        inc_click: 0,
        inc_coin: 0,
        inc_dm: 0,
        inc_elec: 0,
        inc_fav: 0,
        inc_like: 0,
        inc_reply: 0,
        inc_share: 0,
      }
    }
  }

  /**
   * 获取用户作品列表（自己的视频）
   * 抖音开放平台：GET /api/douyin/v1/video/video_list/
   * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/video-management/douyin/list/
   *
   * 需要 scope `video.list`。注意：cursor 是 unix 秒时间戳（首次传 0）。
   *
   * @param accessToken 用户级 access_token
   * @param openId
   * @param cursor 时间戳分页游标，0 表示从最新开始
   * @param count  单页大小（最大 20）
   */
  async getVideoList(accessToken: string, openId: string, cursor = 0, count = 20) {
    const startTime = Date.now()
    try {
      const res = await axios.get<{
        data: {
          error_code: number
          description: string
          cursor?: number
          has_more?: boolean
          list?: Array<{
            item_id: string
            title?: string
            cover?: string
            create_time?: number
            share_url?: string
            statistics?: {
              comment_count?: number
              digg_count?: number
              download_count?: number
              forward_count?: number
              play_count?: number
              share_count?: number
            }
          }>
        }
      }>('https://open.douyin.com/api/douyin/v1/video/video_list/', {
        headers: { 'access-token': accessToken },
        params: { open_id: openId, cursor, count },
      })
      const data = res.data.data
      if (data.error_code !== 0) {
        this.logger.warn({
          path: 'douyin getVideoList error',
          openId,
          data,
          latency: Date.now() - startTime,
        })
        return { list: [], cursor: 0, has_more: false }
      }
      return {
        list: data.list ?? [],
        cursor: data.cursor ?? 0,
        has_more: data.has_more ?? false,
      }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getVideoList error',
        openId,
        data: error,
        latency: Date.now() - startTime,
      })
      return { list: [], cursor: 0, has_more: false }
    }
  }

  /**
   * 获取视频的评论列表（顶级评论）
   * 抖音开放平台：GET /api/douyin/v1/video/item_comment_list/
   * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/account-permission/comment-management/comment-list
   *
   * 需要 scope `video.comment`。
   * 此接口仅返回**自己作品下**的评论。
   */
  async getCommentList(
    accessToken: string,
    openId: string,
    itemId: string,
    cursor = 0,
    count = 20,
  ) {
    const startTime = Date.now()
    try {
      const res = await axios.get<{
        data: {
          error_code: number
          description: string
          cursor?: number
          has_more?: boolean
          list?: Array<{
            comment_id: string
            comment_user_id: string
            content: string
            create_time: number
            digg_count?: number
            reply_comment_total?: number
            top?: boolean
            nickname?: string
            avatar?: string
          }>
        }
      }>('https://open.douyin.com/api/douyin/v1/video/item_comment_list/', {
        headers: { 'access-token': accessToken },
        params: { open_id: openId, item_id: itemId, cursor, count },
      })

      const data = res.data.data
      if (data.error_code !== 0) {
        this.logger.warn({
          path: 'douyin getCommentList error',
          openId,
          itemId,
          data,
          latency: Date.now() - startTime,
        })
        return { list: [], cursor: 0, has_more: false }
      }
      return {
        list: data.list ?? [],
        cursor: data.cursor ?? 0,
        has_more: data.has_more ?? false,
      }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getCommentList error',
        openId,
        itemId,
        data: error,
        latency: Date.now() - startTime,
      })
      return { list: [], cursor: 0, has_more: false }
    }
  }

  /**
   * 获取一条评论下的回复列表
   * 抖音开放平台：GET /api/douyin/v1/video/item_comment_reply_list/
   */
  async getCommentReplies(
    accessToken: string,
    openId: string,
    itemId: string,
    commentId: string,
    cursor = 0,
    count = 20,
  ) {
    const startTime = Date.now()
    try {
      const res = await axios.get<{
        data: {
          error_code: number
          description: string
          cursor?: number
          has_more?: boolean
          list?: Array<{
            comment_id: string
            comment_user_id: string
            content: string
            create_time: number
            digg_count?: number
            nickname?: string
            avatar?: string
          }>
        }
      }>('https://open.douyin.com/api/douyin/v1/video/item_comment_reply_list/', {
        headers: { 'access-token': accessToken },
        params: { open_id: openId, item_id: itemId, comment_id: commentId, cursor, count },
      })
      const data = res.data.data
      if (data.error_code !== 0) {
        this.logger.warn({
          path: 'douyin getCommentReplies error',
          openId,
          itemId,
          commentId,
          data,
          latency: Date.now() - startTime,
        })
        return { list: [], cursor: 0, has_more: false }
      }
      return {
        list: data.list ?? [],
        cursor: data.cursor ?? 0,
        has_more: data.has_more ?? false,
      }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin getCommentReplies error',
        openId,
        itemId,
        commentId,
        data: error,
        latency: Date.now() - startTime,
      })
      return { list: [], cursor: 0, has_more: false }
    }
  }

  /**
   * 回复一条评论
   * 抖音开放平台：POST /api/douyin/v1/video/item_comment_reply/
   *
   * 需要 scope `video.comment`。第三方应用**不允许**在他人作品下发顶级评论；
   * 只能 reply 到 (a) 自己作品下的评论，或 (b) 他人作品中 @ 了自己的评论。
   *
   * @returns 创建的评论 id
   */
  async replyToComment(
    accessToken: string,
    openId: string,
    itemId: string,
    commentId: string,
    content: string,
  ): Promise<{ comment_id: string }> {
    const startTime = Date.now()
    try {
      const res = await axios.post<{
        data: { error_code: number, description: string, comment_id?: string }
      }>(
        'https://open.douyin.com/api/douyin/v1/video/item_comment_reply/',
        { open_id: openId, item_id: itemId, comment_id: commentId, content },
        { headers: { 'access-token': accessToken, 'content-type': 'application/json' } },
      )
      const data = res.data.data
      if (data.error_code !== 0 || !data.comment_id) {
        this.logger.warn({
          path: 'douyin replyToComment error',
          openId,
          itemId,
          commentId,
          data,
          latency: Date.now() - startTime,
        })
        throw new Error(data.description || 'replyToComment failed')
      }
      return { comment_id: data.comment_id }
    }
    catch (error) {
      this.logger.error({
        path: 'douyin replyToComment error',
        openId,
        itemId,
        commentId,
        data: error,
        latency: Date.now() - startTime,
      })
      throw error
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
}
