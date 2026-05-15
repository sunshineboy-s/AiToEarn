/**
 * Versioned selectors for douyin.com web. Same pattern as XhsSelectors:
 * every Chinese literal is \uXXXX-escaped to keep the source pure ASCII so
 * editors that default to GBK on Windows cannot corrupt it.
 *
 *   \u70b9\u8d5e            = "dianzan" (like)
 *   \u5173\u6ce8            = "guanzhu" (follow)
 *   \u5df2\u5173\u6ce8      = "yi guanzhu" (already following)
 *   \u6536\u85cf            = "shoucang" (favorite)
 *   \u8bc4\u8bba            = "pinglun" (comment)
 *   \u53d1\u5e03            = "fabu" (publish)
 */
export const DouyinSelectors = {
  version: '2026-05-15',

  // Video page
  video: {
    likeButton: [
      '[data-e2e="video-like-icon"]',
      '[data-e2e="video-player-digg"]',
      'xg-controls .digg',
      'button[aria-label*="\u70b9\u8d5e"]',
    ],
    likedClass: 'is-active',
    likedAttr: 'data-active="true"',
    favoriteButton: [
      '[data-e2e="video-mark"]',
      'button[aria-label*="\u6536\u85cf"]',
    ],
    favoritedClass: 'is-active',
    commentInput: [
      '[data-e2e="comment-input"]',
      'div[contenteditable="true"][data-placeholder*="\u8bc4\u8bba"]',
      'textarea[placeholder*="\u8bc4\u8bba"]',
    ],
    commentSubmit: [
      'button:has-text("\u53d1\u5e03")',
      '[data-e2e="comment-publish"]',
    ],
    commentList: '[data-e2e="comment-list-item"]',
    likeCount: ['[data-e2e="video-player-digg"] .count', '.digg .count'],
  },

  // Profile page (https://www.douyin.com/user/<id>)
  profile: {
    followButton: [
      '[data-e2e="user-info-follow-btn"]',
      'button:has-text("\u5173\u6ce8")',
      'button:has-text("\u5df2\u5173\u6ce8")',
      'button:has-text("Follow")',
      'button:has-text("Following")',
    ],
    unfollowConfirm: [
      'button:has-text("\u786e\u5b9a")',
      'button:has-text("\u4e0d\u518d\u5173\u6ce8")',
      '.confirm-btn',
    ],
  },

  // Search results page
  search: {
    container: '[data-e2e="scroll-list"], .video-card-container',
    item: 'a[href*="/video/"]',
    itemTitle: '.title, [class*="title"]',
    itemAuthor: '.author-name, [class*="author"]',
    itemLike: '[data-e2e="video-card-like-count"], .like-count',
    itemThumb: 'img',
  },
} as const
