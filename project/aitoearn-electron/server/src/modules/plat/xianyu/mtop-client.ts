/*
 * 闲鱼 H5 mtop 客户端。
 *
 * 闲鱼网页版（goofish.com）所有内部接口都通过淘系 mtop 网关：
 *
 *   GET https://h5api.m.goofish.com/h5/{api}/{version}/?
 *       jsv=2.6.1
 *       &appKey={APP_KEY}
 *       &t={millis}
 *       &sign={md5}
 *       &api={api}
 *       &v={version}
 *       &type=originaljson
 *       &dataType=json
 *       &data={JSON.stringify(payload)}
 *
 * 签名算法（mtop h5 公开协议）：
 *
 *   sign = MD5(token + '&' + t + '&' + appKey + '&' + data)
 *
 * 其中 token 来自 cookie `_m_h5_tk` 的 `_` 之前那一段。
 * 例如 cookie 里有：
 *   _m_h5_tk=cf32f4c1c6b3a8f2e9c1234_1700000000000
 *               ^^^^^^^^^^^^^^^^^^^^^^^ 这个就是 token
 *
 * 当请求返回 `ret: ['FAIL_SYS_TOKEN_EMPTY::令牌为空']` 或
 * `FAIL_SYS_TOKEN_EXOIRED::令牌过期` 时，需要先访问任意 GET 接口让
 * 网关回写新的 `_m_h5_tk` cookie，再用新 token 重试一次。本客户端
 * 自动完成这一步（最多重试一次）。
 *
 * --- 不在本文件覆盖的两件事 ---
 *
 * 1. 具体 api 名（例如 `mtop.idle.user.publish.publish`）和参数 schema
 *    会随闲鱼前端版本变化，需在主进程 BrowserWindow 抓包后填到 service。
 * 2. 部分商品发布场景需要先调 `mtop.taobao.litegw.image.upload` 把图
 *    上传到淘系 CDN 拿到 `imageId`；这个流程留给 service 调用方处理。
 */

