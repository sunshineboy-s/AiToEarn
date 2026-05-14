/**
 * Engagement API client (server-side engine, no browser plugin).
 *
 * Companion to `apps/aitoearn-server/src/core/channel/engagement/*`. The
 * surface mirrors the controllers exactly so the frontend can map a button
 * click to a single call. `capabilities()` should be the first thing every
 * Engage page fetches so it can grey-out unsupported actions.
 */
import http from '@/utils/request'

// ---------------------------------------------------------------------------
// Capability matrix
// ---------------------------------------------------------------------------

export type EngagementEngine = 'api' | 'automation' | 'hybrid'

export interface EngagementCapability {
  platform: string
  like: boolean
  unlike: boolean
  follow: boolean
  unfollow: boolean
  favorite: boolean
  unfavorite: boolean
  comment: boolean
  reply: boolean
  fetchUserPosts: boolean
  search: boolean
  engine: EngagementEngine
}

// ---------------------------------------------------------------------------
// Action results
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean
  providerId?: string
  error?: string
  data?: Record<string, unknown>
}

export interface PublishCommentResponse {
  id?: string
  success: boolean
  error?: string
}

// Aligned with backend's EngagementCapabilityUnavailable / RateLimited /
// CircuitBreakerOpen / AutomationUnavailable response codes.
export const ENGAGEMENT_ERROR_CODES = {
  CapabilityUnavailable: 15040,
  RateLimited: 15041,
  CircuitBreakerOpen: 15042,
  AutomationUnavailable: 15043,
  CookieMissing: 15044,
  BrandMonitorNotFound: 15045,
  MiningHitNotFound: 15046,
} as const

// ---------------------------------------------------------------------------
// Mining
// ---------------------------------------------------------------------------

export type MiningIntent
  = | 'PURCHASE_INTENT'
    | 'LINK_REQUEST'
    | 'PRICE_QUESTION'
    | 'COMPLAINT'
    | 'QUESTION'
    | 'PRAISE'
    | 'SPAM'
    | 'OTHER'

export type MiningStatus = 'NEW' | 'HANDLED' | 'IGNORED'
export type MiningSource = 'RULES' | 'LLM' | 'HYBRID'

export interface MiningHit {
  id: string
  userId: string
  accountId: string
  platform: string
  postId: string
  commentId: string
  commentContent: string
  authorId?: string
  authorName?: string
  intent: MiningIntent
  confidence: number
  sentiment: number
  language: string
  recommendedReply?: string
  source: MiningSource
  status: MiningStatus
  matchedKeywords: string[]
  createdAt: string
  updatedAt: string
}

export interface ListMiningHitsParams {
  accountId?: string
  intent?: MiningIntent
  status?: MiningStatus
  limit?: number
  cursor?: string
}

export interface ClassifyCommentsParams {
  accountId: string
  platform: string
  postId: string
  model?: string
  comments: Array<{
    id: string
    content: string
    authorId?: string
    authorName?: string
  }>
}

// ---------------------------------------------------------------------------
// Brand monitor
// ---------------------------------------------------------------------------

export type BrandMentionUrgency = 'LOW' | 'MEDIUM' | 'HIGH'
export type BrandMonitorStatus = 'ACTIVE' | 'PAUSED'

export interface BrandMonitor {
  id: string
  userId: string
  name: string
  brandKeywords: string[]
  excludeKeywords: string[]
  platforms: string[]
  languages: string[]
  scanInterval: number
  status: BrandMonitorStatus
  lastScanAt?: string
  notificationChannels?: { email?: string[], webhook?: string, inApp?: boolean }
  createdAt: string
  updatedAt: string
}

