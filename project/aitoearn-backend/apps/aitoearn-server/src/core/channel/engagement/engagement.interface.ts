import { PostsResponseVo, PostVo } from '@yikart/common'
import { KeysetPagination, OffsetPagination } from './engagement.dto'

/**
 * Supported social media platforms (raw enum values used over the wire).
 *
 * The interface itself takes `platform: string` so adding a new platform never
 * requires changing this file — the alias just documents what's currently
 * recognised by the EngagementService.
 */
export type Platform = 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'tiktok' | 'threads' | 'pinterest' | 'linkedin' | 'bilibili' | 'douyin' | 'KWAI' | 'xhs' | 'wxGzh' | 'wxSph'

/**
 * Pagination strategy types
 */
export type PaginationType = 'keyset' | 'offset'

/**
 * Cursor information for keyset pagination response
 */
export interface KeysetPaginationCursor {
  /** Cursor for previous page */
  before?: string
  /** Cursor for next page */
  after?: string
}

export interface EngagementComment {
  id: string
  message: string
  author: {
    username: string
    avatar?: string
  }
  createdAt: string
  hasReplies?: boolean
}

/**
 * Response structure for post comments
 */
export interface FetchPostCommentsResponse {
  comments: EngagementComment[]
  /** Total number of comments (for offset pagination) */
  total?: number
  /** Pagination cursor (for keyset pagination) */
  cursor: KeysetPagination
}

export interface PublishCommentResponse {
  id?: string
  success: boolean
  error?: string
}

/**
 * Generic outcome for an engagement action (like / unlike / follow / favourite).
 *
 * Every action surfaces success/error in the same shape so the controller can
 * be a thin pass-through and the AI consumer can treat all actions uniformly.
 */
export interface ActionResult {
  success: boolean
  /** Provider-side identifier when relevant (e.g. like-id, subscription-id). */
  providerId?: string
  error?: string
  /**
   * Optional structured detail; providers may attach raw counts or status
   * payloads here. Consumers should treat the shape as opaque.
   */
  data?: Record<string, unknown>
}

export interface SearchPostsRequest {
  keyword: string
  language?: string
  limit?: number
  /** Optional opaque cursor returned by the provider. */
  cursor?: string
}

export interface SearchPost {
  id: string
  platform: string
  url: string
  authorId?: string
  authorName?: string
  content: string
  mediaUrls?: string[]
  publishedAt?: string
  likeCount?: number
  commentCount?: number
}

export interface SearchPostsResponse {
  items: SearchPost[]
  cursor?: string
}

/**
 * Static, declarative capability matrix for a provider. The controller exposes
 * this through `GET /channel/engagement/capabilities` so the frontend can grey
 * out unsupported actions without trial-and-error.
 *
 * - `engine`:
 *   - `api` — provider only calls official platform APIs.
 *   - `automation` — provider delegates to `aitoearn-automation` (Playwright).
 *   - `hybrid` — depends on the action; check the per-action booleans.
 */
export interface EngagementCapability {
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
  engine: 'api' | 'automation' | 'hybrid'
}

/**
 * Thrown by providers when an action is structurally unsupported (e.g. asking
 * Threads to follow without an OAuth scope). The EngagementService translates
 * this into a typed AppException at the controller boundary.
 */
export class EngagementNotSupportedError extends Error {
  constructor(
    public readonly platform: string,
    public readonly action: string,
  ) {
    super(`Action ${action} is not supported on platform ${platform}`)
    this.name = 'EngagementNotSupportedError'
  }
}

/**
 * Implementations live next to the platform service. Methods that a platform
 * cannot offer should throw `EngagementNotSupportedError`. The matching
 * `capability` flag must agree with the implementation — the spec test for
 * Phase 1 enforces that.
 */
export interface EngagementProvider {
  readonly platform: string
  readonly capability: EngagementCapability

  // ---- read ----
  fetchUserPosts: (accountId: string, pagination: KeysetPagination | OffsetPagination | null) => Promise<PostsResponseVo>
  getMetaPostDetail: (accountId: string, postId: string) => Promise<PostVo>
  fetchPostComments: (accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null) => Promise<FetchPostCommentsResponse>
  fetchCommentReplies: (accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null) => Promise<FetchPostCommentsResponse>

  // ---- comment / reply ----
  commentOnPost: (accountId: string, postId: string, message: string) => Promise<PublishCommentResponse>
  replyToComment: (accountId: string, commentId: string, message: string) => Promise<PublishCommentResponse>

  // ---- engagement actions (Phase 1 unified surface) ----
  likePost: (accountId: string, postId: string) => Promise<ActionResult>
  unlikePost: (accountId: string, postId: string) => Promise<ActionResult>
  favoritePost: (accountId: string, postId: string) => Promise<ActionResult>
  unfavoritePost: (accountId: string, postId: string) => Promise<ActionResult>
  followUser: (accountId: string, targetUserId: string) => Promise<ActionResult>
  unfollowUser: (accountId: string, targetUserId: string) => Promise<ActionResult>

  // ---- discovery (used by brand monitor) ----
  searchPosts?: (accountId: string, request: SearchPostsRequest) => Promise<SearchPostsResponse>
}
