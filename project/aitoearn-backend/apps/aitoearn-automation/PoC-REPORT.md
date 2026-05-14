# Phase 3B PoC Report — Xiaohongshu Automation

> **Fill this in after running the PoC end-to-end.** This report is the
> decision artefact: based on the numbers below we either commit to Phase 3A/3C
> or fall back to one of the alternative plans in `.kiro/specs/engage-built-in/`.

## TL;DR

- [ ] PoC reached the goal
- [ ] PoC partially reached the goal
- [ ] PoC failed — see "Failure analysis"

| Metric | Result |
|--------|--------|
| Like success rate (n=20) | __ / 20 |
| Reply success rate (n=10) | __ / 10 |
| Search recall@5 (n=5 keywords) | __ / 25 |
| Avg end-to-end latency (P50 / P95) | __ ms / __ ms |
| Risk-control hits (CAPTCHA, block, throttle) | __ |
| Cookie expiry observed during run | __ |

## Environment

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Host OS | |
| Node version | |
| Playwright version | |
| Headless? | |
| Proxy used? | |
| Account region | |
| Cookies refreshed at | |

## Test plan

### A. Like (idempotent)

| # | Note URL | Expected | Observed | Latency (ms) | Notes |
|---|----------|----------|----------|--------------|-------|
| 1 | … | success / alreadyLiked=false | | | |
| 2 | (rerun #1) | alreadyLiked=true | | | |
| ... | | | | | |

### B. Reply

| # | Note URL | Comment | Result | Latency (ms) | Notes |
|---|----------|---------|--------|--------------|-------|
| 1 | … | "看起来很棒!" | | | |
| ... | | | | | |

### C. Search

| # | Keyword | Items found | First item title | Notes |
|---|---------|-------------|-------------------|-------|
| 1 | "AiToEarn" | __ | | |
| 2 | "OPC一人公司" | __ | | |
| ... | | | | |

## Selector drift log

| Selector key | Old | New | Date |
|--------------|-----|-----|------|
| | | | |

> When a selector breaks, bump `XhsSelectors.version` in `xhs.selectors.ts`
> and add the new value to the fallback array.

## Latency breakdown (one representative request)

```
goto(noteUrl)                    ___ ms
firstVisible(likeButton)         ___ ms
humanDelay()                     ___ ms
click()                          ___ ms
total                            ___ ms
```

## Risk control observations

- CAPTCHA frequency: ___
- Cookie banned after N actions: ___
- IP-based throttling: ___
- Mitigations to try in Phase 3A:
  - [ ] sticky proxy per account
  - [ ] longer humanDelay between same-account ops
  - [ ] randomized typing speed per session

## Failure analysis (if PoC failed)

- What broke (selector? auth? CAPTCHA? IP block?)
- How long until it broke (immediately / after N requests / after N minutes)
- Did `playwright-extra` stealth help measurably?
- Recommended fallback:
  - [ ] Plan A — keep automation, switch tooling (e.g. `crawlee` / `botasaurus`)
  - [ ] Plan B — drop xhs/抖音 like/follow/favorite from README, keep only AI replies + brand monitoring
  - [ ] Plan C — paid headless-as-a-service (BrightData Browser API)

## Sign-off

| Role | Name | Decision (go / no-go) | Date |
|------|------|------------------------|------|
| Engineering | | | |
| Product | | | |
