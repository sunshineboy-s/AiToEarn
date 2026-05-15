# Engage 内置化(无插件)设计文档

## 1. 总体架构

```
┌──────────────────────── aitoearn-server ────────────────────────┐
│                                                                  │
│  Controllers                                                     │
│  ├─ EngagementController (现有,扩展接口)                        │
│  ├─ EngagementMiningController (新增)                            │
│  └─ BrandMonitorController (新增)                                │
│                                                                  │
│  Services                                                        │
│  ├─ EngagementService (现有,扩展)                               │
│  ├─ EngagementCapabilityService (新增,能力矩阵)                 │
│  ├─ EngagementMiningService (新增,意图分类+落库)                │
│  ├─ BrandMonitorService (新增,扫描调度+去重+情绪)               │
│  └─ RateLimitGuardService (新增,账号级速率/黑白名单)            │
│                                                                  │
│  Engines (策略模式)                                              │
│  ├─ ApiEngagementProvider (现有 4 个 + YT/X/Pinterest/LinkedIn) │
│  └─ AutomationEngagementProvider (新增,RPC 客户端)              │
│                                                                  │
│  Queue Consumers                                                 │
│  ├─ EngagementTaskDistributionConsumer (现有)                    │
│  ├─ EngagementActionConsumer (新增,统一动作执行)                │
│  ├─ EngagementMiningConsumer (新增)                              │
│  └─ BrandScanConsumer (新增,repeat job)                          │
└──────────────────────────────────────────────────────────────────┘
                       │ RPC (gRPC / NATS)
                       ▼
┌──────────────────── aitoearn-automation (新增 app) ───────────────┐
│  Playwright + Stealth + Proxy Pool                               │
│  Workers: xhs / douyin / wxsph / wxgzh / kwai / bilibili         │
│  Auth: Cookie Vault (AES-256)                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 自动化运行位置 | **服务端独立 Worker app**(非用户浏览器) | 用户无感知;集中维护选择器;集中风控 |
| 自动化框架 | **Playwright + playwright-extra + stealth** | 比 Puppeteer 多浏览器支持更好,反检测生态成熟,MIT 协议 |
| 进程隔离 | 每平台一个 Worker 进程,**1 账号 1 BrowserContext** | Cookie/IP 隔离,降低串号风险 |
| RPC 协议 | **NATS request-reply**(项目里已有 `aitoearn-queue` 但 NATS 更适合短交互);MVP 阶段先复用 BullMQ + Redis | 复用现有基建,减少新依赖 |
| LLM 调用 | 复用 `AiService.chatCompletion`,已有计费/审计 | 不重造轮子 |
| 情绪/意图模型 | 二级:正则/词典 → 小模型(`gpt-4o-mini`)→ 必要时大模型 | 成本可控 |
| Cookie 加密 | AES-256-GCM + KMS-derived key | 与现有 secrets 一致 |
| 第三方参考 | playwright-extra(MIT)/snscrape(MIT)/social-analyzer(AGPL→不引入,只参考思路) | 严守协议,记入 LICENSE-NOTICES.md |

---

## 2. 模块详细设计

### 2.1 EngagementProvider 扩展

```ts
// engagement.interface.ts
export interface EngagementCapability {
  like: boolean
  unlike: boolean
  follow: boolean
  unfollow: boolean
  favorite: boolean
  unfavorite: boolean
  comment: boolean
  reply: boolean
  fetchUserPosts: boolean
  search: boolean
  engine: 'api' | 'automation' | 'hybrid'
}

export interface EngagementProvider {
  readonly platform: string
  readonly capability: EngagementCapability

  // 现有
  fetchUserPosts(...): Promise<PostsResponseVo>
  fetchPostComments(...): Promise<FetchPostCommentsResponse>
  fetchCommentReplies(...): Promise<FetchPostCommentsResponse>
  commentOnPost(...): Promise<PublishCommentResponse>
  replyToComment(...): Promise<PublishCommentResponse>

  // 新增(必填,但允许 throw NotSupportedError)
  likePost(accountId: string, postId: string): Promise<ActionResult>
  unlikePost(accountId: string, postId: string): Promise<ActionResult>
  followUser(accountId: string, targetUserId: string): Promise<ActionResult>
  unfollowUser(accountId: string, targetUserId: string): Promise<ActionResult>
  favoritePost(accountId: string, postId: string): Promise<ActionResult>
  unfavoritePost(accountId: string, postId: string): Promise<ActionResult>

