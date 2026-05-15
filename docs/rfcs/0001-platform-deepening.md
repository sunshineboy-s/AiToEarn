# RFC 0001: Deepening Platform Coverage

- **Status**: Draft
- **Author**: harry / contributors
- **Created**: 2026-05-15
- **Last updated**: 2026-05-15 (full-skeleton revision)
- **Discussion**: PR comment thread

## TL;DR

AiToEarn 列出 15 个 `AccountType`，但 **data-cube（数据分析）和 engagement（互动）模块在大多数平台上要么完全没注册，要么默默返回 0/空**。这是一个用户调用就会发现的信任问题。

本 RFC 一并合入的 PR 把骨架铺满：
- **15 个平台** 在 `DataCubeController.dataCubeMap` 都有注册
- **13 个平台** 在 `EngagementService.providerMap` 都有注册（视频号 / Google Business 不在 engagement 域）
- 凡是没真实 backend 的，统一走 `BaseUnsupportedDataCubeService` / `BaseUnsupportedEngagementProvider` 抽象基类——**调用不再 500/404，返回结构化空响应 + 一行 `logger.warn` 留 trace**

## 1. 现状盘点（合入本 PR 后）

> 调研日期：2026-05-15。范围：`apps/aitoearn-server/src/core/channel/`。

「真接入」= 真实 API 调用；「stub」= 走 Unsupported base 返回空 + warn；「—」= 不适用 / 未开放。

| 平台 (`AccountType`) | OAuth | Publish | data-cube | engagement |
|---|---|---|---|---|
| Bilibili | ✅ | ✅ | ✅ 真接入 (`getUserStat` / `getArcStat`) | ✅ 真接入 (`fetchUserPosts` / `getMetaPostDetail`) — 评论方法仍 stub |
| Douyin | ✅ | ✅ | 🟡 wrap 真接入但下层 `DouyinApiService` 仍是占位 | 🟡 stub |
| Xiaohongshu | ⚠️ stub | ✅ | 🟡 注册了但 `XhsDataService` 五个方法是 stub | 🟡 stub |
| Kwai (快手) | ✅ | ✅ | 🟡 stub（Open Platform scope 未开通）| 🟡 stub |
| WeChat 公众号 | ✅ | ✅ | ✅ 真接入 (`WxGzhDataService`) | 🟡 stub |
| WeChat 视频号 | ✅ | ✅ | 🟡 stub（无 Open API）| — |
| TikTok | ✅ | ✅ | ✅ 真接入 (`/v2/user/info/` + `/v2/video/list/`) | 🟡 stub（Research API 限制）|
| YouTube | ✅ | ✅ | ✅ Data API（缺 Analytics API 维度）| ✅ 真接入 |
| Instagram | ✅ | ✅ | ✅ Insights | ✅ 真接入 |
| Facebook | ✅ | ✅ | ✅ Insights | ✅ 真接入 |
| Threads | ✅ | ✅ | ✅ | ✅ 真接入 |
| Pinterest | ✅ | ✅ | ✅ | 🟡 stub（API v5 无评论端点）|
| LinkedIn | ✅ | ✅ | 🟡 stub（partner-program 待审）| 🟡 stub |
| Twitter / X | ✅ | ✅ | 🟡 stub（Free tier 限频）| 🟡 stub |
| Google Business | ✅ | ✅ | 🟡 stub（POI 指标待映射 RFC）| — |

每个 stub 在源代码里都标注了 `unsupportedReason`，方便日志检索：

```
xhs.fetchPostComments.unsupported  reason=Xiaohongshu has no Open Platform; cookie/browser fallback pending RFC
```

## 2. 目标

按用户视角，AiToEarn 的「数据分析」和「互动」应该在 14+ 个创作平台上都能用。Google Business 是 POI 业务，模型不同，本 RFC 不强求对齐。

具体到能力上：
- **data-cube**：account / arc 两层，粉丝/作品数/曝光/点赞/评论/分享/收藏 至少返回真实数（增量列表 P2）
- **engagement**：评论拉取 + 评论挖掘（识别"求链接""怎么买"）+ AI 回复，至少在头部 4 个平台（XHS / 抖音 / B站 / TikTok）能跑

## 3. 非目标

- ❌ Google NotebookLM 集成（不可控的浏览器自动化 + Google ToS）
- ❌ WSJ/NYT/FT 的 paywall bypass（合规雷）
- ❌ TikTok Research API（需要学术机构资格）
- ❌ YouTube 私有 API 抓取（封号风险）
- ❌ 闲鱼（业务形态不匹配，详见 §5）

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

### 4.3 待补研究

- 微信视频号：是否有半官方 API？目前仅有 Electron 扫码登录态。
- LinkedIn：UGC API + Analytics API 文档是否覆盖 data-cube 五项指标。

## 5. 非目标：闲鱼

闲鱼**不在**本 RFC 范围内。原因：

