export interface DouyinAccessTokenInfo {
  access_token: string
  captcha: string
  desc_url: string
  description: string
  error_code: number // 0
  expires_in: number // 1296000,
  log_id: string
  open_id: string
  refresh_expires_in: number // 2592000,
  refresh_token: string
  scope: string
}

export interface DouyRefreshTokenInfo {
  captcha: string
  desc_url: string
  description: string
  error_code: number // 0
  expires_in: number // 1296000,
  refresh_token: string
}

export interface DouyinUserInfo {
  open_id: string
  nickname: string
  description: string
  e_account_role: string
  error_code: number // 0
  avatar: string
  client_key: string
  log_id: string
  union_id: string
}

export interface DouyinClientTokenInfo {
  captcha: string
  desc_url: string
  description: string
  error_code: number // 0
  expires_in: number // 7200,
  access_token: string
}

export interface DouyinOpenTicketInfo {
  error_code: number // 2094425643568381000,
  description: string // "\"access_token无效\"",
  expires_in: number // 509909681054971900,
  ticket: string // "bxLdikRXVbTPdHSM05e5u5sUoXNKd8"
}

export enum DouyinDownloadType {
  Allow = 1,
  Disallow = 2,
}

export enum DouyinPrivateStatus {
  All = 0,
  Self = 1,
  Friend = 2,
}

// 分享发布的option
export interface DouyinShareSchemaOptions {
  shareId?: string // shareid
  hashtag_list?: string[]
  title?: string
  short_title?: string
  title_hashtag_list?: { name: string, start: number }[]
  downloadType?: DouyinDownloadType // 1: 允许 2：不允许
  privateStatus?: DouyinPrivateStatus // 0：全部人可见，1：自己可见，2：好友可见
  image_list_path?: string[]
  video_path?: string
}

// ============================================================
// 数据开放服务 (Data Open API) 响应类型
// 文档：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission
//
// 所有数据接口的统一规则：
// - GET 请求；HTTP header `access-token` 携带用户 access_token
// - query 参数 `open_id` 必传
// - 响应 envelope：{ data: { error_code, description, ...payload }, extra }
// - 字段名以官方文档为准；本项目首次接入，字段命名根据公开 SDK + 文档样例归纳，
//   实际跑通后请通过 scripts/probe-douyin.ts 用真实账号校验一遍
// ============================================================

export interface DouyinDataEnvelope<T> {
  data: T & {
    error_code: number
    description: string
  }
  extra: {
    error_code: number
    description: string
    sub_error_code: number
    sub_description: string
    logid: string
    now: number
  }
}

/** /data/external/user/fans/ - 粉丝总数（按日时序） */
export interface DouyinUserFansResp {
  result_list: Array<{
    /** 日期 yyyy-MM-dd */
    date: string
    /** 当日粉丝总数 */
    total_fans: number
  }>
}

/** /api/douyin/v1/video/video_list/ - 当前用户视频列表 */
export interface DouyinVideoListResp {
  cursor: number
  has_more: boolean
  list: Array<{
    item_id: string
    title: string
    create_time: number
    cover: string
    share_url: string
    video_status: number
    statistics?: {
      digg_count?: number
      comment_count?: number
      download_count?: number
      forward_count?: number
      play_count?: number
      share_count?: number
    }
  }>
}

/** /data/external/item/base/ - 单作品基础数据（截至当日） */
export interface DouyinItemBaseResp {
  result_list: Array<{
    /** 日期 yyyy-MM-dd */
    date: string
    total_play: number
    total_like: number
    total_comment: number
    total_share: number
    /** 部分版本字段名为 total_collect */
    total_collect?: number
  }>
}

/** /data/external/item/comment/ - 单作品评论数（按日增量） */
export interface DouyinItemCommentResp {
  result_list: Array<{
    date: string
    comment: number
  }>
}

/** /data/external/item/like/ - 单作品点赞数（按日增量） */
export interface DouyinItemLikeResp {
  result_list: Array<{
    date: string
    like: number
  }>
}

/** /data/external/item/play/ - 单作品播放数（按日增量） */
export interface DouyinItemPlayResp {
  result_list: Array<{
    date: string
    play: number
  }>
}

/** /data/external/item/share/ - 单作品分享数（按日增量） */
export interface DouyinItemShareResp {
  result_list: Array<{
    date: string
    share: number
  }>
}

// ============================================================
// 互动开放服务 (Interaction API)
// 文档：https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/account-permission/comment
//
// 抖音开放平台对评论 API 有重要限制：
//   - 第三方应用 **不允许** 主动在他人作品下发表"顶级评论"。
//   - 允许的操作是 "回复" —— 即对自己作品下、或对方@提到自己的评论进行 reply。
//   - 因此 EngagementProvider.commentOnPost 在抖音上不会代发顶级评论；
//     上层调用会落到只读路径，只暴露 "fetch comments" 与 "reply".
// ============================================================

export interface DouyinCommentItem {
  comment_id: string
  comment_user_id: string
  content: string
  create_time: number
  digg_count: number
  reply_comment_total?: number
  /** 仅当评论者授权了昵称读取时返回 */
  nickname?: string
  /** 仅当评论者授权了头像读取时返回 */
  avatar?: string
}

/** /api/douyin/v1/comment/list/ - 作品评论列表 */
export interface DouyinCommentListResp {
  cursor: number
  has_more: boolean
  list: DouyinCommentItem[]
}

/** /api/douyin/v1/comment/list_replies/ - 评论回复列表 */
export interface DouyinCommentRepliesResp {
  cursor: number
  has_more: boolean
  list: DouyinCommentItem[]
}

/** /api/douyin/v1/comment/reply/ - 回复评论的应答 */
export interface DouyinCommentReplyResp {
  comment_id: string
  /** 部分版本会回带审核状态 */
  audit_status?: 'audit_pending' | 'audit_pass' | 'audit_fail'
}

/**
 * 获取中文文件的URL
 * @param url
 * @returns
 */
export function getZhFileUrl(url: string): string {
  if (!url)
    return url
  const urlObj = new URL(url)
  return `https://assets.aitoearn.cn${urlObj.pathname}${urlObj.search}`
}
