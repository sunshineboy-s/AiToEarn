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

/* ============================================================
 *  Data-Cube / Engagement 数据结构
 *  ----------------------------------------------------------
 *  闲鱼本地 OAuth 账号没有可用接口，下面所有结构仅在 Relay 通路
 *  下被填充；本地账号一律返回零值或空列表，写操作抛错。
 * ============================================================ */

/** 账号维度统计（Relay 接口 GET /xianyu/account/stats 的契约） */
export interface XianyuAccountStats {
  /** 在售商品数 */
  onSaleCount: number
  /** 累计上架商品数 */
  totalItemCount: number
  /** 粉丝数（关注我的人） */
  followersCount: number
  /** 浏览总数（PV） */
  viewCount: number
  /** 点赞总数（"我想要"） */
  likeCount: number
  /** 评论 / 私信回复总数 */
  commentCount: number
  /** 收藏 / "我也想要" 总数 */
  favoriteCount: number
}

/** 商品维度统计（Relay 接口 GET /xianyu/items/:id/stats） */
export interface XianyuItemStats {
  itemId: string
  viewCount: number
  likeCount: number
  commentCount: number
  favoriteCount: number
  shareCount: number
  /** 想要次数（"我也要"按钮） */
  wantCount: number
}

/** 闲鱼"留言"（评论的对应概念） */
export interface XianyuMessage {
  /** 留言 ID */
  id: string
  /** 商品 ID */
  itemId: string
  /** 留言内容 */
  content: string
  /** 留言时间，ISO 字符串 */
  createdAt: string
  /** 留言用户 */
  author: {
    userId: string
    nickname: string
    avatar?: string
  }
  /** 是否为 sub-thread（回复某条留言） */
  parentId?: string
  hasReplies?: boolean
}

/** Relay 拉留言列表的响应 */
export interface XianyuMessagesPage {
  list: XianyuMessage[]
  nextCursor?: string
}

/** Relay 列表商品（feed）的响应 */
export interface XianyuItemSummary {
  itemId: string
  title: string
  price: number
  imageUrls: string[]
  workLink: string
  status: XianyuItemDetail['status']
  publishTime?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  favoriteCount?: number
}

export interface XianyuItemsPage {
  list: XianyuItemSummary[]
  nextCursor?: string
}

/** Relay 发表评论 / 回复 留言 的响应 */
export interface XianyuPublishMessageResult {
  /** 新留言 ID */
  id: string
}
