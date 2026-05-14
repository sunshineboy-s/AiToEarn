/**
 * Versioned selectors for xiaohongshu.com web.
 *
 * Bumping `version` when we adapt to a DOM change makes drift trivial to grep.
 *
 * IMPORTANT: every Chinese literal below is encoded as \uXXXX so the source file
 * stays pure ASCII. Some IDEs/terminals on Windows default to GBK and would
 * otherwise corrupt the strings on save (mojibake). Runtime semantics are
 * identical — TypeScript decodes the escapes back to U+XXXX code points.
 *
 *   \u8d5e            = "zan"   ("like" verb)
 *   \u8bc4\u8bba      = "pinglun" ("comment" noun)
 *   \u53d1\u9001      = "fasong" ("send")
 *   \u53d1\u5e03      = "fabu"   ("publish")
 */
export const XhsSelectors = {
  version: '2026-05-14',

  // Note detail page
  note: {
    likeButton: [
      '.engage-bar .like-wrapper',
      '.interact-info .like-wrapper',
      '[data-test-id="like-btn"]',
      'button[aria-label*="\u8d5e"]',
      'button:has-text("\u8d5e")',
    ],
    likeCount: [
      '.engage-bar .like-wrapper .count',
      '.interact-info .like-wrapper .count',
    ],
    likedClass: 'liked',
    commentInput: [
      '#content-textarea',
      'textarea[placeholder*="\u8bc4\u8bba"]',
      'div[contenteditable="true"][data-placeholder*="\u8bc4\u8bba"]',
    ],
    commentSubmit: [
      'button:has-text("\u53d1\u9001")',
      'button:has-text("\u53d1\u5e03")',
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
