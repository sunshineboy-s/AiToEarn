import { Counter, register } from 'prom-client'

/**
 * Single, process-wide counter for engagement actions. The `result` label is
 * one of:
 *   - `success`        — provider returned `{ success: true }`
 *   - `failure`        — provider returned `{ success: false }` or threw
 *   - `not_supported`  — capability error before the provider was called
 *   - `rate_limited`   — guard rejected the call (bucket / breaker)
 *
 * The starter already exposes /metrics via prom-client's default registry, so
 * `getOrCreate` registers exactly once even when this file is imported across
 * the app graph (NestJS resolves the singleton service once but specs may
 * import the file multiple times, and prom-client throws on duplicate names).
 */
const NAME = 'engage_action_total'

function getOrCreateCounter(): Counter<'platform' | 'action' | 'result'> {
  const existing = register.getSingleMetric(NAME) as Counter<'platform' | 'action' | 'result'> | undefined
  if (existing)
    return existing
  return new Counter({
    name: NAME,
    help: 'Total number of engagement actions executed by the built-in engine',
    labelNames: ['platform', 'action', 'result'] as const,
  })
}

export const engageActionTotal = getOrCreateCounter()

export type EngagementActionResultLabel = 'success' | 'failure' | 'not_supported' | 'rate_limited'

/** Convenience wrapper so callers don't have to remember the label tuple. */
export function recordEngagementAction(
  platform: string,
  action: string,
  result: EngagementActionResultLabel,
): void {
  engageActionTotal.inc({ platform, action, result })
}