export interface BrandMention {
  id: string
  monitorId: string
  userId: string
  platform: string
  postId: string
  postUrl: string
  authorId?: string
  authorName?: string
  content: string
  mediaUrls: string[]
  publishedAt?: string
  matchedKeywords: string[]
  sentiment: number
  urgency: BrandMentionUrgency
  notified: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateBrandMonitorParams {
  name: string
  brandKeywords: string[]
  excludeKeywords?: string[]
  platforms: string[]
  languages?: string[]
  scanInterval?: number
  notificationChannels?: BrandMonitor['notificationChannels']
}

export type UpdateBrandMonitorParams = Partial<CreateBrandMonitorParams> & {
  status?: BrandMonitorStatus
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const engagementApi = {
  /** Fetch the per-platform capability matrix. Cache on the page. */
  async capabilities() {
    return http.get<EngagementCapability[]>('channel/engagement/capabilities')
  },

  // -----------------------------------------------------------------------
  // Engagement actions (platform-aware)
  // -----------------------------------------------------------------------

  async likePost(payload: { accountId: string, platform: string, postId: string }) {
    return http.post<ActionResult>('channel/engagement/post/like', payload)
  },
  async unlikePost(payload: { accountId: string, platform: string, postId: string }) {
    return http.post<ActionResult>('channel/engagement/post/unlike', payload)
  },
  async favoritePost(payload: { accountId: string, platform: string, postId: string }) {
    return http.post<ActionResult>('channel/engagement/post/favorite', payload)
  },
  async unfavoritePost(payload: { accountId: string, platform: string, postId: string }) {
    return http.post<ActionResult>('channel/engagement/post/unfavorite', payload)
  },
  async followUser(payload: { accountId: string, platform: string, targetUserId: string }) {
    return http.post<ActionResult>('channel/engagement/user/follow', payload)
  },
  async unfollowUser(payload: { accountId: string, platform: string, targetUserId: string }) {
    return http.post<ActionResult>('channel/engagement/user/unfollow', payload)
  },

  async commentOnPost(payload: {
    accountId: string
    platform: string
    postId: string
    message: string
  }) {
    return http.post<PublishCommentResponse>(
      'channel/engagement/post/comments/publish',
      payload,
    )
  },

  async replyToComment(payload: {
    accountId: string
    platform: string
    commentId: string
    message: string
  }) {
    return http.post<PublishCommentResponse>(
      'channel/engagement/comment/replies/publish',
      payload,
    )
  },

  // -----------------------------------------------------------------------
  // Mining
  // -----------------------------------------------------------------------

  async listMiningHits(params: ListMiningHitsParams = {}) {
    return http.get<MiningHit[]>('channel/engagement/mining/hits', params as never)
  },

  async markMiningHit(payload: { hitId: string, status: MiningStatus }) {
    return http.patch<MiningHit>('channel/engagement/mining/hits/status', payload)
  },

  async classifyComments(payload: ClassifyCommentsParams) {
    return http.post<MiningHit[]>('channel/engagement/mining/classify', payload)
  },

  // -----------------------------------------------------------------------
  // Brand monitor
  // -----------------------------------------------------------------------

  async listBrandMonitors() {
    return http.get<BrandMonitor[]>('brand-monitor')
  },

  async getBrandMonitor(id: string) {
    return http.get<BrandMonitor>(`brand-monitor/${id}`)
  },

  async createBrandMonitor(payload: CreateBrandMonitorParams) {
    return http.post<BrandMonitor>('brand-monitor', payload)
  },

  async updateBrandMonitor(id: string, payload: UpdateBrandMonitorParams) {
    return http.patch<BrandMonitor>(`brand-monitor/${id}`, payload)
  },

  async deleteBrandMonitor(id: string) {
    return http.delete<{ success: boolean }>(`brand-monitor/${id}`)
  },

  async triggerBrandMonitorScan(id: string) {
    return http.post<{ queued: true }>(`brand-monitor/${id}/scan`)
  },

  async listBrandMentions(
    id: string,
    params: { urgency?: BrandMentionUrgency, limit?: number, cursor?: string } = {},
  ) {
    return http.get<BrandMention[]>(`brand-monitor/${id}/mentions`, params as never)
  },
}
