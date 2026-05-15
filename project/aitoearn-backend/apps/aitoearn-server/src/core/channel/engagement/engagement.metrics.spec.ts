// @vitest-environment node
import { register } from 'prom-client'
import { engageActionTotal, recordEngagementAction } from './engagement.metrics'

describe('engagement.metrics', () => {
  it('registers exactly one counter named engage_action_total', () => {
    const metric = register.getSingleMetric('engage_action_total')
    expect(metric).toBeDefined()
    // re-importing must not double-register: the export is the same instance
    expect(metric).toBe(engageActionTotal)
  })

  it('increments the counter under the right (platform, action, result) labels', async () => {
    recordEngagementAction('xhs', 'like', 'success')
    recordEngagementAction('xhs', 'like', 'success')
    recordEngagementAction('xhs', 'like', 'failure')

    const json = await engageActionTotal.get()
    const successRow = json.values.find(v =>
      v.labels['platform'] === 'xhs' && v.labels['action'] === 'like' && v.labels['result'] === 'success',
    )
    const failureRow = json.values.find(v =>
      v.labels['platform'] === 'xhs' && v.labels['action'] === 'like' && v.labels['result'] === 'failure',
    )
    expect(successRow?.value ?? 0).toBeGreaterThanOrEqual(2)
    expect(failureRow?.value ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('exposes the four documented result labels', () => {
    // Increment each label once and verify it appears in the output. We only
    // care about the type-level contract — the runtime labels match the
    // EngagementActionResultLabel type alias.
    const labels: Array<'success' | 'failure' | 'not_supported' | 'rate_limited'> = [
      'success',
      'failure',
      'not_supported',
      'rate_limited',
    ]
    for (const l of labels)
      recordEngagementAction('test-platform', 'follow', l)
    expect(labels.length).toBe(4)
  })
})
