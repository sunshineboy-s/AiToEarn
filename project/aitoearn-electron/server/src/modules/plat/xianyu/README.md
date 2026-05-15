# 闲鱼（Xianyu / Goofish）Electron Cookie 通路

## 为什么是 Cookie 通路

闲鱼对个人用户**没有公开 OAuth API**，淘宝开放平台只对入驻商家开放。所以
Electron 桌面端用 BrowserWindow 让用户登录闲鱼网页版（goofish.com），
抓 Cookie 之后直接调用 H5 mtop 网关，跟所有其他第三方"多平台发布"工具
做的事情是一样的。

## 模块构成

```
xianyu/
├── README.md              ← 你正在看的
├── mtop-client.ts         ← mtop 协议（sign 算法 + 错误处理 + token 重试）
├── xianyu.service.ts      ← 业务方法（发布 / 删除 / 列表 / 心跳）
├── xianyu.controller.ts   ← HTTP 入口
├── dto/
│   └── xianyu.dto.ts
└── comment.ts             ← 共享类型
```

`mtop-client.ts` 完全可静态实现（mtop 协议是公开的）。`xianyu.service.ts`
里 `XIANYU_API` 常量记录了具体的 api 名 / 版本号 —— 这部分**会随闲鱼
前端版本变化**，需要按下面的方法验证。

## 如何用 BrowserWindow 抓包确认 api 名

下面这套流程任何时候发现接口报 `FAIL_BIZ_API_NOT_FOUND` / `FAIL_SYS_*`
都可以拿来重新校准。

### 1. 在主进程开发模式下启动 BrowserWindow

```ts
// electron 主进程
const win = new BrowserWindow({ webPreferences: { devTools: true } })
await win.loadURL('https://www.goofish.com/')
win.webContents.openDevTools()
```

### 2. 完成你想"复刻"的操作

例如：发布一件商品 / 下架某商品 / 打开"我的商品"列表。

### 3. 在 Network 面板里筛选 `h5api.m.goofish.com/h5/`

每个 mtop 请求都长这样：

```
GET https://h5api.m.goofish.com/h5/mtop.idle.user.publish.publish/4.0/
    ?jsv=2.6.1
    &appKey=12574478
    &t=1700000000000
    &sign=abc123def456...
    &api=mtop.idle.user.publish.publish
    &v=4.0
    &type=originaljson
    &dataType=json
    &data={"title":"...","images":[...],...}
```

### 4. 把 api / version 抄到 `XIANYU_API`

```ts
// xianyu.service.ts
const XIANYU_API = {
  publishItem: { api: '...抓到的 api 名...', version: '...抓到的版本...' },
  ...
} as const
```

### 5. 把 `data` 字段抄到 service 的 `requestBody`

闲鱼的 `images` 字段**通常是 imageId（淘系 CDN 上传后得到）**，不是外链 URL。
本模块的 `image-uploader.ts` 已经实现了"先把外链下载成 Buffer，再走
`mtop.taobao.litegw.image.upload` 上传到淘系 CDN 拿 imageId"的中转上传，
`publishItem` 在调发布前会自动做这一步。

如果你看到：

```
ret: ["FAIL_BIZ_PIC_NEED_UPLOAD::图片需先上传到淘系 CDN"]
```

说明上传步骤被绕过了（比如直接调了 mtop publish 接口）。`publishItem` 走完
正常流程不会触发这个错误。

## sign 算法（mtop h5）

`mtop-client.ts` 里 `buildMtopSign()` 已实现，列在这里方便对照：

```
sign = MD5( token + '&' + t + '&' + appKey + '&' + data )
```

- `token` = cookie 里 `_m_h5_tk` 的 `_` 之前那一段
- `t` = `Date.now()` 毫秒时间戳
- `appKey` = `12574478`（goofish.com 网页固定值）
- `data` = `JSON.stringify(请求体)`

如果 cookie 里**没有** `_m_h5_tk`，先发一次 GET 请求（任意 mtop API），
mtop 网关会回种 `_m_h5_tk` + `_m_h5_tk_enc` 两个 cookie。`mtop-client.ts`
检测到 `FAIL_SYS_TOKEN_EMPTY` / `FAIL_SYS_TOKEN_EXPIRED` 时自动用新
cookie 重试一次，并把更新过的 cookie 通过 `updatedCookie` 返回给 service
回写到 `Account.loginCookie`。

## 调试小贴士

- 看到 `FAIL_SYS_ILLEGAL_ACCESS::非法请求` 通常是 sign 错（最常见原因
  是 `data` 在 stringify 之前键的顺序变了，或者把 BigInt 当成 number 处理）。
- 看到 `FAIL_SYS_SESSION_EXPIRED` 是 cookie 真过期，账号已经 DISABLE，
  让用户重新登录。
- 看到 `FAIL_SYS_TRAFFIC_LIMIT` 是被限流，退避一会儿再试。
- mtop 网关接受 GET/POST 两种，闲鱼 H5 主要用 GET（参数都在 query）。
  我们也用 GET，简单稳定。
