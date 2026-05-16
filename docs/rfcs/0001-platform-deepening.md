# RFC 0001: Deepening Platform Coverage (Bilibili / Douyin / XHS / TikTok / YouTube / Instagram)

- **Status**: Draft
- **Author**: harry / contributors
- **Created**: 2026-05-15
- **Discussion**: open as PR comment thread

## TL;DR

AiToEarn 列出 14+ 个内容渠道，但 **data-cube（数据分析）和 engagement（互动）模块在很多平台上是空架子或返回 0**。本 RFC 把当前状态、目标差距、可借鉴的开源项目和分阶段路线图写下来，让社区贡献者明确从哪里下手。

随本 RFC 一起合入的 PR 修复了最浅的一个洞：把 **抖音 / TikTok / 小红书** 接到 `data-cube`，让 `/channel/dataCube/*` 在这三个平台上不再 404。详见下方 [P0 立即落地](#p0-立即落地）。

## 1. 现状盘点

> 调研日期：2026-05-15。范围：`apps/aitoearn-server/src/core/channel/`。

| 平台 | OAuth | Publish | data-cube | engagement | 工作链路完整度 |
|---|---|---|---|---|---|
| Bilibili | ✅ | ✅ | ✅ 真接入 (`getUserStat / getArcStat`) | ❌ 无 provider | 7/10 |
| Douyin | ✅ | ✅ | ⚠️ 已挂上 controller，但 `DouyinApiService.getUserStat` 仍是占位 | ❌ | 6/10 |
| Xiaohongshu | ⚠️ stub | ✅ | ⚠️ 已挂上 controller，但 service 五个方法仍是 stub | ❌ | 4/10 |
| Kwai (快手) | ✅ | ✅ | ❌ data-cube service 不存在 | ❌ | 5/10 |
| WeChat 公众号 | ✅ | ✅ | ✅ | ❌ | 7/10 |
| WeChat Channels (视频号) | ✅ | ✅ | ❌ | ❌ | 5/10 |
| TikTok | ✅ | ✅ | ✅ 已挂上 controller，新增真实 API 调用 | ❌ | 7/10 |
| YouTube | ✅ | ✅ | ✅ Data API（**缺 Analytics API**） | ✅ provider | 8/10 |
| Instagram | ✅ | ✅ | ✅ Insights | ✅ provider | 8/10 |
| Facebook | ✅ | ✅ | ✅ | ✅ provider | 7/10 |
| Threads | ✅ | ✅ | ✅ | ✅ provider | 7/10 |
| Pinterest | ✅ | ✅ | ✅ | ❌ | 6/10 |
| LinkedIn | ✅ | ✅ | ❌ | ❌ | 5/10 |
| **闲鱼** | ❌ | ❌ | ❌ | ❌ | **0/10（完全没接入）** |

证据可在以下文件直接读到：
- `data-cube/data-cube.controller.ts` — `dataCubeMap` 现在挂的平台数（合入此 PR 前为 3，合入后为 5）
- `data-cube/xhs-data.service.ts` — 5 个方法返回硬编码 0
- `libs/douyin/douyin-api.service.ts` — `getUserStat / getArcStat / getArcIncStat` 是 stub
- `engagement/providers/` — 仅有 `facebook / instagram / threads / youtube`

## 2. 目标

按用户视角，AiToEarn 的"数据分析"和"互动"应该在这些平台上都能用：

> **B站、抖音、小红书、快手、视频号、TikTok、YouTube、Instagram、Facebook、Threads、Pinterest、LinkedIn**

> **闲鱼**：本 RFC 不规划。原因见 [§5](#5-非目标-闲鱼)。

具体到能力上：
- **data-cube account / arc level**：粉丝/作品数/曝光/点赞/评论/分享/收藏 至少返回真实数（增量列表 P2）
- **engagement**：评论拉取 + 评论挖掘（识别"求链接""怎么买"）+ AI 回复，至少在头部 4 个平台（XHS / 抖音 / B站 / TikTok）能跑

## 3. 非目标

- **不做** Google NotebookLM 集成（不可控的浏览器自动化 + Google ToS）
- **不做** WSJ/NYT/FT 的 paywall bypass（合规雷）
- **不做** TikTok Research API（需要学术机构资格）
- **不做** YouTube 私有 API 抓取（封号风险）

## 4. 可借鉴的开源项目

> ⚠️ **License 与法务**：以下项目仅做"接口形态/签名算法/反爬思路"参考。直接复制 GPL/AGPL/未声明 license 的代码会产生合规问题。我们重写为 TS，并在每个 adapter 顶部用 attribution 注释指明灵感来源。

### 4.1 多平台覆盖

| 项目 | License | 覆盖 | 借鉴点 |
|---|---|---|---|
| `NanmiCoder/MediaCrawler` | 非商用 | XHS·抖音·快手·B站·微博·贴吧·知乎 内容+评论 | **思路参考**：浏览器登录态 + 反爬维护策略；不直接复制代码 |
| `dreammis/social-auto-upload` | MIT | 抖音·视频号·B站·小红书·快手·TikTok 自动发布 | Playwright 控制流可用作 fallback 发布通道（OPEN API 不开放的平台） |
| `Johnserf-Seed/f2` | MIT | 抖音·TikTok·B站 异步下载 | **签名算法参考**（`X-Bogus / a_bogus`） |

### 4.2 单平台

| 平台 | 项目 | 抄什么 |
|---|---|---|
| 小红书 | `ReaJason/xhs` | 私有 API 封装思路（笔记/搜索/评论） |
| YouTube | 官方 [YouTube Analytics API](https://developers.google.com/youtube/analytics) | 当前只接了 Data API，Analytics API 提供按地区/设备/留存等深度维度 |
| Instagram | `adw0rd/instagrapi` | 私有 API 路径，覆盖 reels insights / 私信 / stories |
| TikTok | `kairi003/TiktokAutoUploader` | 浏览器自动化批量上传作为 fallback |

### 4.3 RFC 编写中需补的研究

- 微信视频号：是否有半官方 API？目前仅有 Electron 扫码登录态。
- LinkedIn：UGC API + Analytics API 文档是否覆盖 data-cube 五项指标。

## 5. 非目标：闲鱼

闲鱼**不在**本 RFC 范围内。原因：

1. **业务形态不匹配**：闲鱼是二手交易 + IM 聊单，AiToEarn 是创作分发 + 粉丝增长 + CPS/CPE/CPM 结算。两套领域模型几乎不重合。
2. **零官方 API**：所有开源方案都是浏览器/抓包自动化，账号封禁率高，反爬猫鼠游戏，维护成本远高于其他平台。
3. **如果未来要做**：建议拆出独立产品线 `AiToEarn for Marketplace`，不要塞进现有 monorepo。

## 6. 路线图

### 6.1 P0 立即落地

> **本 RFC 一起合入的 PR 已完成下列前两项**。第三项（抖音 API 真接入）和第四项（engagement provider）需要单独 PR，因为涉及外部 API 与 cookie 抓取策略。

1. ✅ **抖音 / TikTok 接入 data-cube**
   - 新建 `douyin-data.service.ts`（包了 `DouyinService.getUserStat / getArcStat`）
   - 新建 `tiktok-data.service.ts`（用 `/v2/user/info/` + `/v2/video/list/`）
   - `data-cube.controller.ts` 的 `dataCubeMap` 注册新 key
   - `data-cube.module.ts` 引入 `DouyinModule / TiktokModule` 并 provide 新 service
2. ✅ **小红书 stub 显式接入 data-cube**
   - 把已有 `XhsDataService` 加入 `data-cube.module.ts` 的 providers
   - `dataCubeMap.set(AccountType.Xhs, xhsDataService)` 让路由不再 404
   - 行为依然是返回 0（service 现状），但通过 logger 留信号；真接入见下一条
3. 🔲 **抖音 API 真接入**：把 `DouyinApiService.getUserStat / getArcStat / getArcIncStat` 的占位实现替换为对应 [抖音开放平台数据 API](https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission/account-data) 的真实调用
4. 🔲 **小红书 API 真接入**：XHS 没有开放平台，需独立 RFC 评审 cookie 抓取或浏览器自动化方案
5. 🔲 **engagement provider 补全（依赖各平台开放 API 实际能力）**

   合入 PR #19 之后调研发现，"engagement provider 补 4 个平台"这个原计划是**做不到**的——不是工程问题，是平台 API 决策问题。重新分类如下：

   | 平台 | comment list | reply | top-level comment | 可做？ |
   |---|---|---|---|---|
   | **抖音** | ✅ `/api/douyin/v1/comment/list/` | ✅ `/comment/reply/` | ❌ Open API 禁止第三方代发顶级评论 | **能做：list + reply** ✅ |
   | TikTok | ❌ Display API 无 comment 端点 | ❌ | ❌ | 需要 Research API（学术资质）→ 不做 |
   | B站 | ❌ Open API 无 | ❌ | ❌ | 只有 web 私有 API，封号风险 → 不做 |
   | XHS | ❌ 无开放平台 | ❌ | ❌ | 同 §6.1 #4 等浏览器自动化方案 → 后续 RFC |

   - ✅ **抖音 engagement provider 已实现**（PR #20）：`fetchPostComments / fetchCommentReplies / replyToComment / commentOnPost(返回 not-supported)`。同时把 `commentId` 编码为 `${itemId}:${commentId}` 复合键（Douyin reply API 需要 `item_id + comment_id`，但 `EngagementProvider` 接口只透传 `commentId`）。
   - 🔲 B站 / TikTok / XHS engagement：**不在 P0 范围**，等开放平台开放对应能力或浏览器自动化方案落地（见 P1 #6 BrowserAutomationModule）。

### 6.2 P1 抽通用底座

5. **抽 `PlatformAnalyticsAdapter` 接口**
   - 把 `data.base.ts` 的 5 个方法 + Analytics 时序数据 + 受众画像 + 内容榜单 统一为一个 base
   - 每个平台填自己的实现，避免一个平台一份"抄过来改改"
6. **抽 `BrowserAutomationModule`**
   - 独立成 `apps/aitoearn-browser-worker`（Playwright + Chromium 镜像）
   - 给 XHS / 视频号 / 抖音的兜底通道用

### 6.3 P2 升级现有平台的分析深度

7. **YouTube 接 Analytics API**
   - watchTime / averageViewPercentage / subscribersGained / 按地区/按设备
8. **Instagram 接 Audience Insights**
   - 性别/年龄/地区分布、活跃时段
9. **B 站 用户增量数据 (按日)**
   - 当前 `getAccountDataBulk` 返回 `[]`，B 站官方有 `data-online` 端点

### 6.4 P3 待决策

10. **快手 / 视频号 / LinkedIn data-cube** — 需评审 API 可用性
11. **TikTok 增量数据** — 需评估 Research API 申请成本
12. **闲鱼** — 见 §5，原则上不做

## 7. 设计准则（写在 base 类里的"宪法"）

每个 `PlatformAnalyticsAdapter` 必须遵守：

1. **真假数分离**：真实 API 返回放在 method body；占位实现至少用 `this.logger.warn` 标明，禁止默默返回 0
2. **失败可降级**：API 调用失败必须 `throw PlatformAuthExpired / PlatformRateLimited`，不允许 `return null` 让上层猜
3. **指标命名统一**：`fensNum / arcNum / playNum / likeNum / commentNum / shareNum / collectNum`，禁止平台之间字段不一致（这是当前一大坑）
4. **OnEvent 收口**：账号创建即 `accountPortraitReport`，禁止业务代码自己再去 trigger 一次
5. **可观测性**：每次外部 API 调用必须打 `path / accountId / latency / errorCode` 四元组到 logger

## 8. 验收标准（P0）

- [x] PR #10：`GET /channel/dataCube/accountDataCube/{accountId}` 在抖音 / TikTok / XHS 账号上不再 404
- [x] PR #19：抖音 data-cube 在该账号确实有数据时返回非零字段
- [x] PR #20：抖音 engagement provider 接入；可拉评论列表 / 拉评论回复 / 回复评论
- [ ] `pnpm nx build aitoearn-server` 通过（每个 PR 必须满足）
- [ ] `pnpm nx lint aitoearn-server` 不引入新 error
- [ ] 不破坏现有 bilibili / youtube / instagram / threads / facebook 的行为

## 9. 参考资料

- [TikTok Display API: User Info](https://developers.tiktok.com/doc/display-api-user-info/)
- [TikTok Display API: Video List](https://developers.tiktok.com/doc/display-api-video-list/)
- [抖音开放平台 - 视频数据](https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission/video-data/external-video-data)
- [Bilibili - 创作中心 API](https://github.com/SocialSisterYi/bilibili-API-collect)
- [Instagram Graph API - Insights](https://developers.facebook.com/docs/instagram-platform/insights)
- [YouTube Analytics & Reporting API](https://developers.google.com/youtube/analytics)
