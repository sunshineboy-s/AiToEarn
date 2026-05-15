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

**验收**:Swagger 显示完整能力,Capabilities 返回正确矩阵 ✅(build 通过,e2e 待 sandbox 外验证)

---

## Phase 2:Provider 扩容(API 引擎)→ 依赖 T1

### PR-2A:海外平台
- [x] **T2.1** YoutubeProvider.likePost/unlikePost(`videos.rate`)— 已在 Phase 1 一并完成
- [x] **T2.2** XEngagementProvider(twitter):like/unlike/follow/comment(=reply via tweet)
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
- [ ] **T3.4** CookieVault AES-256-GCM(PoC 用 file/env)
- [ ] **T3.5** ProxyService
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
- [ ] **T4.4** Prometheus `engage_action_total{platform,action,result}`
- [ ] **T4.5** k6 压测脚本

---

## Phase 5:评论挖掘(1 个 PR)→ 依赖 Phase 1

- [x] **T5.1** `EngagementMiningService.classify`:Stage1 规则 + Stage2 LLM
- [x] **T5.2** EngagementMiningConsumer(BullMQ)
- [x] **T5.3** REST `/channel/engagement/mining/hits`(GET / PATCH / 同步 classify)
- [ ] **T5.4** 与 ReplyToCommentsByAI 联动:命中 `recommendedReply` 自动写回(下一个 PR)
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
- **2026-05-15**:**Phase 0 + 1 + 3A + 4 + 5 + 6 全部落地**;build 通过;`xhs` 走 automation engine 的 like/unlike/favorite/unfavorite/follow/unfollow/comment/reply/search 全链路打通(等真机风控测)
- **2026-05-15(2)**:Twitter/X engagement provider 落地(T2.2);docker-compose 加入 `aitoearn-automation` 服务;DOCKER_DEPLOYMENT 中英文增加 Engage 自动化服务章节
