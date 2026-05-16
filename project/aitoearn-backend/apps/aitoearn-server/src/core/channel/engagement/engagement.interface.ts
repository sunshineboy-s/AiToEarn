import { PostsResponseVo, PostVo } from '@yikart/common'
import { KeysetPagination, OffsetPagination } from './engagement.dto'

/**
 * Supported social media platforms
 */
export type Platform = 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'tiktok'

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
  /**
   * Platform-specific extras that callers shouldn't try to interpret.
   *
   * Some platforms need more than just `commentId` to perform a reply
   * (e.g. Douyin requires `(item_id, comment_id)`, Bilibili requires
   * `(oid, type, root)`). Provider implementations stash whatever they
   * need here, and `replyToComment` reads it back. Treat as opaque.
   */
  extra?: Record<string, string>
}

/**
 * Response structure for post comments
 * @template T The type of comment data
 */
export interface FetchPostCommentsResponse {
  /** Array of comments */
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
 * Interface for engagement service implementations
 *
 * @template T The type of comment data returned by the platform
 *
 * Notes on `commentId`:
 * - All identifier strings (postId / commentId) are treated as **opaque**
 *   by the EngagementService and the controller layer.
 * - For platforms whose APIs need additional context to act on a
 *   comment, providers may either (a) encode that context into the id
 *   itself (Douyin's `${itemId}:${commentId}`), or (b) preserve it on
 *   `EngagementComment.extra` and require the caller to round-trip the
 *   whole `EngagementComment` back. Both patterns are supported; pick
 *   the simpler one for each platform and document it in the provider.
 */
export interface EngagementProvider {
  /**
   * Fetches meta post detail
   * @param platform - The platform
   * @param postId - The post ID
   * @param userId - The user ID
   * @returns Promise resolving to posts response
   */
  getMetaPostDetail: (accountId: string, postId: string) => Promise<PostVo>
  /**
   * Fetches user posts
   * @param accountId - The account ID
   * @param pagination - The pagination parameters
   * @returns Promise resolving to posts response
   */
  fetchUserPosts: (accountId: string, pagination: KeysetPagination | OffsetPagination | null) => Promise<PostsResponseVo>
  /**
   * Fetches comments on a specific post
   * @param request - The request parameters including post ID and pagination
   * @returns Promise resolving to comments response
   */
  fetchPostComments: (accountId: string, postId: string, pagination: KeysetPagination | OffsetPagination | null) => Promise<FetchPostCommentsResponse>
  /**
   * Fetches replies to a specific comment
   * @param request - The request parameters including comment ID and pagination
   * @returns Promise resolving to comments response
   */
  fetchCommentReplies: (accountId: string, commentId: string, pagination: KeysetPagination | OffsetPagination | null) => Promise<FetchPostCommentsResponse>

  /**
   * comment on a specific post
   * @param postId
   * @param message
   * @returns
   */
  commentOnPost: (accountId: string, postId: string, message: string) => Promise<PublishCommentResponse>
  replyToComment: (accountId: string, commentId: string, message: string) => Promise<PublishCommentResponse>
}
