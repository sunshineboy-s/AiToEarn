// @vitest-environment node
import { vi } from 'vitest'

// `intent-rules.ts` imports EngagementMiningIntent from `@yikart/channel-db`.
// That barrel re-exports legacy schemas whose Mongoose decorators can't load
// in a bare-test environment (Account.type is a union). We mock the barrel
// down to only what the unit under test reads.
vi.mock('@yikart/channel-db', () => ({
  EngagementMiningIntent: {
    PURCHASE_INTENT: 'PURCHASE_INTENT',
    LINK_REQUEST: 'LINK_REQUEST',
    PRICE_QUESTION: 'PRICE_QUESTION',
    COMPLAINT: 'COMPLAINT',
    QUESTION: 'QUESTION',
    PRAISE: 'PRAISE',
    SPAM: 'SPAM',
    OTHER: 'OTHER',
  },
}))

import { classifyByRules, guessLanguage } from './intent-rules'

const Intent = {
  PURCHASE_INTENT: 'PURCHASE_INTENT',
  LINK_REQUEST: 'LINK_REQUEST',
  COMPLAINT: 'COMPLAINT',
} as const

describe('intent-rules', () => {
  describe('classifyByRules', () => {
    it('returns LINK_REQUEST for explicit link asks (chinese)', () => {
      // \u6c42\u94fe\u63a5 = "qiu lianjie" (link please)
      const result = classifyByRules('\u6c42\u94fe\u63a5\uff0c\u6e90\u5934\u54ea\u91cc\u4e70')
      expect(result).not.toBeNull()
      expect(result?.intent).toBe(Intent.LINK_REQUEST)
      expect(result?.matched.length).toBeGreaterThan(0)
    })

    it('returns LINK_REQUEST for english "drop the link"', () => {
      const result = classifyByRules('please drop the link!')
      expect(result?.intent).toBe(Intent.LINK_REQUEST)
    })

    it('returns LINK_REQUEST when both purchase + link signals are present', () => {
      // "where can i buy" hits LINK_REQUEST; "i want one" hits PURCHASE_INTENT.
      // Rules order LINK_REQUEST before PURCHASE_INTENT (most specific first),
      // so the link signal wins. Encode that as a regression test.
      const result = classifyByRules('i want one — where can i buy?')
      expect(result?.intent).toBe(Intent.LINK_REQUEST)
    })

    it('returns COMPLAINT for refund-style language', () => {
      const result = classifyByRules('please refund, this is broken')
      expect(result?.intent).toBe(Intent.COMPLAINT)
    })

    it('returns null for unmatched comments', () => {
      // No fragment hits, no question mark — should fall through entirely.
      expect(classifyByRules('that sunset photo')).toBeNull()
      expect(classifyByRules('')).toBeNull()
    })
  })

  describe('guessLanguage', () => {
    it('detects chinese cjk characters', () => {
      expect(guessLanguage('\u4f60\u597d')).toBe('zh')
    })

    it('detects latin characters', () => {
      expect(guessLanguage('hello world')).toBe('en')
    })

    it('falls back to unknown for empty / pure punctuation', () => {
      expect(guessLanguage('')).toBe('unknown')
      expect(guessLanguage('!!!')).toBe('unknown')
    })
  })
})
