/**
 * Versioned selectors for xiaohongshu.com web.
 *
 * Bumping `version` when we adapt to a DOM change makes drift trivial to grep.
 * The Engagement design doc (§2.2) calls for selector_drift telemetry — this
 * file is the obvious place to add a `lastVerifiedAt` field once we wire that.
 */
export const XhsSelectors = {
  version: '2026-05-14',

  // Note (笔记) detail page
  note: {
    likeButton: [
      '.engage-bar .like-wrapper',
      '.interact-info .like-wrapper',
      '[data-test-id="like-btn"]',
      'button:has-text("赞")',
    ],
    likeCount: [
      '.engage-bar .like-wrapper .count',
      '.interact-info .like-wrapper .count',
    ],
    likedClass: 'liked',
    commentInput: [
      '#content-textarea',
      'textarea[placeholder*="评论"]',
      'div[contenteditable="true"][data-placeholder*="评论"]',
    ],
    commentSubmit: [
      'button:has-text("发送")',
      'button:has-text("发布")',
      '.submit-btn',
    ],
    commentList: '.comments-container .comment-item, .list-container .parent-comment',
  },

  // Search results page
  search: {
    container: '.search-container, .feeds-container',
    item: 'a.cover[href*="/search_result/"], section.note-item a[href*="/explore/"], a[href*="/explore/"]:has(img)',
    itemTitle: '.title, .note-title, .footer .title, span.title',
    itemAuthor: '.author-wrapper .name, .name, .user-name',
    itemLike: '.like-wrapper .count, .count',
    itemThumb: 'img',
  },
} as const
