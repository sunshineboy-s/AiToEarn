/**
 * 闲鱼（咸鱼 / Goofish）平台数据结构定义。
 *
 * 闲鱼对个人用户没有公开的发布 OAuth API，所以本模块的所有
 * "写"接口都通过 Relay（B 端中继账号）或 Electron Cookie 注入完成。
 */

/** 闲鱼商品发布选项 */
export interface XianyuPublishOption {
  /** 一口价（单位：元，支持小数；与 reservePrice 二选一） */
  price?: number
  /** 起拍价 / 保留价（拍卖类商品） */
  reservePrice?: number
  /** 商品成色：1=全新, 2=99新, 3=95新, 4=9成新, 5=8成新 及以下 */
  stuffStatus?: 1 | 2 | 3 | 4 | 5
  /** 是否包邮 */
  freeShipping?: boolean
  /** 商品所在地（省/市/区） */
  location?: {
    province?: string
    city?: string
    district?: string
  }
  /** 类目 ID（闲鱼后台一级/二级类目 id） */
  catId?: number
  /** 是否参加"鱼塘"/兴趣圈分发 */
  fishpondId?: number
  /** 是否开启"我也要"自动回复模板 */
  enableAutoReply?: boolean
  /** 视频时长（秒），用于视频商品 */
  videoDurationSec?: number
  /** 自定义服务标签（例如：支持验货、7天无理由） */
  serviceLabels?: string[]
}

/** 闲鱼商品基本信息（来自 getItemDetail） */
export interface XianyuItemDetail {
  itemId: string
  title: string
  desc?: string
  price: number
  reservePrice?: number
  stuffStatus?: number
  imageUrls: string[]
  videoUrl?: string
  workLink: string
  publishTime?: Date
  status: 'on_sale' | 'sold_out' | 'offline' | 'reviewing' | 'rejected'
}

export interface XianyuRelayPublishPayload {
  accountId: string
  title: string
  desc: string
  imgUrlList: string[]
  videoUrl?: string
  topics?: string[]
  option?: XianyuPublishOption
}

export interface XianyuRelayPublishResult {
  itemId: string
  workLink: string
  status: XianyuItemDetail['status']
}
