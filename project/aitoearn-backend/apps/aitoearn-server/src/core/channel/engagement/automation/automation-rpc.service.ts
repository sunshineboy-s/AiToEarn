import { randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import {
  EngagementAutomationActionData,
  EngagementAutomationActionType,
  QueueService,
} from '@yikart/aitoearn-queue'
import { AppException, ResponseCode } from '@yikart/common'
import { ActionResult } from '../engagement.interface'

/**
 * Thin client that fans engagement actions out to `aitoearn-automation` via
 * BullMQ. The automation worker writes the result back as the job's return
 * value; we wait on `Job.waitUntilFinished` (Phase 3A MVP) — we'll swap to
 * NATS when latency matters.
 *
 * Failure modes:
 *  - if no automation worker has registered to consume the queue, the wait
 *    will time out and we surface `EngagementAutomationUnavailable` so the
 *    controller returns a typed error instead of a generic 500
 *  - if the worker returns `{success: false}`, we propagate it as-is so the
 *    rate-limit guard sees the failure and the breaker can trip
 */
@Injectable()
export class EngagementAutomationRpcService {
  private readonly logger = new Logger(EngagementAutomationRpcService.name)
  private static readonly DEFAULT_TIMEOUT_MS = 90_000

  constructor(private readonly queueService: QueueService) {}

  async invoke(input: {
    userId: string
    accountId: string
    platform: string
    action: EngagementAutomationActionType
    target: string
    message?: string
    metadata?: Record<string, unknown>
    timeoutMs?: number
  }): Promise<ActionResult> {
    const correlationId = randomUUID()
    const data: EngagementAutomationActionData = {
      correlationId,
      userId: input.userId,
      accountId: input.accountId,
      platform: input.platform,
      action: input.action,
      target: input.target,
      message: input.message,
      metadata: input.metadata,
    }
    await this.queueService.addEngagementAutomationActionJob(data)
    try {
      const result = await this.queueService.waitForEngagementAutomationActionResult<ActionResult>(
        correlationId,
        input.timeoutMs ?? EngagementAutomationRpcService.DEFAULT_TIMEOUT_MS,
      )
      return result
    }
    catch (err) {
      this.logger.warn(
        `automation invoke timed out (correlationId=${correlationId}): ${(err as Error).message}`,
      )
      throw new AppException(ResponseCode.EngagementAutomationUnavailable)
    }
  }
}