1. **业务形态不匹配**：闲鱼是二手交易 + IM 聊单，AiToEarn 是创作分发 + 粉丝增长 + CPS/CPE/CPM 结算。两套领域模型几乎不重合。
2. **零官方 API**：所有开源方案都是浏览器/抓包自动化，账号封禁率高，反爬猫鼠游戏，维护成本远高于其他平台。
3. **如果未来要做**：建议拆出独立产品线 `AiToEarn for Marketplace`，不要塞进现有 monorepo。

## 6. 路线图

### 6.1 ✅ P0-A 完成（本 PR）

骨架铺满，把"用户调用就 500"的洞全部堵住：

- [x] 15 个平台全部在 `DataCubeController.dataCubeMap` 注册
- [x] 13 个创作平台全部在 `EngagementService.providerMap` 注册
- [x] 引入 `BaseUnsupportedDataCubeService` / `BaseUnsupportedEngagementProvider` 抽象基类，统一 stub 行为
- [x] B站 engagement `fetchUserPosts` 真接入（`archive/viewlist` + `arc/stat` 富化）
- [x] 抖音 / TikTok / 小红书 接入 data-cube 路由
- [x] 修复 `KwaiDataService` 之前订阅了错误事件（`AccountType.Xhs`）

### 6.2 🔲 P0-B 把 stub 替换成真接入（按 ROI）

每条都是独立 PR：

1. **抖音 API 真接入**：替换 `DouyinApiService.getUserStat / getArcStat / getArcIncStat` 的占位为开放平台真实 HTTP 调用
2. **YouTube Analytics API**：升级 `YoutubeDataService`，补 watchTime / 留存 / 受众画像
3. **抖音 engagement 评论**：开放平台 `item/comment/list` + `item/comment/reply`
4. **B站 engagement 评论**：等 Open Platform 开放评论 scope；也可走 cookie-mode 兜底（独立 RFC）
5. **小红书 cookie/Playwright RFC**：评审兜底方案的法务和封号风险

### 6.3 P1 抽通用底座

6. **抽 `PlatformAnalyticsAdapter` 接口**——把 `data.base.ts` 的 5 个方法 + 时序数据 + 受众画像 + 内容榜单 统一为一个 base
7. **抽 `BrowserAutomationModule`**——独立成 `apps/aitoearn-browser-worker`（Playwright + Chromium 镜像），给 XHS / 视频号 / 抖音的兜底通道用

### 6.4 P2 升级现有平台的分析深度

8. Instagram Audience Insights（性别/年龄/地区分布、活跃时段）
9. B站用户增量数据（按日，B 站官方有 `data-online` 端点）

### 6.5 P3 待决策

10. 快手 / LinkedIn data-cube — 等 scope/partner 审批
11. TikTok 增量数据 — 需评估 Research API 申请成本
12. 闲鱼 — 见 §5，原则上不做

## 7. 设计准则（写在 base 类里的"宪法"）

每个 adapter / provider 必须遵守：

1. **真假数分离**：真实 API 返回放在 method body；占位实现走 `BaseUnsupported*`，**禁止默默返回 0**
2. **失败可降级**：API 调用失败必须 `throw PlatformAuthExpired / PlatformRateLimited`，**不允许 `return null` 让上层猜**
3. **指标命名统一**：`fensNum / arcNum / playNum / likeNum / commentNum / shareNum / collectNum`，平台之间字段不允许漂移
4. **OnEvent 收口**：账号创建即 `accountPortraitReport`，禁止业务代码自己再去 trigger 一次
5. **可观测性**：每次外部 API 调用必须打 `path / accountId / latency / errorCode` 四元组；每次 stub 命中必须打 `path / reason`

## 8. 验收标准（本 PR）

- [x] `GET /channel/dataCube/accountDataCube/{accountId}` 在 15 个 AccountType 上都不再因 `DataCubeAccountTypeNotSupported` 直接拒绝
- [x] engagement controller 在 13 个创作平台 AccountType 上都不再 `provider not found` 500
- [x] 所有 stub 命中都产生一条结构化 warn 日志，便于 ops 检索
- [x] `pnpm nx build aitoearn-server` 通过
- [x] `pnpm exec eslint apps/aitoearn-server/src/core/channel/{data-cube,engagement}/` 不引入新 error（仅 4 条 pre-existing warning）
- [x] B站 engagement 在 `fetchUserPosts` / `getMetaPostDetail` 上返回真实数据
- [x] 不破坏既有的 facebook / instagram / threads / youtube / pinterest / wxGzh 行为

## 9. 参考资料

- [TikTok Display API: User Info](https://developers.tiktok.com/doc/display-api-user-info/)
- [TikTok Display API: Video List](https://developers.tiktok.com/doc/display-api-video-list/)
- [抖音开放平台 - 视频数据](https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/data-permission/video-data/external-video-data)
- [Bilibili - 创作中心 API](https://github.com/SocialSisterYi/bilibili-API-collect)
- [Instagram Graph API - Insights](https://developers.facebook.com/docs/instagram-platform/insights)
- [YouTube Analytics & Reporting API](https://developers.google.com/youtube/analytics)
- [LinkedIn UGC Posts & socialActions](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api)
- [Pinterest API v5](https://developers.pinterest.com/docs/api/v5/)
- [Google Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rest)
