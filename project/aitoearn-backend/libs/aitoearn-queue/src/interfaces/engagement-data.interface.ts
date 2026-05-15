/**
 * 互动任务分发数据（供 Consumer 使用）
 */
export interface EngagementTaskDistributionData {
  taskId: string
  attempts: number
}

/**
 * 评论回复任务数据（供 Consumer 使用）
 */
export interface EngagementReplyToCommentData {
  taskId: string
  attempts: number
}

/**
 * 评论意图分类输入。Consumer 会先用规则集预筛，命中后再调 LLM。
 */
export interface EngagementMiningJobData {
  userId: string
  accountId: string
  platform: string
  postId: string
  /** 默认 'auto'，由分类器结合规则做语言识别。 */
  language?: string
  /** AI 模型名（与 AiService.chatCompletion 的 model 字段对齐）。 */
  model?: string
  comments: Array<{
    id: string
    content: string
    authorId?: string
    authorName?: string
  }>
  /**
   * 当为 true 时，命中 PURCHASE_INTENT / LINK_REQUEST / PRICE_QUESTION 且
   * `recommendedReply` 非空的 hits 会被合并到一个 ReplyToCommentsByAI 任务里
   * 自动下发。Consumer 调度,不在 service 中循环依赖。
   */
  autoReply?: boolean
}

/**
 * 自动化动作分发载荷。所有动作复用同一 schema，由 worker 内部按
 * `action + platform` 路由。
 */
export type EngagementAutomationActionType =
  | 'like'
  | 'unlike'
  | 'favorite'
  | 'unfavorite'
  | 'follow'
  | 'unfollow'
  | 'reply'
  | 'comment'
  | 'search'

export interface EngagementAutomationActionData {
  /** 调用方生成的相关性 ID，用于 server 侧追踪。 */
  correlationId: string
  userId: string
  accountId: string
  platform: string
  action: EngagementAutomationActionType
  /** 标的类型，可以是 noteUrl / userId / commentId / keyword 之一。 */
  target: string
  /** 评论/回复内容（仅 reply / comment 用）。 */
  message?: string
  /** 兼容字段，便于扩展 (例如 search limit)。 */
  metadata?: Record<string, unknown>
}

/**
 * 品牌监测扫描载荷。
 */
export interface BrandMonitorScanData {
  monitorId: string
  /** 触发原因，便于排查；定时任务用 'schedule'，手动触发用 'manual'。 */
  reason: 'schedule' | 'manual'
}