  // 品牌监测用
  searchPosts?(keyword: string, opts: SearchOpts): Promise<PostsResponseVo>
}
```

### 2.2 Automation Engine

新建 `apps/aitoearn-automation`:

```
apps/aitoearn-automation/
├── src/
│   ├── main.ts                       # NestJS bootstrap
│   ├── workers/
│   │   ├── base.worker.ts            # 通用:登录态校验、人机延迟、错误恢复
│   │   ├── xhs.worker.ts             # 小红书
│   │   ├── douyin.worker.ts          # 抖音
│   │   ├── wxsph.worker.ts           # 视频号
│   │   ├── wxgzh.worker.ts           # 公众号
│   │   ├── kwai.worker.ts            # 快手
│   │   └── bilibili.worker.ts        # B站
│   ├── selectors/                    # 各平台 DOM 选择器,版本化
│   ├── browser/
│   │   ├── pool.service.ts           # BrowserContext 池,LRU 复用
│   │   ├── stealth.config.ts         # playwright-extra-plugin-stealth
│   │   └── proxy.service.ts          # 代理池
│   └── cookie-vault/
│       ├── vault.service.ts          # AES-256-GCM
│       └── refresh.scheduler.ts      # 定期校验 cookie
└── Dockerfile                        # mcr.microsoft.com/playwright:v1.x
```

**容错策略**
- 每个动作 ≤ 60s 超时,失败重试 ≤ 2 次,每次切换 UA + 代理
- DOM 选择器命中失败 → 写入 `selector_drift` 日志,触发 Slack 告警
- 连续 5 次同账号失败 → 自动暂停账号 12h(参考 `RateLimitGuardService`)

### 2.3 EngagementMiningService(评论挖掘)

```
入口: EngagementMiningConsumer  ◀── 由 fetchPostComments 异步触发
                  │
                  ▼
        ┌───────────────────┐
        │  Stage 1: Rules   │  词典: ["求链接","怎么买","how to buy",
        │  ~0.1ms / 评论    │         "where can i get","price",...]
        └─────────┬─────────┘
                  │ 命中
                  ▼
        ┌───────────────────┐
        │  Stage 2: LLM     │  AiService.chatCompletion
        │  小模型批量推理    │  prompt 输出 {intent, confidence}
        └─────────┬─────────┘
                  │ confidence ≥ 0.6
                  ▼
        ┌───────────────────┐
        │  EngagementMiningHit  │  落库 + 通知
        └───────────────────┘
```

**借鉴**:
- Rasa(Apache-2.0)的意图分类 schema 设计思路
- 词典初始化引用 `awesome-chinese-nlp` 中的中文情感词库(Apache-2.0)
- 英文走 VADER(MIT) → 但仅作为情绪打分,不作为意图分类

### 2.4 BrandMonitorService(品牌监测)

```
                ┌──────────────────────┐
   用户配置 ───►│  BrandMonitor (DB)   │
                └──────────┬───────────┘
                           │ scanInterval
                           ▼
              BullMQ Repeat Job: brand_scan
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  Provider.searchPosts (各平台)        ...  X/IG/YT/...
        │
        ▼
  去重 (hash(platform+postId))
        │
        ▼
  情绪打分(规则 + LLM)→ urgency
        │
        ▼
  BrandMention(DB) ─► 通知队列(已存在)
```

**搜索能力来源**:
- 公开 API: YouTube `search.list`、X `tweets/search/recent`、Pinterest search、TikTok Research API
- 无公开搜索 API: 走 Automation Engine 的 `searchPosts`(小红书/抖音/视频号)

### 2.5 速率与风控守卫

`RateLimitGuardService` 持有两层 Redis Bucket:
- 账号级:`rate:{accountId}:{action}` token bucket(默认 like=200/d)
- IP/代理级:`rate:proxy:{proxyId}` 防止单代理被批量封

中间件挂在所有 Engagement* Service 入口,触发限流抛 `AppException(ResponseCode.EngagementRateLimited)`。

---

## 3. 数据模型(Mongo)

新增 collection / 在已有 schema 上扩字段:

### 3.1 `engagementTask`(扩展 enum)
```ts
enum EngagementTaskType {
  LIKE, UNLIKE, FAVORITE, UNFAVORITE,
  FOLLOW, UNFOLLOW, COMMENT, REPLY,
  MINING, BRAND_SCAN
}
```

### 3.2 `engagementMiningHit`(新增)
```
{
  _id, userId, accountId, platform, postId, commentId,
  commentContent, intent, confidence, sentiment,
  language, recommendedReply?, status: NEW|HANDLED|IGNORED,
  createdAt, updatedAt
}
```

### 3.3 `brandMonitor`(新增)
```
{
  _id, userId, name, brandKeywords[], excludeKeywords[],
  platforms[], scanInterval, languages[],
  notificationChannels: { email?, webhook?, inApp },
  status: ACTIVE|PAUSED, lastScanAt, createdAt
}
```

### 3.4 `brandMention`(新增)
```
{
  _id, monitorId, platform, postId, postUrl, authorId,
  authorName, content, mediaUrls[], publishedAt,
  matchedKeywords[], sentiment(-1..1), urgency: LOW|MEDIUM|HIGH,
  uniqHash(unique index), notified: boolean,
  createdAt
}
```

### 3.5 `engagementCookieVault`(新增,Automation 用)
```
{
  _id, accountId, platform, encryptedCookie, fingerprint,
  proxyRef?, lastValidAt, status: VALID|EXPIRED|RISK,
  failureCount, createdAt
}
```

---

## 4. 关键流程时序

### 4.1 自动点赞(YouTube,API 引擎)
```
Client ─POST /engagement/post/like──► Controller
                                      │
                                      ▼
                            EngagementService.likePost
                                      │
                              RateLimitGuard.consume('like')
                                      │
                              YoutubeProvider.likePost()
                                      │
                              videos.rate(rating='like')
                                      │
                              return { success: true }
