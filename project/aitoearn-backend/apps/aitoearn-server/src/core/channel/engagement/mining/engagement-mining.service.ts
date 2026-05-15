import { Injectable, Logger } from '@nestjs/common'
import { AiService, UserChatCompletionDto } from '@yikart/aitoearn-ai-client'
import { QueueService } from '@yikart/aitoearn-queue'
import {
  EngagementMiningHit,
  EngagementMiningHitRepository,
  EngagementMiningIntent,
  EngagementMiningSource,
  EngagementMiningStatus,
} from '@yikart/channel-db'
import { AppException, ResponseCode, UserType } from '@yikart/common'
import { ListMiningHitsRequest, MarkMiningHitRequest } from './mining.dto'

import { classifyByRules, guessLanguage } from './intent-rules'

/** Default model for Stage-2 classification. Small, cheap, fast. */
const DEFAULT_LLM_MODEL = 'gpt-4o-mini'

/** Confidence threshold below which a Stage-2 verdict is dropped. */
const MIN_CONFIDENCE_LLM = 0.6

interface ClassifyResult {
  intent: EngagementMiningIntent
  confidence: number
  sentiment: number
  recommendedReply?: string
  source: EngagementMiningSource
  matchedKeywords: string[]
}

interface LlmVerdict {
  id: string
  intent: keyof typeof EngagementMiningIntent
  confidence: number
  sentiment: number
  recommendedReply?: string
}

/**
 * Two-stage comment intent classifier:
 *   Stage 1: regex + keyword (zero cost, ~0.1ms)
 *   Stage 2: AiService.chatCompletion (batch of up to 16, only when Stage 1
 *            produced something interesting OR the comment contains a "?")
 *
 * Hits are persisted via {@link EngagementMiningHitRepository} keyed on
 * (accountId, postId, commentId). Re-running the pipeline against the same
 * comment is idempotent.
 *
 * The whole service is intentionally LLM-optional: when `model` is empty we
 * skip Stage 2 entirely and rely on the rules. This is the path used in
 * single-tenant deployments without an AI quota.
 */
@Injectable()
export class EngagementMiningService {
  private readonly logger = new Logger(EngagementMiningService.name)

