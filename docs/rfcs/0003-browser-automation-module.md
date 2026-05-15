# RFC 0003: Browser Automation Module — `aitoearn-browser-worker`

- **Status**: Draft
- **Author**: harry / contributors
- **Created**: 2026-05-15
- **Cross-refs**: [RFC 0001 §6.2](./0001-platform-deepening.md), [RFC 0002](./0002-xhs-fallback.md)
- **Discussion**: PR comment thread

## TL;DR

Three platforms in our `AccountType` enum will never have a workable Open Platform backend in the foreseeable future:

- **Xiaohongshu** — no Open Platform at all
- **WeChat 视频号 (Channels)** — no third-party data API, only an Electron-driven creator portal
- **Douyin (engagement writes)** — Open Platform reads work, but comment-write scope is gated and may never open for non-corp accounts

For each of these, the only realistic backend is a **headless browser doing what a logged-in user would do**. Today, AiToEarn-electron solves this for publish on the user's own machine. We do not have an equivalent on the backend.

This RFC proposes a single shared service, `apps/aitoearn-browser-worker`, that owns a Playwright + Chromium pool and exposes a job-queue interface. It does NOT propose any specific platform adapter; those are separate RFCs (RFC 0002 for XHS, future RFCs for 视频号 and Douyin write).

The point is to spend the infrastructure cost **once**, not three times.

## 1. Why one shared module, not per-platform

A naive approach is to have each adapter (`XhsScrapeAdapter`, `WxSphScrapeAdapter`, ...) own its own headless browser lifecycle. That route has known failure modes from prior projects:

- **3× the Chromium memory baseline.** A single Chromium process is ~150–250 MB resident. Three pools means three baselines plus their isolation overhead.
- **3× anti-detection tuning.** `playwright-extra` with `puppeteer-extra-plugin-stealth` plus user-agent rotation, viewport jitter, locale headers — every adapter re-implements this badly.
- **3× proxy management.** Residential proxy rotation, sticky sessions per account, cooldown windows on banned IPs.
- **3× crash-recovery.** A Chromium crash in one adapter taking down the whole NestJS server is the kind of thing that ships once and ruins a Saturday.

Putting the browser pool behind a queue and a worker process gives us:

- One place to upgrade Chromium / Playwright
- One place to add proxy rotation
- One place to add kill switches and rate caps
- A clean process boundary so a Chromium OOM is isolated from `aitoearn-server`

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        aitoearn-server                          │
│                                                                 │
│   XhsEngagementProvider     WxSphDataService   DouyinWriteAdapter│
│           │                       │                  │          │
│           └───────────────┬───────┴──────────────────┘          │
│                           │                                     │
│                  BrowserWorkerClient                            │
│                  (BullMQ producer)                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │  Redis / BullMQ  │
                    │  browser-worker  │
                    │     queue        │
                    └────────┬─────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  aitoearn-browser-worker                        │
│                                                                 │
│   ┌────────────────────────┐    ┌──────────────────────────┐   │
│   │  BullMQ Worker         │───▶│  ChromiumPool            │   │
│   │  - dispatch by         │    │  - 4–8 contexts          │   │
│   │    job.type            │    │  - per-account session   │   │
│   └────────────────────────┘    │  - proxy assignment      │   │
│             │                   │  - stealth plugins       │   │
│             ▼                   └──────────────────────────┘   │
│   ┌────────────────────────────────────────────────────────┐   │
│   │  PlatformPlaywrightFlow (per-platform module)          │   │
│   │  - XhsFlow / WxSphFlow / DouyinWriteFlow               │   │
│   │  - selector + flow encoded here, not in browser pool   │   │
│   └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Job interface

The worker accepts one job shape, regardless of platform:

```ts
// libs/aitoearn-browser-client/src/types.ts
export interface BrowserJob {
  /** UUID stamped by the producer */
  id: string

  /** Which platform flow to dispatch to */
  flow: 'xhs.fetchUserPosts'
       | 'xhs.fetchPostComments'
       | 'xhs.replyToComment'
       | 'wxSph.getAccountDataCube'
       | 'wxSph.getArcDataCube'
       | 'douyin.replyToComment'

  /** Account whose session to use. Worker resolves cookies/storage from secret store */
  accountId: string

  /** Free-form per-flow parameters; validated inside the flow */
  payload: Record<string, unknown>

  /** Hard timeout for the entire flow */
  timeoutMs: number

  /** Set on retries; flow can adjust pacing if > 0 */
  attempt: number
}
```