```

### 4.2 自动点赞(小红书,Automation 引擎)
```
Client ──► Controller ──► EngagementService.likePost
                                      │
                              capability.engine === 'automation'
                                      │
                              AutomationEngagementProvider
                                      │ NATS RPC
                                      ▼
                          aitoearn-automation/xhs.worker
                                      │
                              browserPool.acquire(accountId)
                                      │
                              cookieVault.attach()
                                      │
                              page.goto(noteUrl)
                              page.click('[data-like]')
                                      │
                              return { success, newLikeCount }
```

### 4.3 评论挖掘
```
fetchPostComments() ──► 写库 + 触发 EngagementMiningConsumer
                                      │
                              Stage1: regex/dictionary
                                      │ 命中?
                                      ▼
                              Stage2: AiService.chatCompletion
                                      │ confidence ≥ 0.6
                                      ▼
                              EngagementMiningHit 落库
                                      │
                              如果 intent=PURCHASE_INTENT
                                      │
                              ▶ 触发自动回复(可选)
                              ▶ 推送站内通知
```

### 4.4 品牌监测
```
BullMQ repeat job (brand_scan, every 30min)
              │
              ▼
      取所有 ACTIVE BrandMonitor
              │
              ▼
      for each (monitor, platform):
          provider.searchPosts(keyword)
              │
              ▼
          去重 (uniqHash)
              │
              ▼
          sentiment + urgency
              │
              ▼
          BrandMention 落库
              │
              ▼
          urgency=HIGH ─► notification
```

---

## 5. 借鉴的开源项目(全部 MIT/Apache-2.0)

| 项目 | 用途 | 许可证 | 引入方式 |
|------|------|--------|----------|
| [playwright](https://github.com/microsoft/playwright) | 自动化引擎 | Apache-2.0 | 直接依赖 |
| [playwright-extra](https://github.com/berstend/puppeteer-extra/tree/master/packages/playwright-extra) | Stealth 插件 | MIT | 直接依赖 |
| [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra) | 反检测 | MIT | 直接依赖 |
| [vader-sentiment](https://github.com/cjhutto/vaderSentiment) | 英文情绪打分 | MIT | 端口为 ts 实现 |
| [snownlp](https://github.com/isnowfy/snownlp) | 中文情绪/分词参考 | MIT | 仅参考词典 |
| [Rasa NLU](https://github.com/RasaHQ/rasa) | 意图分类 schema 思路 | Apache-2.0 | 仅参考设计 |
| [snscrape](https://github.com/JustAnotherArchivist/snscrape) | 无 API 平台搜索抓取思路 | MIT | 参考 + 自实现 |

> **不引入**:social-analyzer(AGPL)、Twint(已废弃)、任何 GPL/AGPL 代码。所有引用记入 `LICENSE-NOTICES.md`。

---

## 6. 灰度与回滚

- Feature flag `ENGAGE_ENGINE`:
  - `auto`(默认,新部署):平台有 API 走 API,否则走 Automation
  - `api_only`:只跑 API 引擎(Automation 整个关闭,作为兜底)
  - `legacy_plugin`:回退到现有插件协议(过渡期内保留)
- DB schema 全部新增,不动旧字段;旧 `interact/` 模块保留 6 个版本
- README 文案修改放到最后一个 PR,代码合并前先用真实跑通的视频回归

---

## 7. 风险

| 风险 | 缓解 |
|------|------|
| 平台风控加强导致 Automation 大面积失败 | 每平台独立熔断 + 自动降级到"只读+提醒" |
| Cookie 库泄漏 | KMS 加密 + IAM 限制 + 审计日志 |
| LLM 成本失控 | 默认小模型 + 词典预筛 + per-account 月度预算 |
| 法律/平台 ToS | Automation 仅在用户授权自家账号下运行,不做爬取他人私域;条款页加显式同意 |
