# aitoearn-automation

Server-side browser automation engine for the **Engage Agent**. No browser
extension is required on the user side — all automation runs inside this
NestJS service via Playwright (with `playwright-extra` + stealth plugin).

> Status: **Phase 3B PoC** — only Xiaohongshu (`xhs`) is wired up, with three
> actions: `like / reply / search`. The pool, vault and selector layers are
> built so adding Douyin / 视频号 / 快手 is mostly a new worker file.

## What ships in this PoC

| Endpoint | What it does |
|----------|--------------|
| `POST /api/automation/xhs/note/like` | Open a note URL and click the like button (idempotent — returns `alreadyLiked: true` if already liked) |
| `POST /api/automation/xhs/note/reply` | Type a reply into the comment box and submit it |
| `POST /api/automation/xhs/search` | Search by keyword/brand and return the top notes (id, title, url, author, like-count, thumbnail) |

Each request:

1. Fetches cookies for `xhs:<accountId>` from the **Cookie Vault**.
2. Acquires a `BrowserContext` from the **Browser Pool** (1 context per account).
3. Runs the action with stealth-patched Chromium and human-like delays.
4. Releases the page and pools the context for reuse.

## Quick start (local, no Docker)

Prereqs: Node 24, pnpm 9+, and a logged-in xiaohongshu.com account in any browser.

```bash
# 1. install deps from the backend workspace root.
#    The lockfile is committed and stays in sync — use --frozen-lockfile in CI.
cd project/aitoearn-backend
pnpm install --frozen-lockfile

# Playwright browsers (Chromium only; ~150MB)
pnpm exec playwright install chromium

# 2. dump your xiaohongshu cookies to a JSON file.
#    Pick any of: Chrome DevTools "storageState" export, "EditThisCookie",
#    or "Cookie-Editor". All three formats are accepted by the Vault.
mkdir -p apps/aitoearn-automation/.cookies
mv ~/Downloads/xiaohongshu-cookies.json \
   apps/aitoearn-automation/.cookies/xhs-default.json

# 3. set env + serve.
#    No need to copy local.config.js / dev.config.js / prod.config.js — the
#    PoC reads ./apps/aitoearn-automation/config/config.js directly. Override
#    individual values via env vars (see Configuration below).
export AUTOMATION_COOKIE_FILE="$PWD/apps/aitoearn-automation/.cookies/xhs-default.json"
export AUTOMATION_HEADLESS="false"   # see the browser the first time
pnpm nx serve aitoearn-automation

# 4. smoke-test the three endpoints
curl -X POST http://localhost:3010/api/automation/xhs/search \
  -H 'content-type: application/json' \
  -d '{"keyword":"AiToEarn","limit":5}'

curl -X POST http://localhost:3010/api/automation/xhs/note/like \
  -H 'content-type: application/json' \
  -d '{"noteUrl":"https://www.xiaohongshu.com/explore/<note-id>"}'

curl -X POST http://localhost:3010/api/automation/xhs/note/reply \
  -H 'content-type: application/json' \
  -d '{"noteUrl":"https://www.xiaohongshu.com/explore/<note-id>","comment":"\u770b\u8d77\u6765\u5f88\u68d2!"}'
```

API reference (Scalar / OpenAPI): http://localhost:3010/api/docs

> **Editor / OS encoding warning (Windows users especially)**
>
> Some Windows IDEs and terminals default to GBK and will silently corrupt
> Chinese characters when saving UTF-8 files. To stay safe, every Chinese
> string the runtime depends on (selector text, sample reply) is written as
> a `\uXXXX` escape inside `xhs.selectors.ts`. **Don't replace these escapes
> with raw Chinese characters** unless you've verified your editor saves the
> file as UTF-8.

## Cookie file format

The Vault accepts any of these shapes — pick whichever your exporter spits out:

```jsonc
// Playwright storageState (preferred)
{ "cookies": [ { "name": "web_session", "value": "...", "domain": ".xiaohongshu.com", "path": "/" } ] }

// Flat array (assumed to be xhs:default)
[ { "name": "web_session", "value": "...", "domain": ".xiaohongshu.com" } ]

// Keyed map for multi-account
{
  "xhs:default": [ /* cookies */ ],
  "xhs:my-other-account": [ /* cookies */ ]
}
```

When you call an endpoint, pass `accountId` to pick which key to use; defaults
to `default`.

## Quick start (Docker)

```bash
# 1. build the image (from repo root)
docker build \
  -t aitoearn/automation:latest \
  -f project/aitoearn-backend/apps/aitoearn-automation/Dockerfile \
  project/aitoearn-backend

# 2. run with cookies mounted in
docker run --rm -p 3010:3010 \
  --shm-size=1gb \
  -v "$PWD/.cookies:/run/secrets:ro" \
  -e AUTOMATION_COOKIE_FILE=/run/secrets/xhs-default.json \
  aitoearn/automation:latest
```

Or copy the snippet from `docker-compose.snippet.yml` into the workspace
`docker-compose.yml`.

## Configuration

All env vars are optional unless marked otherwise.

| Var | Default | Notes |
|-----|---------|-------|
| `AUTOMATION_PORT` | `3010` | HTTP port |
| `AUTOMATION_INTERNAL_TOKEN` | `automation-poc-internal-token` | Shared with `aitoearn-server` for internal RPC (PoC-only) |
| `AUTOMATION_HEADLESS` | `true` | Set to `false` to watch the browser locally |
| `AUTOMATION_BROWSER_POOL_SIZE` | `3` | Max concurrent BrowserContexts |
| `AUTOMATION_USER_AGENT` | desktop Chrome 120 | Override per fleet |
| `AUTOMATION_PROXY` | _none_ | e.g. `http://user:pass@proxy:8080` |
| `AUTOMATION_MIN_DELAY_MS` | `800` | Min human-like pause between ops |
| `AUTOMATION_MAX_DELAY_MS` | `2400` | Max human-like pause |
| `AUTOMATION_COOKIE_FILE` | _none_ | Path to a cookie JSON file |
| `AUTOMATION_COOKIE_JSON` | _none_ | Inline JSON (alt to file) |

## What's intentionally simple in the PoC

- Cookies are stored unencrypted on disk. **Production will use AES-256-GCM
  with a KMS-derived key** (see `.kiro/specs/engage-built-in/design.md`).
- Rate limiting / circuit breaker is not wired yet — that's Phase 4.
- Only the controller path; no NATS / BullMQ RPC from `aitoearn-server` yet
  (Phase 3A in `tasks.md`).
- Selectors will drift; bump `XhsSelectors.version` and add a fallback when
  they break.

## Where this fits in the bigger plan

- Spec: `.kiro/specs/engage-built-in/`
- Phase tracker: `.kiro/specs/engage-built-in/tasks.md` → **Phase 3B**
- Once this PoC is green we proceed to Phase 0/1/4 (backend skeleton, unified
  interface, rate guard) per the spec.