The producer side is one small typed client:

```ts
// libs/aitoearn-browser-client/src/browser-worker.client.ts
@Injectable()
export class BrowserWorkerClient {
  async runFlow<T>(job: Omit<BrowserJob, 'id' | 'attempt'>): Promise<T> {
    const id = crypto.randomUUID()
    const result = await this.queue.add(
      job.flow,
      { id, attempt: 0, ...job },
      { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } }
    )
    return result.waitUntilFinished(this.events) as Promise<T>
  }
}
```

So an adapter on the server side becomes:

```ts
// XhsEngagementProvider#fetchPostComments (real impl, post RFC 0002 approval)
async fetchPostComments(accountId, postId, pagination) {
  return this.browserWorker.runFlow<FetchPostCommentsResponse>({
    flow: 'xhs.fetchPostComments',
    accountId,
    payload: { postId, pagination },
    timeoutMs: 30_000,
  })
}
```

That's the whole adapter. All the messy stuff is across the queue boundary.

## 3. Operational concerns

### 3.1 Capacity model

| Resource | Per-context cost | Notes |
|---|---|---|
| RAM | 200–400 MB | Hot Chromium with 1 page open |
| CPU | 5–15% of one core | While interacting; idle is ~1% |
| Disk | 50 MB | Per-account `userDataDir` for session persistence |

Starting target: **8 concurrent contexts per worker pod, 4 GB RAM, 2 vCPU**. Horizontal scale by pod count, not by context count per pod (Chromium does not get more reliable past ~8 contexts).

### 3.2 Session storage

Two options:

- **`userDataDir` per account, mounted from S3 / EFS.** Survives pod restart; large; needs lock when in use. Recommended.
- **Storage state JSON snapshot per account.** Smaller; loses some browser-fingerprint persistence each cold-start; cheaper.

We prefer `userDataDir` because XHS and 视频号 fingerprint suspiciously when cookies look "fresh."

### 3.3 Proxy rotation

Three tiers, fail down:

1. **Per-account sticky residential proxy** (preferred for XHS). Sticky for 1 hour windows.
2. **Datacenter proxy with low-volume jitter** (acceptable for 视频号 reads).
3. **Direct egress** — only for Douyin Open API calls that don't go through the browser at all.

Provider-agnostic. We propose a `ProxyAllocator` interface so we can swap providers without flow changes.

### 3.4 Failure modes & SLOs

| Failure | Detection | Action |
|---|---|---|
| Chromium OOM | Worker process exit code | BullMQ retry on a fresh pod; alert on 5+/hour |
| Selector regression on platform UI change | Job fails with `SelectorNotFound` typed error | Page snapshot stored to S3 for forensics; on-call alert |
| Anti-bot challenge appears | Flow detects challenge HTML; raises `AntiBotChallenge` | Job is moved to dead-letter queue; account marked `auth-attention-needed`; user is prompted in UI |
| Account banned | First 4xx with specific markers | Account marked `banned`; no further jobs scheduled; alert |

Proposed SLOs (initial, conservative):
- **p50 latency**: 8s for reads, 15s for writes
- **p99 latency**: 45s for reads, 90s for writes
- **Job success rate**: ≥95% over rolling 24h, excluding dead-letter
- **Selector regression detection**: ≤30 minutes from first failure to alert

### 3.5 Kill switches

Two flags, both in config + Redis (config wins on restart, Redis wins live):

- `browserWorker.enabled: bool` — global
- `browserWorker.flow.<flow-name>.enabled: bool` — per flow

Use case: XHS rotates and 30% of `xhs.fetchPostComments` jobs fail. We flip `xhs.fetchPostComments.enabled = false` from a config endpoint without redeploying. Adapter on the server side falls back to the unsupported stub from PR #12 with a clear warn log.

## 4. Module layout

