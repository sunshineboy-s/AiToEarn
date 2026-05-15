# Engage 内置化 — 实施任务清单

> 每个任务都按"可独立 PR"粒度切分,**串行依赖**用 `→` 标明。

## Phase 0:基线与脚手架(1 个 PR)

- [x] **T0.1** `EngagementTaskType` 扩展(LIKE/UNLIKE/FAVORITE/UNFAVORITE/FOLLOW/UNFOLLOW/MINING/BRAND_SCAN)
- [x] **T0.2** 4 个新 schema:`engagement-mining-hit`、`brand-monitor`、`brand-mention`、`engagement-cookie-vault`
- [x] **T0.3** 4 个新 repository,挂到 `MongodbModule.forFeature`
- [x] **T0.4** ResponseCode 扩展(15040..15046) + 三语 i18n
- [x] **T0.5** `LICENSE-NOTICES.md`(在 PoC 阶段已新增)

**验收**:`pnpm nx build aitoearn-server` 通过 ✅。

---

## Phase 1:统一互动接口与能力矩阵(1 个 PR)→ 依赖 T0

- [x] **T1.1** `engagement.interface.ts`:补全 like/unlike/follow/unfollow/favorite/unfavorite + `capability` 字段
- [x] **T1.2** 4 个 provider 实现新方法;不支持的抛 `EngagementNotSupportedError`
- [x] **T1.3** `EngagementService` 路由方法 + `getCapabilities()` + 异常翻译
- [x] **T1.4** Controller 暴露 6 个新动作 + `GET /channel/engagement/capabilities`
- [x] **T1.5** `LikePostRequestSchema` enum 扩成完整 `PlatformEnumSchema`
- [ ] **T1.6** 单元测试覆盖路由 + 不支持平台兜底(后续 PR)

> Update 2026-05-15 PM: first 20 unit tests in (rate guard, intent rules,
> metrics counter, proxy stickiness). Route-level e2e still TBD.

**验收**:Swagger 显示完整能力,Capabilities 返回正确矩阵 ✅(build 通过,e2e 待 sandbox 外验证)

---

## Phase 2:Provider 扩容(API 引擎)→ 依赖 T1

### PR-2A:海外平台
- [x] **T2.1** YoutubeProvider.likePost/unlikePost(`videos.rate`)— 已在 Phase 1 一并完成
- [ ] **T2.2** XEngagementProvider(twitter)
- [ ] **T2.3** PinterestEngagementProvider
- [ ] **T2.4** LinkedinEngagementProvider
- [ ] **T2.5** TiktokEngagementProvider

### PR-2B:中文系平台 API 部分
- [ ] **T2.6** WxGzhEngagementProvider(替换空桩)
- [ ] **T2.7** BilibiliEngagementProvider

---

## Phase 3:Automation Engine

### PR-3A:`aitoearn-automation` 应用脚手架
- [x] **T3.1** Nx app + Dockerfile (PoC)
- [x] **T3.2** playwright-extra + stealth(带回退)
- [x] **T3.3** BrowserPoolService LRU
- [x] **T3.4** CookieVault AES-256-GCM(2026-05-15: HKDF-derived key + 信封式负载;plain 兼容)
- [x] **T3.5** ProxyService(2026-05-15: 静态池 + 账号粘性 done; 健康检查 follow-up)
- [x] **T3.6** RPC 入口:**BullMQ `engagement_automation_action` 队列已落地**;NATS 后续切换

### PR-3B:小红书 Worker
- [x] **T3.7** xhs.worker:like/reply/search **+ unlike/favorite/unfavorite/follow/unfollow**
- [x] **T3.8** selectors/xhs.ts 版本化 + ASCII-escape
- [ ] **T3.9** Cookie 同步流程
- [ ] **T3.10** DOM drift / 风控告警

### PR-3C:其余中文平台 Worker
- [ ] **T3.11..14** douyin/wxsph/kwai

**验收**:不安装插件,通过 server `POST /channel/engagement/post/like {platform:'xhs', ...}` 触发 BullMQ → automation worker → 真实点赞;后端日志 + 真实账号验证(待真机测)。

---

## Phase 4:速率与风控(1 个 PR)→ 依赖 Phase 1

- [x] **T4.1** RateLimitGuardService:Redis Bucket(原子 INCR + EXPIRE Lua)
- [x] **T4.2** 默认配额表(per-user override 后续接入)
- [x] **T4.3** Circuit breaker:5 次失败 / 1h → 12h 冷却
- [x] **T4.4** Prometheus `engage_action_total{platform,action,result}` _(2026-05-15: prom-client Counter wired into runAction; success/failure/not_supported/rate_limited 四类标签)_
- [ ] **T4.5** k6 压测脚本

---

## Phase 5:评论挖掘(1 个 PR)→ 依赖 Phase 1

- [x] **T5.1** `EngagementMiningService.classify`:Stage1 规则 + Stage2 LLM
- [x] **T5.2** EngagementMiningConsumer(BullMQ)
- [x] **T5.3** REST `/channel/engagement/mining/hits`(GET / PATCH / 同步 classify)
- [x] **T5.4** 与 ReplyToCommentsByAI 联动:命中 `recommendedReply` 自动写回 _(2026-05-15: 通过 BullMQ EngagementMiningJobData.autoReply 标志由 consumer 触发,ModuleRef 解决循环依赖)_
- [x] **T5.5** 词典在 `intent-rules.ts`,中英文双语,LICENSE-NOTICES 已记

---

## Phase 6:品牌监测(1 个 PR)→ 依赖 Phase 2/3 search

- [x] **T6.1** BrandMonitorService:CRUD + repeat job
- [x] **T6.2** BrandMonitorScanConsumer(对每个 monitor 调 provider.searchPosts)
- [x] **T6.3** uniqHash 去重 + sentiment + urgency
- [ ] **T6.4** 通知集成(NotificationData union 扩展后接入,目前 high-urgency 仅落库 + log)
- [x] **T6.5** Controller `POST /brand-monitor` 全套 + `/:id/mentions`

---

## Phase 7:前端整合 → 依赖 Phase 1+5+6

- [ ] T7.x 前端打通(M5)

---

## Phase 8:文档与发布

- [ ] T8.x 三语 README 调整 + DOCKER 文档(M5)

---

## 进度速记

- **2026-05-14**:Phase 3B PoC 落地、5 个 review 阻断项修复
- **2026-05-15(上午)**:Phase 0 + 1 + 3A + 4 + 5 + 6 后端骨架全部落地;build 通过
- **2026-05-15(下午,#1)**:Cookie Vault AES-256-GCM(T3.4),Brand mention 通知接入(T6.4),首批单测(T1.6 - 12 tests)
- **2026-05-15(下午,#2)**:Prometheus `engage_action_total` 指标(T4.4),mining → ReplyToCommentsByAI 自动联动(T5.4),Proxy 服务 + 账号粘性代理(T3.5);新增 8 个单测(共 20 tests),build + vitest 全绿