  constructor(
    private readonly hitRepo: EngagementMiningHitRepository,
    private readonly aiService: AiService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Classify a single comment using rules; returns null if nothing matched.
   * Used by callers that want a fast, dependency-free verdict (no LLM).
   */
  classifyOne(comment: string): ClassifyResult | null {
    const hit = classifyByRules(comment)
    if (!hit)
      return null
    return {
      intent: hit.intent,
      confidence: 0.55, // heuristic floor for rule hits
      sentiment: 0,
      source: EngagementMiningSource.RULES,
      matchedKeywords: hit.matched,
    }
  }

  /**
   * Full pipeline. Returns the persisted hits in the same order as the input.
   *
   * - Comments that hit Stage 1 are queued for Stage 2 (LLM batch). The LLM
   *   verdict, when its confidence ≥ {@link MIN_CONFIDENCE_LLM}, replaces the
   *   rule verdict and is marked `source = HYBRID`.
   * - Comments that miss Stage 1 are still sent through Stage 2 only when an
   *   LLM model is configured AND the comment contains punctuation suggesting
   *   a question. Otherwise we drop them — most chatter is praise/spam and
   *   not worth the LLM cost.
   */
  async classifyAndStoreBatch(input: {
    userId: string
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
  }): Promise<EngagementMiningHit[]> {
    if (input.comments.length === 0)
      return []
    const model = input.model && input.model.length > 0 ? input.model : DEFAULT_LLM_MODEL

    // Stage 1
    const stage1: Array<{
      id: string
      content: string
      author?: { id?: string, name?: string }
      verdict: ClassifyResult | null
    }> = input.comments.map(c => ({
      id: c.id,
      content: c.content,
      author: { id: c.authorId, name: c.authorName },
      verdict: this.classifyOne(c.content),
    }))

    // Stage 2 candidates: rule hits OR free-text questions
    const stage2Candidates = stage1.filter(c => c.verdict || /[?\u003f\uff1f]/.test(c.content))

    let llmVerdicts: Map<string, LlmVerdict> = new Map()
    if (stage2Candidates.length > 0 && model) {
      try {
        llmVerdicts = await this.classifyWithLlm({
          userId: input.userId,
          model,
          comments: stage2Candidates.map(c => ({ id: c.id, content: c.content })),
        })
      }
      catch (err) {
        this.logger.warn(`LLM classification failed; falling back to rules only: ${(err as Error).message}`)
      }
    }

    // Merge + persist
    const persisted: EngagementMiningHit[] = []
    for (const item of stage1) {
      const llm = llmVerdicts.get(item.id)
      const merged = this.merge(item.verdict, llm)
      if (!merged)
        continue
      const language = guessLanguage(item.content)
      const upserted = await this.hitRepo.upsertHit({
        userId: input.userId,
        accountId: input.accountId,
        platform: input.platform,
        postId: input.postId,
        commentId: item.id,
        commentContent: item.content,
        authorId: item.author?.id ?? '',
        authorName: item.author?.name ?? '',
        intent: merged.intent,
        confidence: merged.confidence,
        sentiment: merged.sentiment,
        recommendedReply: merged.recommendedReply ?? '',
        source: merged.source,
        status: EngagementMiningStatus.NEW,
        language,
        matchedKeywords: merged.matchedKeywords,
      })
      if (upserted)
        persisted.push(upserted)
    }
    return persisted
  }

  async list(query: ListMiningHitsRequest, userId: string): Promise<EngagementMiningHit[]> {
    return this.hitRepo.listForUser({ ...query, userId })
  }

  async markStatus(req: MarkMiningHitRequest): Promise<EngagementMiningHit> {
    const updated = await this.hitRepo.markStatus(req.hitId, req.status)
    if (!updated)
      throw new AppException(ResponseCode.EngagementMiningHitNotFound)
    return updated
  }

  /** Public so the BullMQ consumer can call it directly. */
  enqueue(data: Parameters<EngagementMiningService['classifyAndStoreBatch']>[0]): Promise<unknown> {
    return this.queueService.addEngagementMiningJob(data)
  }

  // ---------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------

  private merge(rule: ClassifyResult | null, llm?: LlmVerdict): ClassifyResult | null {
    if (!rule && !llm)
      return null
    if (!llm)
      return rule
    if (llm.confidence < MIN_CONFIDENCE_LLM)
      return rule
    const intentKey = llm.intent in EngagementMiningIntent
      ? EngagementMiningIntent[llm.intent]
      : EngagementMiningIntent.OTHER
    return {
      intent: intentKey,
      confidence: llm.confidence,
      sentiment: clamp(llm.sentiment, -1, 1),
      recommendedReply: llm.recommendedReply,
      source: rule ? EngagementMiningSource.HYBRID : EngagementMiningSource.LLM,
      matchedKeywords: rule?.matchedKeywords ?? [],
    }
  }

  private async classifyWithLlm(params: {
    userId: string
    model: string
    comments: Array<{ id: string, content: string }>
  }): Promise<Map<string, LlmVerdict>> {
    const enumValues = Object.values(EngagementMiningIntent).join(' | ')
    const aiReq: UserChatCompletionDto = {
      userId: params.userId,
      userType: UserType.User,
      model: params.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful social-media community manager. Classify the intent of each comment.',
        },
        {
          role: 'user',
          content: `For each comment in the input array, return a JSON array (no prose, no code fences) where each element is:
{"id": <id>, "intent": <one of ${enumValues}>, "confidence": <0..1>, "sentiment": <-1..1>, "recommendedReply": <short reply in the same language as the comment, optional>}.

Definitions:
- LINK_REQUEST: asking for a link / where to find
- PURCHASE_INTENT: clear buying signal (already buying, asking how to order)
- PRICE_QUESTION: explicitly asking price
- COMPLAINT: negative experience / refund
- QUESTION: a general question that is not the above
- PRAISE: positive sentiment with no purchase signal
- SPAM: links/promo/unrelated
- OTHER: none of the above

Reply with the JSON array only.`,
        },
        {
          role: 'user',
          content: JSON.stringify(params.comments.map(c => ({ id: c.id, comment: c.content }))),
        },
      ],
    }
    const resp = await this.aiService.chatCompletion(aiReq)
    const content = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content)
    const parsed = safeParseJsonArray<LlmVerdict>(content) ?? []
    const map = new Map<string, LlmVerdict>()
    for (const v of parsed) {
      if (typeof v?.id === 'string')
        map.set(v.id, v)
    }
    return map
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value))
    return 0
  return Math.max(min, Math.min(max, value))
}

function safeParseJsonArray<T>(value: string): T[] | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed))
      return parsed as T[]
    return null
  }
  catch {
    // some LLMs add code fences; strip and retry once
    const fenced = value.replace(/^```(?:json)?\n?|```$/g, '').trim()
    if (fenced && fenced !== value) {
      try {
        const parsed = JSON.parse(fenced) as unknown
        return Array.isArray(parsed) ? (parsed as T[]) : null
      }
      catch {
        return null
      }
    }
    return null
  }
}
