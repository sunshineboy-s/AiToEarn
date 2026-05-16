/* eslint-disable no-console */
/**
 * 抖音开放平台数据 API 探测脚本
 *
 * 用途：验证 DouyinApiService 在真实账号上的端点行为与字段命名。
 * 这是一个手动跑的工具，不进 CI；用于在合并 PR 前快速校验。
 *
 * 使用方式：
 *   1. 先在抖音开放平台做完一次完整 OAuth，拿到用户的 access_token + open_id
 *   2. 找一条该账号已发布的作品，记下 item_id
 *   3. 跑：
 *        DOUYIN_ACCESS_TOKEN=act.xxx \
 *        DOUYIN_OPEN_ID=ba253642-xxx \
 *        DOUYIN_ITEM_ID=70xxxxxxxxxxxxxxxxx \
 *        npx ts-node project/aitoearn-backend/scripts/probe-douyin.ts
 *
 * 脚本会依次打印 5 个端点的原始 envelope，便于核对字段名是否与
 * `libs/douyin/common.ts` 的接口定义一致。
 *
 * 不依赖 Nest 容器，只用 axios。如有字段差异，直接修 common.ts 后再跑。
 */
import process from 'node:process'
import axios from 'axios'

const BASE = 'https://open.douyin.com'

const accessToken = process.env.DOUYIN_ACCESS_TOKEN
const openId = process.env.DOUYIN_OPEN_ID
const itemId = process.env.DOUYIN_ITEM_ID

if (!accessToken || !openId) {
  console.error('Missing env: DOUYIN_ACCESS_TOKEN and DOUYIN_OPEN_ID are required')
  console.error('DOUYIN_ITEM_ID is required for arc-level endpoints')
  process.exit(1)
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function get(path: string, params: Record<string, string | number>) {
  const start = Date.now()
  try {
    const res = await axios.get(`${BASE}${path}`, {
      params,
      headers: {
        'Content-Type': 'application/json',
        'access-token': accessToken,
      },
    })
    console.log(`\n=== ${path} ===`)
    console.log(`  params:    ${JSON.stringify(params)}`)
    console.log(`  latency:   ${Date.now() - start}ms`)
    console.log(`  http:      ${res.status}`)
    console.log(`  body:`)
    console.log(JSON.stringify(res.data, null, 2))
    return res.data
  }
  catch (e: any) {
    console.log(`\n=== ${path} (FAILED) ===`)
    console.log(`  params: ${JSON.stringify(params)}`)
    console.log(`  error:  ${e?.message ?? e}`)
    if (e?.response?.data)
      console.log(`  body:   ${JSON.stringify(e.response.data, null, 2)}`)
    return null
  }
}

async function main() {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  console.log('================================================')
  console.log('Douyin Data API probe')
  console.log(`open_id:   ${openId}`)
  console.log(`item_id:   ${itemId ?? '(not set; arc endpoints will be skipped)'}`)
  console.log(`date win:  ${fmtDate(weekAgo)} -> ${fmtDate(today)}`)
  console.log('================================================')

  // 1. 用户粉丝数（按日时序）
  await get('/data/external/user/fans/', {
    open_id: openId!,
    date_type: 7,
    start_date: fmtDate(yesterday),
    end_date: fmtDate(today),
  })

  // 2. 视频列表（用于推断作品总数）
  await get('/api/douyin/v1/video/video_list/', {
    open_id: openId!,
    cursor: 0,
    count: 5,
  })

  if (!itemId) {
    console.log('\n[skip] arc-level endpoints; set DOUYIN_ITEM_ID to enable')
    return
  }

  // 3. 单作品基础数据
  await get('/data/external/item/base/', {
    open_id: openId!,
    item_id: itemId,
    date_type: 7,
    start_date: fmtDate(yesterday),
    end_date: fmtDate(today),
  })

  // 4. 单作品按日 - 4 个端点
  for (const metric of ['play', 'like', 'comment', 'share']) {
    await get(`/data/external/item/${metric}/`, {
      open_id: openId!,
      item_id: itemId,
      date_type: 7,
      start_date: fmtDate(weekAgo),
      end_date: fmtDate(today),
    })
  }

  // 5. 互动 API - 评论列表
  const commentListResp = await get('/api/douyin/v1/comment/list/', {
    open_id: openId!,
    item_id: itemId,
    cursor: 0,
    count: 5,
    sort_type: 0,
  })

  // 6. 互动 API - 评论回复列表（如有评论）
  const firstCommentId
    = commentListResp?.data?.list?.[0]?.comment_id as string | undefined
  if (firstCommentId) {
    await get('/api/douyin/v1/comment/list_replies/', {
      open_id: openId!,
      item_id: itemId,
      comment_id: firstCommentId,
      cursor: 0,
      count: 5,
    })
    console.log('\n[skip] /api/douyin/v1/comment/reply/ — set DOUYIN_PROBE_REPLY=1 to actually post a reply')
    if (process.env.DOUYIN_PROBE_REPLY === '1') {
      const start = Date.now()
      try {
        const res = await axios.post(
          `${BASE}/api/douyin/v1/comment/reply/`,
          {
            open_id: openId,
            item_id: itemId,
            comment_id: firstCommentId,
            content: '[probe] hi 👋',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'access-token': accessToken,
            },
          },
        )
        console.log(`\n=== /api/douyin/v1/comment/reply/ ===`)
        console.log(`  latency: ${Date.now() - start}ms`)
        console.log(JSON.stringify(res.data, null, 2))
      }
      catch (e: any) {
        console.log(`\n=== /api/douyin/v1/comment/reply/ (FAILED) ===`)
        console.log(`  error: ${e?.message ?? e}`)
        if (e?.response?.data)
          console.log(`  body:  ${JSON.stringify(e.response.data, null, 2)}`)
      }
    }
  }
  else {
    console.log('\n[skip] no comments on this item; skipping list_replies + reply probes')
  }

  console.log('\n================================================')
  console.log('Probe done. Compare each "body" output above with')
  console.log('the response interfaces defined in:')
  console.log('  apps/aitoearn-server/src/core/channel/libs/douyin/common.ts')
  console.log('If field names differ, update common.ts and rerun the probe.')
  console.log('================================================')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