import type { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { firstValueFrom } from 'rxjs';

/**
 * 闲鱼 H5 网页对应的 mtop appKey（不是密钥，是公开的客户端标识）。
 * 抓包确认：goofish.com 的所有 h5api 调用都是这个值。
 */
export const XIANYU_APP_KEY = '12574478';

const XIANYU_H5_API_BASE = 'https://h5api.m.goofish.com/h5';

/** 用作 referer / origin 头，mtop 网关会校验 */
const XIANYU_REFERER = 'https://www.goofish.com/';
const XIANYU_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** mtop 网关已知的 token 失效错误码前缀 */
const TOKEN_FAIL_PREFIXES = [
  'FAIL_SYS_TOKEN_EMPTY',
  'FAIL_SYS_TOKEN_EXOIRED', // 闲鱼/淘宝官方拼写错误，长期保留
  'FAIL_SYS_TOKEN_EXPIRED',
] as const;

/**
 * mtop 网关响应外壳。data 字段的内容随 api 不同。
 */
export interface MtopResponse<T = unknown> {
  api: string;
  v: string;
  ret: string[];
  data: T;
  traceId?: string;
}

export interface MtopRequest {
  /** mtop api 名，例如 'mtop.idle.user.publish.publish' */
  api: string;
  /** 接口版本，例如 '4.0' */
  version: string;
  /** 业务参数，会被 JSON.stringify 后塞进 url query 'data' */
  data: Record<string, unknown>;
}

export interface MtopCallContext {
  /** 完整 cookie 字符串（含 _m_h5_tk）；由 service 从 Account.loginCookie 取出 */
  cookie: string;
}

/** 计算 mtop sign：MD5(token + '&' + t + '&' + appKey + '&' + data) */
export function buildMtopSign(
  token: string,
  t: string | number,
  appKey: string,
  data: string,
): string {
  const raw = `${token}&${t}&${appKey}&${data}`;
  return createHash('md5').update(raw).digest('hex');
}

/**
 * 从 cookie 字符串里取出 `_m_h5_tk` 的 token 部分（`_` 之前）。
 * 如果 cookie 里没有 `_m_h5_tk`，返回空串 —— 调用方需先做一次"预热"
 * 请求让网关下发它。
 */
export function extractMtopToken(cookie: string): string {
  const match = cookie.match(/_m_h5_tk=([^;]+)/);
  if (!match) return '';
  // _m_h5_tk 形如 "abc123_1700000000000"，下划线之前是 token
  const value = decodeURIComponent(match[1]).trim();
  const idx = value.indexOf('_');
  return idx > 0 ? value.slice(0, idx) : value;
}

/**
 * 把 axios 响应的 Set-Cookie 里更新过的 _m_h5_tk 合并回原 cookie 字符串，
 * 供下一次重试使用。
 *
 * 注意：mtop 网关每次会回种 _m_h5_tk + _m_h5_tk_enc 两个 cookie，
 * 我们都得替换。其他 cookie 保持原样。
 */
export function mergeSetCookie(
  originalCookie: string,
  setCookieHeaders: string[] | undefined,
): string {
  if (!setCookieHeaders || setCookieHeaders.length === 0) return originalCookie;

  // 解析旧 cookie
  const cookies = new Map<string, string>();
  for (const part of originalCookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    cookies.set(k, rest.join('='));
  }

  // 合入新 Set-Cookie（只取我们关心的）
  const interesting = new Set(['_m_h5_tk', '_m_h5_tk_enc']);
  for (const sc of setCookieHeaders) {
    const firstSegment = sc.split(';')[0];
    const eq = firstSegment.indexOf('=');
    if (eq <= 0) continue;
    const k = firstSegment.slice(0, eq).trim();
    const v = firstSegment.slice(eq + 1).trim();
    if (interesting.has(k)) {
      cookies.set(k, v);
    }
  }

  return Array.from(cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * 调用一次 mtop。返回 `{ data, updatedCookie }`：
 * - 如果 token 过期触发了一次重试，updatedCookie 会非空，调用方有责任
 *   把它写回 Account.loginCookie。
 * - 业务错误（非 token 类）会以 MtopBusinessError 抛出。
 *
 * 这里不依赖 NestJS 注入，方便单元测试；只把 HttpService 当参数传进来。
 */
export async function callMtop<T = unknown>(
  http: HttpService,
  ctx: MtopCallContext,
  req: MtopRequest,
  options: { logger?: Logger; appKey?: string; timeoutMs?: number } = {},
): Promise<{ data: T; updatedCookie?: string }> {
  const logger = options.logger ?? new Logger('XianyuMtopClient');
  const appKey = options.appKey ?? XIANYU_APP_KEY;
  const timeoutMs = options.timeoutMs ?? 8000;

  let cookie = ctx.cookie;

  /** 单次实际请求 */
  const send = async (
    cookieToUse: string,
  ): Promise<{ resp: MtopResponse<T>; setCookie?: string[] }> => {
    const t = Date.now().toString();
    const dataStr = JSON.stringify(req.data);
    const token = extractMtopToken(cookieToUse);
    const sign = buildMtopSign(token, t, appKey, dataStr);

    const url = `${XIANYU_H5_API_BASE}/${req.api}/${req.version}/`;
    const params = {
      jsv: '2.6.1',
      appKey,
      t,
      sign,
      api: req.api,
      v: req.version,
      type: 'originaljson',
      dataType: 'json',
      data: dataStr,
    };

    const { data, headers } = await firstValueFrom(
      http.get<MtopResponse<T>>(url, {
        params,
        headers: {
          cookie: cookieToUse,
          referer: XIANYU_REFERER,
          origin: 'https://www.goofish.com',
          'user-agent': XIANYU_USER_AGENT,
        },
        timeout: timeoutMs,
        validateStatus: () => true, // 即使 4xx/5xx 也让 mtop 错误码进入业务层
      }),
    );

    // axios 把 set-cookie 放在 headers['set-cookie']（数组）。某些代理可能用别的大小写，做下兜底。
    const sc =
      (headers as Record<string, string[] | string | undefined>)[
        'set-cookie'
      ] ??
      (headers as Record<string, string[] | string | undefined>)['Set-Cookie'];
    const setCookie = Array.isArray(sc) ? sc : sc ? [sc] : undefined;
    return { resp: data, setCookie };
  };

  // 第一次请求
  let { resp, setCookie } = await send(cookie);
  let cookieAfterFirst = mergeSetCookie(cookie, setCookie);

  // token 失效重试一次
  const retCodes = resp?.ret ?? [];
  const tokenFailed = retCodes.some((r) =>
    TOKEN_FAIL_PREFIXES.some((p) => r.startsWith(p)),
  );
  if (tokenFailed) {
    logger.debug(
      `[mtop] token failed, retrying once. api=${req.api} ret=${retCodes.join('|')}`,
    );
    if (cookieAfterFirst === cookie) {
      // 网关没回种 token，没法重试，就把原错误抛出
      throw new MtopTokenError(req.api, retCodes);
    }
    cookie = cookieAfterFirst;
    const second = await send(cookie);
    resp = second.resp;
    setCookie = second.setCookie;
    cookieAfterFirst = mergeSetCookie(cookie, setCookie);
  }

  if (!resp) {
    throw new MtopNetworkError(req.api);
  }

  const success = (resp.ret ?? []).some((r) => /^SUCCESS::/.test(r));
  if (!success) {
    throw new MtopBusinessError(req.api, resp.ret ?? [], resp);
  }

  return {
    data: resp.data,
    updatedCookie:
      cookieAfterFirst !== ctx.cookie ? cookieAfterFirst : undefined,
  };
}

/* --------------------------- error classes --------------------------- */

export class MtopBusinessError extends Error {
  constructor(
    public readonly api: string,
    public readonly ret: string[],
    public readonly raw: unknown,
  ) {
    super(`[xianyu mtop ${api}] business error: ${ret.join(' | ')}`);
    this.name = 'MtopBusinessError';
  }
}

export class MtopTokenError extends Error {
  constructor(
    public readonly api: string,
    public readonly ret: string[],
  ) {
    super(
      `[xianyu mtop ${api}] token expired and gateway did not reset cookie`,
    );
    this.name = 'MtopTokenError';
  }
}

export class MtopNetworkError extends Error {
  constructor(public readonly api: string) {
    super(`[xianyu mtop ${api}] network error / empty response`);
    this.name = 'MtopNetworkError';
  }
}
