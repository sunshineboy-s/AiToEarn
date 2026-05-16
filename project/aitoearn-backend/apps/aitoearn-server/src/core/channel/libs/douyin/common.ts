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

/**
 * 抖音开放平台数据 API 的字段形状。
 *
 * 来源：开放平台官方文档 `data-permission/account-data` 与 `video-data` 章节。
 * 字段保留 snake_case 与上游一致；TS 包了 ?: 的字段是文档里标了"可选"的。
 */

/**
 * /data/external/user/fans 返回项
 * 单点：某一天的"总粉丝数"。我们取列表末位作为当前粉丝数。
 */
export interface DouyinFansDataPoint {
  date: string // yyyy-MM-dd
  total_fans: number
  new_fans?: number
  cancel_fans?: number
}

/**
 * /data/external/item/base 返回的单条作品 stat。
 *
 * 上游字段名在历史版本里出现过 `digg_count` / `like_count` 与
 * `play_count` / `video_play_count` 两套同义词。implementation 里
 * 先取业务版本，再 fallback 到历史名，避免不同接入版本互相挤掉。
 */
export interface DouyinItemBaseStat {
  item_id: string
  title?: string
  publish_time?: number
  like_count?: number
  digg_count?: number // 旧字段，部分账号仍返回这一名
  comment_count?: number
  share_count?: number
  favourite_count?: number
  play_count?: number
  video_play_count?: number // 旧字段
  download_count?: number
}

/**
 * /data/external/item/{like|comment|share|play} 单日数据点（拼接后）
 */
export interface DouyinItemDailyStat {
  date: string
  like_count: number
  comment_count: number
  share_count: number
  play_count: number
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
