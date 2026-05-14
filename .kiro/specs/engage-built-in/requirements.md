# Engage 内置化(无插件)需求规格

> 目标:把 README 里 Engage Agent 承诺的"自动点赞/收藏/关注、AI 智能回复、评论挖掘、品牌监测"做成**后端内置能力**,用户无需安装任何浏览器扩展就能跑起来。

## 1. 范围与非目标

### 1.1 范围
- 互动操作(点赞、关注、收藏、评论/回复)
- AI 智能回复(已有,需扩展)
- 评论挖掘(意图识别 + 高转化信号)
- 品牌监测(关键词、提及、热点跟踪)
- 覆盖平台:Facebook、Instagram、Threads、YouTube、X(Twitter)、TikTok、LinkedIn、Pinterest、Bilibili、Douyin、小红书、视频号、微信公众号、快手

### 1.2 非目标
- 不在用户浏览器内运行任何扩展程序
- 不替换现有 Publish(发布)管线
- 不引入需要用户自行安装 Chrome 的本地依赖

---

## 2. 用户故事

- **U1** 作为 OPC 创作者,我希望 AiToEarn 能自动给我账号下评论里"求链接""怎么购买"的用户回复,**而不需要我装浏览器插件**。
- **U2** 作为品牌运营,我希望输入若干品牌关键词后,系统能跨平台抓到所有提及并按情绪/热度排序,**自动通知我**。
- **U3** 作为社媒经理,我希望 AI 帮我批量点赞、关注、收藏目标账号的最新作品,**支持速率限制和黑名单**。
- **U4** 作为开发者,我希望新增一个平台时,只需实现一个 `EngagementProvider` 子类,**不需要改前端插件**。

---

## 3. 功能需求(EARS)

### FR-1 互动统一接口
- **FR-1.1** WHEN 用户调用 `/channel/engagement/post/like` THE SYSTEM SHALL 根据 `platform` 路由到对应 provider,执行点赞并返回 `{success, providerId?}`。
- **FR-1.2** THE SYSTEM SHALL 暴露统一的:`likePost / unlikePost / followUser / unfollowUser / favoritePost / unfavoritePost / commentOnPost / replyToComment` 八个接口。
- **FR-1.3** IF 某平台不支持某操作 THEN THE SYSTEM SHALL 返回 HTTP 200 + `{success: false, code: "PLATFORM_CAPABILITY_UNAVAILABLE"}`,并暴露 `GET /channel/engagement/capabilities` 让前端预先查询能力矩阵。

### FR-2 双引擎执行
- **FR-2.1** WHEN 平台提供官方开放 API(YouTube / X / Pinterest / FB Page / LinkedIn / 微信公众号)THE SYSTEM SHALL 优先走 **API Engine**(基于现有 `EngagementProvider`)。
- **FR-2.2** WHEN 平台不提供该操作的官方 API(小红书 / 抖音 / 视频号 / 快手 / Bilibili / IG-Threads-的 like)THE SYSTEM SHALL 通过 **Automation Engine**(Playwright Worker + Cookie 池)执行,用户毫无感知。
- **FR-2.3** Automation Engine 必须运行在**服务端**(独立的 `aitoearn-automation` Worker 服务),不下发到用户机器。
- **FR-2.4** Automation Engine 必须支持代理池、UA 池、人机交互延迟,降低风控命中。

### FR-3 AI 智能回复(扩展现有能力)
- **FR-3.1** THE SYSTEM SHALL 复用现有 `EngagementService.batchGenReplyContent` 与 `ReplyToCommentsByAI` 任务流。
- **FR-3.2** WHEN 用户配置 `replyPersona`(品牌人设)THE SYSTEM SHALL 把人设注入 system prompt。
- **FR-3.3** THE SYSTEM SHALL 支持 `safetyFilter`:基于关键词与 LLM 双层过滤,屏蔽政治/低俗/竞品负面内容,失败的回复转人工审核。

