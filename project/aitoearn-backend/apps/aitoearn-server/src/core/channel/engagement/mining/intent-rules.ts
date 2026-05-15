import { EngagementMiningIntent } from '@yikart/channel-db'

/**
 * Stage 1 of the mining pipeline: cheap regex+keyword preview.
 *
 * Each rule maps a list of keyword fragments to an intent. The matcher
 * normalises the comment to lowercase and runs `includes` against every
 * fragment; one hit is enough. The fragments deliberately stay shallow — the
 * Stage 2 LLM call refines the result and assigns a confidence score.
 *
 * Lexicon sources (all permissively licensed, no verbatim copying):
 *  - English purchase-intent terms: VADER (MIT) + e-commerce literature
 *  - Chinese terms: extracted by hand from real xhs / douyin comment dumps
 *  - Sentiment polarity is intentionally not encoded here — Stage 2 covers it
 */

export interface RuleHit {
  intent: EngagementMiningIntent
  matched: string[]
}

const RULES: Array<{ intent: EngagementMiningIntent, fragments: string[] }> = [
  {
    intent: EngagementMiningIntent.LINK_REQUEST,
    fragments: [
      // Chinese
      '\u6c42\u94fe\u63a5', // qiu lianjie ("link please")
      '\u6709\u94fe\u5417', // you lian ma ("got the link?")
      '\u8d34\u4e2a\u94fe\u63a5', // tie ge lianjie
      '\u4e0a\u94fe\u63a5', // shang lianjie
      // English
      'drop the link',
      'link please',
      'send me the link',
      'where can i buy',
      'where to buy',
      'where can i find',
      'link in bio',
    ],
  },
  {
    intent: EngagementMiningIntent.PURCHASE_INTENT,
    fragments: [
      '\u600e\u4e48\u8d2d\u4e70', // zenme goumai
      '\u600e\u4e48\u4e70', // zenme mai
      '\u54ea\u91cc\u53ef\u4ee5\u4e70', // nali keyi mai
      '\u9a6c\u4e0a\u62cd', // mashang pai ("buying now")
      '\u4ed8\u6b3e\u4e86', // fukuan le
      '\u4e0b\u5355\u4e86', // xiadan le
      'i want one',
      'i need this',
      'how do i order',
      'how to order',
      'add to cart',
      'pre-order',
      'buying this',
      'just bought',
    ],
  },
  {
    intent: EngagementMiningIntent.PRICE_QUESTION,
    fragments: [
      '\u591a\u5c11\u94b1', // duoshao qian
      '\u4ef7\u683c', // jiage
      '\u6253\u6298\u5417', // dazhe ma
      'how much',
      'whats the price',
      'price?',
      'price please',
      'how much is it',
    ],
  },
  {
    intent: EngagementMiningIntent.COMPLAINT,
    fragments: [
      '\u9000\u8d27', // tuihuo (refund)
      '\u9000\u6b3e', // tuikuan
      '\u5dee\u8bc4', // chaping (negative review)
      '\u5783\u573e', // laji (trash)
      '\u73a9\u4e0d\u4e86', // wan bu liao
      'refund',
      'broken',
      'scam',
      'never buying',
      'terrible',
      'useless',
    ],
  },
  {
    intent: EngagementMiningIntent.QUESTION,
    fragments: [
      '\u4e3a\u4ec0\u4e48', // weishenme
      '\u6709\u6ca1\u6709', // youmeiyou
      '\u600e\u4e48', // zenme (general "how")
      '?',
      'how can',
      'why is',
      'is it',
      'does it',
    ],
  },
  {
    intent: EngagementMiningIntent.PRAISE,
    fragments: [
      '\u592a\u68d2', // tai bang
      '\u8d5e', // zan
      '\u559c\u6b22', // xihuan
      'love it',
      'amazing',
      'awesome',
      'great',
      'beautiful',
    ],
  },
]

/**
 * Returns the *first* matching intent, or null when nothing fires. Rules are
 * ordered most-specific → most-generic so PURCHASE_INTENT and LINK_REQUEST
 * win over the fallback QUESTION rule.
 */
export function classifyByRules(comment: string): RuleHit | null {
  if (!comment)
    return null
  const text = comment.toLowerCase()
  for (const rule of RULES) {
    const matched = rule.fragments.filter(f => text.includes(f.toLowerCase()))
    if (matched.length > 0)
      return { intent: rule.intent, matched }
  }
  return null
}

/**
 * Detect the dominant language of a string. Lightweight on purpose — used
 * only as a hint passed to the LLM prompt.
 */
export function guessLanguage(comment: string): 'zh' | 'en' | 'unknown' {
  if (!comment)
    return 'unknown'
  const cjk = /[\u4e00-\u9fff]/.test(comment)
  const latin = /[a-z]/i.test(comment)
  if (cjk)
    return 'zh'
  if (latin)
    return 'en'
  return 'unknown'
}
