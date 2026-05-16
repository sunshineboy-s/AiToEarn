# RFC 0002: Xiaohongshu — Server-Side Integration

- **Status**: Draft（决策性 RFC，无代码）
- **Author**: harry / contributors
- **Created**: 2026-05-15
- **Related**: RFC 0001 §6.1 #4（XHS 真接入）, §6.2 #6（BrowserAutomationModule）

## TL;DR

`aitoearn-server` 上的小红书 data-cube 是 stub（5 个方法返回 0），engagement provider 是骨架。但 **`aitoearn-electron` 仓库里有一个 1704 行的 `XiaohongshuService` 已经在生产环境跑很久了**——它用 Electron 的 BrowserWindow 让用户扫码登录、保存 cookie、然后直接调小红书的私有 API 拿创作者中心数据、发图文/视频、读评论、回复评论、点赞。

所以本 RFC 不是"要不要做 XHS"，而是 **"要不要把 Electron 端那套搬到 server 端"** —— 这是一个很不一样的问题，答案不是显然的。

**我的推荐**：**不要直接搬**。原因和替代方案见 §3 / §4 / §5。

## 1. 现状对照

| 维度 | aitoearn-electron（已存在） | aitoearn-server（待办） |
|---|---|---|
| 文件 | `electron/plat/xiaohongshu/index.ts` 1704 行 | `data-cube/xhs-data.service.ts` 70 行 stub + `engagement/providers/xiaohongshu.provider.ts` 70 行骨架 |
| 登录方式 | Electron BrowserWindow，用户在弹窗里扫码登录 | ❌ 不存在 |
| Cookie 存储 | Electron session cookie store（local，per-machine） | ❌ 不存在 |
| 调用的端点 | `edith.xiaohongshu.com/api/sns/web/v2/...` + `creator.xiaohongshu.com/api/galaxy/...` 共 ~15 个私有 API | ❌ 不存在 |
| 已实现功能 | 登录、用户信息、Dashboard、粉丝、上传图片/视频、发图文笔记、发视频笔记、话题、地点、搜索、获取自己作品、评论列表、二级评论、点赞 | ❌ 0 |
| 反爬应对 | `esec_token` 硬编码、`x-s` 签名、自定义 UA、cookie 自动同步 | ❌ |
| 在用情况 | **生产环境真实在用** | — |

## 2. 三种选项

### 选项 A：把 Electron 服务搬到 server 端

**做法**：把 `electron/plat/xiaohongshu/index.ts` 改写成一个 NestJS service，依赖 Playwright（替换 Electron BrowserWindow），cookie 存到 Redis / Mongo（替换 Electron session store）。

**好处**：
- 用户不需要装 Electron 客户端就能用
- 服务端可以做定时任务（每天拉昨日数据等）
- API 路由跟其他平台对齐

**坏处**（每条都很重）：
1. **封号风险集中化**：Electron 上每个用户在自己机器上跑，IP / UA / 浏览器指纹是分散的；搬到 server 后**所有用户的请求从同一批 server IP 出去**，小红书风控眼里就是一个超级活跃的"机器人"。轻则限流，重则**整批账号一起封**。
2. **私有 API 反爬升级压力**：现在的 1704 行代码里已经有 `esec_token`、自定义 UA、`x-s` 签名等绕过手段。这些在 Electron 真实浏览器环境里 work，但在 server 端的 Playwright headless 里小红书会用 navigator 指纹、canvas fingerprint、TLS JA3 等差异检测出来。维护成本会上升一个数量级。
3. **法务红线**：小红书 ToS 第 X 条明确禁止"使用爬虫、自动化脚本批量采集"。**单用户在自己浏览器里操作自己账号**和**SaaS 服务从机房代用户操作其账号**在司法上不是同一件事，后者更接近《反不正当竞争法》关注的"擅自使用他人数据"。AiToEarn 已经有商业化（CPS/CPE/CPM 结算），不能装作只是工具。
4. **Cookie 安全**：扫码登录后保存的 cookie 是**长期凭证**，服务端集中存储意味着一次数据库泄漏 = 全用户账号失守。Electron 端起码是分布式的，单点失守只影响一个用户。
5. **运维成本**：Playwright + Chromium 镜像至少 1.5 GB，每个 worker 至少 500 MB 内存，要支持 N 个用户并发就要 N 个 worker。这跟现有的 NestJS 后端架构（轻量 HTTP service）不是一个量级。

**估算**：3-5 周 + 持续维护。法务风险 high。

### 选项 B：保持 Electron 端，server 只做"瘦协调"

**做法**：
- `aitoearn-electron` 继续用现有 `XiaohongshuService` 在用户机器上跑
- `aitoearn-server` 通过 WebSocket / Long Polling 把"任务"下发给 Electron 客户端：
  - 比如 `请帮我拉一下 accountId=X 的 dashboard 数据回来`
  - Electron 客户端执行后把结果回传，server 写到 DB
- server 端的 `XhsDataService` 从 DB 读最新数据返回，不直接调小红书

**好处**：
- 封号风险不变（每个用户在自己机器上）
- 法务责任仍然在用户侧（用户用自己客户端访问自己账号）
- 复用 Electron 1704 行成熟代码，零重写
- server 仍然能给 Web 端 / MCP 提供 XHS 数据视图（虽然有延迟）

**坏处**：
- 用户必须**至少打开一次** Electron 客户端数据才会同步
- Web/MCP 用户体验比不上 YouTube/IG 那种 OAuth 实时拉的方式
- 需要做 Electron ↔ server 的双向通信通道（可以基于现有 BullMQ / WebSocket）

**估算**：1-2 周 server 端 + 1 周 Electron 端协议适配。法务风险 low。

### 选项 C：暂时不做，承认现状