```
apps/aitoearn-browser-worker/
├── src/
│   ├── main.ts                # Nest standalone bootstrap, BullMQ worker only
│   ├── app.module.ts
│   ├── pool/
│   │   ├── chromium-pool.ts          # Browser lifecycle, context allocation
│   │   ├── stealth.ts                # Centralised stealth plugin config
│   │   ├── session-store.ts          # userDataDir mount + lock
│   │   └── proxy-allocator.ts        # interface + default impl
│   ├── flows/
│   │   ├── flow.interface.ts         # PlatformPlaywrightFlow<TPayload, TResult>
│   │   ├── xhs/                      # added by RFC 0002 follow-up
│   │   ├── wx-sph/                   # added by future RFC
│   │   └── douyin-write/             # added by future RFC
│   └── observability/
│       ├── metrics.ts                # Prom metrics: jobs in-flight, latency, error rate
│       └── snapshots.ts              # On-failure page screenshot/HTML to S3
├── Dockerfile                       # Includes Chromium binaries
└── project.json

libs/aitoearn-browser-client/
└── src/
    ├── index.ts
    ├── browser-worker.client.ts     # Used by aitoearn-server adapters
    └── types.ts                     # BrowserJob and per-flow payload schemas (zod)
```

## 5. Migration strategy

This module replaces nothing. It adds a new tool. Migration is per-platform:

1. **Land RFC 0003 (this one)** — module skeleton only, no flows.
2. **Land worker bootstrap PR** — empty Nest app, BullMQ subscribed, ChromiumPool, stealth, snapshots, metrics. CI: spin up worker + dummy "noop.flow" job and assert it round-trips. **No platform code yet.**
3. **Per-platform follow-up RFCs and PRs** — XHS first (gated on RFC 0002 approval), then 视频号, then Douyin write.

If RFC 0002 is rejected, this RFC still has value: 视频号 is the only viable reason to keep going, but the module sized at "1 platform" is over-engineered. In that case we should reject this RFC too.

## 6. Non-goals

- **Not** a generic web scraper. Flows are platform-specific and live in this repo.
- **Not** a replacement for any working Open Platform integration. If a platform has a working API, use it.
- **Not** a way to evade rate limits on platforms that have working APIs. Browser flows must respect platform limits.
- **Not** AiToEarn-electron's automation. Electron continues to do what it does on the user's machine for publish; this is server-side only.
- **Not** committed to any particular platform adapter — those need their own RFCs.

## 7. Risks specific to running this in production

| Risk | Severity | Notes |
|---|---|---|
| **Cost**: Chromium pods are expensive vs stateless NestJS | High | Budget needed before merging the bootstrap PR |
| **Detection arms race** | Medium-High | Stealth tooling drifts; budget for ongoing maintenance, not a one-time spend |
| **Legal exposure** | Medium | Same as RFC 0002 §3 cookie-mode legal posture; legal sign-off required before any user-facing flow ships |
| **Operational burden** | Medium | Adds a new on-call surface (Chromium + selectors + proxies) that the team has not run before |
| **Single point of failure** | Medium | All three platforms degrade together if the worker tier goes down; mitigated by graceful fallback to stubs from PR #12 |

## 8. Decision asked of reviewers

This RFC is a **gate**, not a commitment. Approving it means approving this sequence:

1. Bootstrap PR (skeleton, zero platform flows): can land within a week.
2. RFC 0002 decides if XHS is the first flow.
3. Each subsequent platform flow is its own RFC + PR.

Rejecting it means:

- XHS data-cube and engagement remain stubs forever (RFC 0002 must be rejected as well).
- 视频号 data-cube remains a stub forever.
- Douyin engagement reads ship as Open Platform calls only; writes never happen.

Both outcomes are acceptable; what isn't acceptable is shipping platform-specific Playwright code in `aitoearn-server` directly. That path is explicitly rejected by this RFC.

## 9. Open questions for reviewers

1. **Hosting target**: ECS Fargate, EKS, plain EC2? Chromium needs more headroom than typical NestJS pods.
2. **Snapshot storage**: same S3 bucket as `assets`, or a separate one? Snapshots may contain user data.
3. **Cost ceiling**: what's the monthly budget for this module before it becomes interesting to product?
4. **Who owns it**: this needs a named on-call rotation, distinct from current backend on-call. Do we have the headcount?
5. **Local dev experience**: do contributors run real Chromium locally, or is there a mock mode for development that returns fixture data?
