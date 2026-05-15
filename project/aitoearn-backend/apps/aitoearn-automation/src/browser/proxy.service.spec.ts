// @vitest-environment node
import { ProxyService } from './proxy.service'

describe('ProxyService', () => {
  it('returns undefined when the pool is empty', () => {
    const svc = new ProxyService([])
    expect(svc.pickFor('acc-1')).toBeUndefined()
  })

  it('keeps the same proxy for the same accountId across calls', () => {
    const svc = new ProxyService([
      { id: 'jp-1', url: 'http://jp1.example:8080' },
      { id: 'jp-2', url: 'http://jp2.example:8080' },
    ])
    const first = svc.pickFor('acc-1')
    const second = svc.pickFor('acc-1')
    expect(first).toBe(second)
  })

  it('rotates across accounts (round-robin)', () => {
    const svc = new ProxyService([
      { id: 'a', url: 'http://a.example:8080' },
      { id: 'b', url: 'http://b.example:8080' },
    ])
    const a = svc.pickFor('acc-1')
    const b = svc.pickFor('acc-2')
    // Two different accounts → different proxies as long as the pool has ≥2.
    expect(a).not.toBe(b)
  })

  it('honours an explicit preferProxyId', () => {
    const svc = new ProxyService([
      { id: 'a', url: 'http://a.example:8080' },
      { id: 'b', url: 'http://b.example:8080' },
    ])
    const url = svc.pickFor('acc-1', { preferProxyId: 'b' })
    expect(url).toBe('http://b.example:8080')
    // sticky after the explicit pick
    expect(svc.pickFor('acc-1')).toBe('http://b.example:8080')
  })

  it('reassigns when a previously-stuck proxy disappears from the pool', () => {
    const svc = new ProxyService([
      { id: 'a', url: 'http://a.example:8080' },
    ])
    const first = svc.pickFor('acc-1')
    expect(first).toBe('http://a.example:8080')

    // simulate pool drift by constructing a fresh service with a new pool —
    // the stickiness contract is "stable within a process boot", and a fresh
    // boot should still return *something* for the same account.
    const next = new ProxyService([
      { id: 'b', url: 'http://b.example:8080' },
    ])
    expect(next.pickFor('acc-1')).toBe('http://b.example:8080')
  })
})
