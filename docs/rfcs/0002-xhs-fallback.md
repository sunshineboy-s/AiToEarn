# RFC 0002: Xiaohongshu Fallback — Cookie-Mode vs Playwright

- **Status**: Draft (legal/risk review requested)
- **Author**: harry / contributors
- **Created**: 2026-05-15
- **Depends on**: [RFC 0001 §6.4](./0001-platform-deepening.md) (XHS data-cube real backend), [RFC 0003](./0003-browser-automation-module.md) (browser worker shared infra)
- **Discussion**: PR comment thread

## TL;DR

Xiaohongshu (小红书) has no Open Platform. To honor the platform appearing in our `AccountType` enum, in `AiToEarn-electron` publish flow, and on the marketing site, we need a real backend behind `XhsDataService` and `XhsEngagementProvider`. There are exactly two viable architectures and they have very different risk profiles.

This RFC asks the project to **pick one** before any code is merged. The recommendation is **Browser-mode via the shared worker (RFC 0003)** for any future XHS work, with cookie-mode considered only for a tightly scoped read-only data-cube path if we accept the documented risks.

| Option | Backend | Risk profile | Recommended for |
|---|---|---|---|
| A. Cookie-mode | Direct HTTP to XHS internal endpoints with the user's logged-in cookies | High signature-rotation churn; medium ban risk | Read-only data-cube |
| B. Playwright worker | Headless Chromium driving the XHS web app | High infra cost; lower ban risk; covers writes | Engagement (comments / replies), publish fallback |

## 1. Why this RFC exists

Three forces converge on XHS:

1. **Product**: XHS is in 14/15 of our `AccountType` registrations and listed in every README. The marketing claim is "publish + engage + analytics on XHS." Today only publish (via Electron cookie-scrape) is real.
2. **Skeleton PR (#12)**: `XhsDataService` and `XhsEngagementProvider` are stubs that return empty results plus a structured warn log. Production logs will show steady traffic to these stubs as soon as the next release ships. We need a path to "make the warn go away."
3. **Existing precedent in repo**: `AiToEarn-electron` already runs cookie-mode XHS automation for publish. So the project has *already* paid some of the legal/risk cost — but only for the user's own machine, not for our backend.

The decision point: do we extend cookie-mode to the backend, or do we build a server-side Playwright worker?

## 2. Option A — Cookie-mode (HTTP scrape)

### Architecture

```
[user logs in to XHS in our Electron app]
        |
        v
[Electron grabs `web_session`, `xsecappid`, `webId`, `a1`, ...]
        |
        v
[Electron POSTs cookie bundle to backend, encrypted at rest]
        |
        v
[XhsCookieAdapter] -> direct HTTP to https://edith.xiaohongshu.com/...
```

### What's hard about it

XHS internal endpoints require **rotating request signatures**, currently `X-s` / `X-t` / `X-s-common` headers, computed client-side from `webId`, `a1`, request path, and request body via an obfuscated JS routine they ship in the SPA bundle. The community has reverse-engineered this routine many times, but XHS rotates it on a roughly monthly cadence. Most reference implementations (`ReaJason/xhs`, `MediaCrawler`'s XHS module) lag the live routine by 1–4 weeks after a rotation.

Two viable signature strategies:
- **Native re-implementation in TS**: fastest at runtime, very brittle. Estimated **2–5 dev-days per rotation** to chase. Out of band on weekends and holidays.
- **Embedded JS executor**: ship the obfuscated client routine in our backend and run it in `vm` / `node-jsdom`. Slower (~30ms overhead), but **the rotation pain shifts to "re-grab the JS file"** which is a 10-minute job. We pay ongoing CPU cost.

Recommendation if we go this route: embedded JS executor. The TS rewrite is a tarpit.

### Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Signature rotation breaks data-cube within hours | **High** | Embedded executor; weekly automated probe + alert; SLO budget for ~2 outage hours/month |
| XHS detects the cookie pattern (server-side IPs hitting `edith.` from non-mobile user-agents) | **Medium** | Match real headers verbatim; add per-account jitter; cap requests per cookie at e.g. 60/min |
| Account ban for the end user | **Low–Medium** | Read-only mode keeps risk low; warn user in UI; document the trade-off in onboarding |
| ToS violation exposure for AiToEarn the company | **Medium** | XHS ToS forbids "automated scraping". Cookie is the user's, so first liability is the user, but discovery risk is non-zero. Need legal sign-off |
| Cookie lifecycle (XHS rotates `web_session` on suspicion) | **Medium** | UI prompt to re-login; do not silently fall back to stub |

### What it gets us

- Fastest to the first real number on `XhsDataService` (1–2 weeks if the embedded-executor path goes smoothly)
- No new infrastructure
- Same operational surface as Electron's existing publish flow

### What it does NOT get us

- **Writes** — replying to comments, posting comments. XHS write endpoints are signature-protected *and* hit a separate anti-bot called the "verify" challenge that requires real browser fingerprints. Writes via cookie-mode are practically infeasible.

## 3. Option B — Playwright worker

### Architecture

```
[backend submits XhsEngagementJob to BullMQ queue]
        |
        v
[aitoearn-browser-worker (RFC 0003)]
        v
[Playwright Chromium loads xiaohongshu.com with stored session]
        v
[runs the user-portrait or comment flow as if a human did it]
        v
[posts results back via callback / queue completion]
```

### Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Detection by XHS's bot fingerprint (Cloudflare-class checks) | **Medium** | `playwright-extra` + `puppeteer-extra-plugin-stealth`; rotate residential proxies; pace at human-like cadence |
| Per-job latency 5–30s (vs <1s for cookie-mode) | **High for analytics, OK for engagement** | Queue-based; UI shows "queued" state; never block API request on the job |
| Chromium memory/CPU footprint | **High infra cost** | Worker pool sized to ~8 concurrent contexts per 4 GB RAM; horizontal scale on demand |
| Breaks when XHS web app changes selectors | **Medium** | Selector regression tests in CI; alert on >5% job failure rate |
| Same ToS exposure as cookie-mode | **Medium** | Same legal posture; document the trade-off |

### What it gets us

- **Engagement writes work** (comments, replies, follows)
- **Selector breakage > signature rotation** as a maintenance burden — selectors break less often and break with clearer symptoms
- **One module solves XHS + WeChat Channels (视频号) + Douyin fallback** — see RFC 0003

### What it does NOT get us

- Cheap. This is genuinely expensive infra by AiToEarn standards (current backend is stateless NestJS).

## 4. Recommendation

| Use case | Recommended option |
|---|---|
| **Engagement (comments, replies)** | **B. Playwright worker** — only viable choice |
| **Analytics / data-cube** | **B. Playwright worker** if we're already building it for engagement; otherwise **A. Cookie-mode** for the embedded-executor path |
| **Publish fallback** | Keep using AiToEarn-electron's cookie-mode (already paid) |

If the project decides not to build the browser worker, the consequence is: **`XhsEngagementProvider` stays a stub forever**, and the marketing claim "engage on XHS" remains aspirational. That's an acceptable answer; it just needs to be acknowledged in this thread.

## 5. Open questions for reviewers

1. **Legal sign-off**: who signs off on cookie-mode for backend? Is this AiToEarn HQ legal or does it need to be passed to investors first?
2. **Cookie storage**: if we go cookie-mode, where does the cookie bundle live? Today Electron keeps it on the user's machine. Sending it to the backend means we're now custodian of "log in as this user on XHS forever" credentials. That's a significant security posture shift.
3. **User consent surface**: what's the in-app UI that explains to a user "we will run automated requests on your XHS account, and there is non-zero ban risk"? Without that surface we should not ship either option.
4. **Probe / alert SLA**: who's on-call when XHS rotates and the data-cube goes silent? The current on-call rota does not cover this.
5. **Kill switch**: do we add a feature flag (`channel.xhs.fallback.enabled`) so we can disable backend XHS calls instantly if a rotation or ban wave hits?

## 6. Rejected alternatives

- **MCP scraper services (e.g. r.jina.ai, defuddle.md)** — discussed in PR #9 chat. They handle generic web pages but cannot handle XHS's authenticated SPA. Out of scope.
- **`MediaCrawler` direct integration** — non-commercial license. Cannot vendor.
- **XHS official "creator data dashboard" CSV export** — exists but is per-account, manual, and not API-driven. UX dead end.

## 7. If approved, next steps

This RFC closes with one of three outcomes:

1. **Approve B (browser worker)** → unblocks RFC 0003 implementation. Estimated 4–6 dev-weeks for the shared worker + the XHS adapter on top of it.
2. **Approve A (cookie-mode, read-only)** → 1–2 dev-weeks. Engagement provider remains a stub forever; this gets called out in our README.
3. **Reject both, accept stub** → no work; we document in README that XHS analytics/engagement is not supported in the backend, only the Electron-side publish flow is.

The author of this RFC recommends **(1)**, but only if there is a clear product owner willing to pay the infra and on-call cost. Otherwise **(3)** is honest and shippable.