**做法**：
- `XhsDataService` 保持 stub，但前端在 XHS 账号面板上**显式提示**：
  - "小红书数据请打开 AiToEarn 桌面客户端查看"
- 文档明确说明：Web/MCP 用户的 XHS 能力 = 仅发布（已有），数据分析和评论互动 = 仅在桌面客户端可用

**好处**：
- 0 工作量
- 0 法务风险
- 0 封号风险
- 不欺骗用户

**坏处**：
- 推广 Web/MCP 时要把"全平台数据分析"打折——"全平台减小红书"

**估算**：半天写文案。

## 3. 推荐：选项 B

走"瘦协调"路线，理由：

1. **风险/收益最优**：封号和法务责任仍在用户侧；server 的角色是数据中转和任务调度，这是技术问题，不是合规问题。
2. **复用现有资产**：Electron 端 1704 行代码已经趟过坑了，重写成本巨大且没有任何技术增益。
3. **可演进**：将来如果选项 A 的某些路径变得安全（例如小红书开放 API、或我们做了足够的指纹分散），可以替换 Electron worker 但保持 server 接口不变。
4. **诚实**：用户用桌面客户端 = 用自己的 IP 和指纹访问自己账号，跟手动操作没区别；服务端 Playwright 装作真实浏览器 = 在演戏，迟早被识破。

## 4. 选项 B 的工程蓝图（不是最终设计，仅供讨论）

### 4.1 通信协议

```
┌─────────────┐                      ┌──────────────────┐
│  Electron   │──── WebSocket ──────│  aitoearn-server │
│   client    │  (or BullMQ poll)   │                  │
└──────┬──────┘                      └────────┬─────────┘
       │                                      │
       │ ① server.publish(task)               │
       │◀─────────────────────────────────────│
       │                                      │
       │ ② electron.execute(task)             │
       │     -> XiaohongshuService            │
       │                                      │
       │ ③ electron.report(result)            │
       │─────────────────────────────────────▶│
       │                                      │
       │                                      ④ server.persist(result)
       │                                        to Mongo / Redis cache
```

任务类型至少需要：
- `xhs.fetch_dashboard` → `{ accountId }` → returns `{ fans, views, ... }`
- `xhs.fetch_comments` → `{ accountId, noteId, cursor }` → returns `EngagementComment[]`
- `xhs.reply_comment` → `{ accountId, noteId, commentId, message }` → returns `{ success, error? }`
- `xhs.publish` （Electron 已有，仅注册到协议层）

### 4.2 server 端改动

- 新模块 `apps/aitoearn-server/src/core/channel/desktop-bridge/`
  - `desktop-bridge.module.ts`
  - `desktop-bridge.gateway.ts`（NestJS WebSocket gateway）
  - `desktop-task.service.ts`（task 派发 + 等待 result，超时回退）
- `XhsDataService` 改为：
  - 先查 Mongo cache（5 分钟新鲜度）
  - cache miss 时通过 desktop-bridge 派任务
  - 任务超时（无 Electron 在线 / 30s 没回）→ 抛 `XhsDesktopOfflineException`
- `XiaohongshuEngagementProvider` 同理

### 4.3 Electron 端改动

- 新增 `electron/services/server-bridge.service.ts`
  - 启动时连接 server WebSocket
  - 监听 task 事件，dispatch 到 `XiaohongshuService` 的对应方法
  - 把结果回传

### 4.4 不做的部分

- **不做** Playwright 容器化方案
- **不做** server 直接调小红书 API
- **不做** cookie 集中存储（cookie 仍在 Electron session store）

## 5. 风险与未决问题

| 问题 | 当前观点 | 谁来拍板 |
|---|---|---|
| Electron 不在线时 Web 用户体验？ | 显式 `XhsDesktopOfflineException` + 前端"请打开桌面客户端"提示 | 产品 |
| 小红书 ToS 风险随服务规模上升？ | 选项 B 把责任留在用户侧，但**法务最好书面 review 一次** | 法务 |
| 数据延迟（5 分钟 cache）能接受吗？ | 创作者中心数据本身就是 T+1，5 分钟无影响 | 产品 |
| 多用户多 Electron 并发 → server WebSocket 压力？ | NestJS gateway 横向扩展不是瓶颈，BullMQ 兜底 | 后端 |
| 选项 B 对 MCP 用户的影响？ | MCP 用户必须同时跑 Electron 才能用 XHS 能力；MCP 文档明确说明 | 产品 |

## 6. 验收标准（如果走选项 B）

- [ ] WebSocket bridge 在 server 重启 / Electron 重连后能恢复
- [ ] Electron 离线时 server 调用返回明确的错误码而不是空数据
- [ ] `XhsDataService.getAccountDataCube` 在 Electron 在线 + 已登录 XHS 时返回非零真实数据
- [ ] Cookie **不**经过 server 持久化（仅作请求时携带）
- [ ] 法务 sign-off 写入 PR 描述

## 7. 相关 RFC

- RFC 0001 §6.2 #6 提到的 BrowserAutomationModule 是为**视频号 / B 站评论**之类没有桌面客户端的平台准备的——XHS 不需要，因为有 Electron。这是为什么本 RFC 把两个问题切开。

## 8. 决策需求

**请评审以下问题并在 PR 评论里表态**：

1. 是否同意推荐方案（选项 B）？
2. 法务是否愿意背书"用户用自己的 Electron 客户端访问自己 XHS 账号" = 用户自己操作？
3. 是否接受"Web/MCP 用户必须装桌面客户端才能用 XHS 数据/互动"作为已知限制？
4. 4.2 的工程范围是否合理？（1-2 周 + 1 周 Electron）

如果以上 4 项都拿到 yes，我会另起 RFC 0003 写选项 B 的详细实现规格，再开 PR 落地。