### FR-4 评论挖掘
- **FR-4.1** WHEN 拉到一条评论 THE SYSTEM SHALL 执行**意图分类**(`PURCHASE_INTENT / LINK_REQUEST / COMPLAINT / QUESTION / PRAISE / SPAM / OTHER`)。
- **FR-4.2** 意图分类必须二级落地:① 正则/词典快速预筛(零成本,~0.1ms);② 命中后用 LLM(`AiService.chatCompletion`)做精分类与置信度打分。
- **FR-4.3** WHEN 意图为 `PURCHASE_INTENT` 或 `LINK_REQUEST` THE SYSTEM SHALL 在 `EngagementMiningHit` 集合落库,并(可选)触发 Webhook / 站内通知。
- **FR-4.4** THE SYSTEM SHALL 暴露 `POST /channel/engagement/mining/hits` 列表查询、按平台/账号/意图/时间筛选。

### FR-5 品牌监测
- **FR-5.1** 用户 SHALL 创建 `BrandMonitor` 任务:输入 `brandKeywords[]`、`platforms[]`、`scanInterval`(默认 30min)、`languages[]`。
- **FR-5.2** 后端 SHALL 用定时器(BullMQ repeat job)按 `scanInterval` 拉取每个平台的搜索/标签/Mention 流。
- **FR-5.3** 命中数据 SHALL 经过去重(`hash(platform + postId)`)后入 `BrandMention` 集合,字段含 `sentiment` (LLM 打分) 与 `urgency`(规则:含 "差评/退款/不行/坏" 等关键词 + sentiment<-0.5 提级为 HIGH)。
- **FR-5.4** WHEN urgency=HIGH 且开启了通知 THE SYSTEM SHALL 推送邮件/Webhook/站内消息(走现有 `notification` 队列)。

### FR-6 任务调度与速率
- **FR-6.1** THE SYSTEM SHALL 在 `EngagementTask` 之上新增 `EngagementTaskType.LIKE / FAVORITE / FOLLOW / MINING / BRAND_SCAN`,沿用现有 `engagement_task_distribution` + `engagement_reply_to_comment_task` 队列模式。
- **FR-6.2** WHILE 同账号执行批量互动 THE SYSTEM SHALL 强制最小间隔(默认 3-15s 抖动)与每日上限(可配置,默认 like=200/follow=50/favorite=100)。
- **FR-6.3** IF 触发平台 risk-control THEN THE SYSTEM SHALL 暂停该账号 12h 并告警。

### FR-7 兼容与回滚
- **FR-7.1** 现有 `usePluginStore` 与浏览器插件路径 SHALL 不删除,但状态默认置为 `disabled`,通过 feature flag `ENGAGE_ENGINE=builtin|plugin|auto` 切换,允许灰度。
- **FR-7.2** README 三语版本 SHALL 在第二阶段统一删除"浏览器插件"措辞,改为"开箱即用"。

---

## 4. 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 单条互动指令端到端 P95 ≤ 4s(API Engine);≤ 25s(Automation) |
| 并发 | Automation Worker 默认 5 并发/进程,可水平扩展 |
| 安全 | Cookie 入库前 AES-256 加密;LLM 调用走现有 `AiService`(已含计费/审计) |
| 合规 | 引入第三方开源参考时,必须在 LICENSE-NOTICES.md 列出原始项目与协议;**禁止直接复制 GPL 代码** |
| 可观测 | 沿用现有 pino + queue-metrics;新增 `engage_action_total{platform,action,result}` Prometheus 指标 |
| 成本 | 评论挖掘的二级 LLM 分类必须可关闭(只用规则);默认模型走"小模型优先" |

---

## 5. 验收标准

- [ ] 不安装任何浏览器插件,Docker `docker compose up -d` 后能完成:
  - [ ] 在 YouTube 视频上自动点赞 / 取消点赞
  - [ ] 在小红书笔记下自动回复 5 条评论(走 Automation)
  - [ ] 创建一个"AiToEarn"品牌监测任务,30 分钟内拉到至少 1 条提及
  - [ ] 在评论列表里看到带 `intent: PURCHASE_INTENT` 的高亮项
- [ ] `GET /channel/engagement/capabilities` 返回完整能力矩阵
- [ ] 三语 README 中 Engage 章节不再出现"浏览器插件 / browser extension / ブラウザ拡張"
- [ ] CI 通过:单元测试 ≥ 70% 覆盖,e2e 至少覆盖 1 个 API 引擎 + 1 个 Automation 引擎
