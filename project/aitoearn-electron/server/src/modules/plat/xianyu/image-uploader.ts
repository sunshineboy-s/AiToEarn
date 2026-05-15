/*
 * 闲鱼/淘宝图片上传到淘系 CDN。
 *
 * 闲鱼发布商品（mtop.idle.user.publish.publish）的 `images` 字段期望的是
 * 淘系 CDN 的 imageId 数组（通常是 `i\d/[A-Za-z0-9]+` 形态的字符串），
 * 而不是任意外链 URL。如果直接传 URL，闲鱼网关会返回：
 *
 *   ret: ["FAIL_BIZ_PIC_NEED_UPLOAD::图片需先上传"]
 *
 * 所以发布前必须把外链图片下载成 Buffer，再走淘系图片上传接口拿 imageId。
 *
 * 上传接口：mtop.taobao.litegw.image.upload v2.0
 *   - 走 mtop 网关，但请求体是 multipart/form-data（不是普通的 GET data 参数）
 *   - 同样需要 _m_h5_tk + sign，签名规则和普通 mtop 调用一致
 *   - 只是字段 data 的内容是 base64 后的图片二进制 + meta，不是 JSON
 *
 * 本模块支持两种入参：
 *   - Buffer（已经有的图片字节，直接上传）
 *   - URL（先下载到 Buffer 再上传，附 30s 超时）
 *
 * 失败策略：
 *   - 单张图片上传失败立即抛错，让上层 publishItem 也直接失败 —— 因为
 *     闲鱼商品要求至少 1 张图，而且半数图片成功半数失败的状态难以恢复。
 */

import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import * as FormDataModule from 'form-data';
import { firstValueFrom } from 'rxjs';

import {
  buildMtopSign,
  extractMtopToken,
  mergeSetCookie,
  XIANYU_APP_KEY,
} from './mtop-client';

// form-data 在 CommonJS 视图下默认导出就是构造函数本身，
// 但在 TS 里 `import * as` 拿到的是 namespace。我们要的就是这个 namespace
// 既能 new 又有 prototype 方法 —— 它的 callable shape 由库本身保证。
type FormDataInstance = {
  append: (key: string, value: unknown, options?: unknown) => void;
  getHeaders: () => Record<string, string>;
};
type FormDataConstructor = new () => FormDataInstance;
const FormData = FormDataModule as unknown as FormDataConstructor;

const TAOBAO_IMAGE_UPLOAD_API = 'mtop.taobao.litegw.image.upload';
const TAOBAO_IMAGE_UPLOAD_VERSION = '2.0';
const TAOBAO_IMAGE_UPLOAD_HOST = 'https://h5api.m.goofish.com/h5';

const XIANYU_REFERER = 'https://www.goofish.com/';
const XIANYU_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * 上传一张图片到淘系 CDN。
 *
 * @returns `{ imageId, url, updatedCookie? }`：
 *   - imageId: 用于 publishItem 的 images 字段
 *   - url: CDN URL（如果接口返回的话），用作日志/显示
 *   - updatedCookie: 如果触发了 token 刷新，新的完整 cookie 串；调用方应回写到 Account.loginCookie
 */
export async function uploadImageBufferToTaobaoCDN(
  http: HttpService,
  cookie: string,
  image: { data: Buffer; mimeType?: string; filename?: string },
  options: { logger?: Logger; timeoutMs?: number } = {},
): Promise<{ imageId: string; url?: string; updatedCookie?: string }> {
  const logger = options.logger ?? new Logger('XianyuImageUploader');
  const timeoutMs = options.timeoutMs ?? 30_000;

  // mtop 网关的 sign 用 data 字段的 JSON 字符串作为 hash 输入。
  // 图片上传里 data 的语义是元信息（不含图片本体）；图片本体走 multipart 的 file 字段。
  const t = Date.now().toString();
  const dataObject = {
    name: image.filename ?? `xianyu_${Date.now()}.jpg`,
    type: image.mimeType ?? 'image/jpeg',
    size: image.data.length,
    bizCode: 'common', // 抓包观察值；不同业务线可能不同，"common" 在闲鱼侧通用
  };
  const dataStr = JSON.stringify(dataObject);
  const token = extractMtopToken(cookie);
  const sign = buildMtopSign(token, t, XIANYU_APP_KEY, dataStr);

  // multipart body：闲鱼侧期望两个 field
  //   - data：上面的 dataStr（JSON 字符串）
  //   - file：图片二进制（带 filename 才能拿到正确 content-disposition）
  const form = new FormData();
  form.append('data', dataStr);
  form.append('file', image.data, {
    filename: dataObject.name,
    contentType: dataObject.type,
  });

  const url = `${TAOBAO_IMAGE_UPLOAD_HOST}/${TAOBAO_IMAGE_UPLOAD_API}/${TAOBAO_IMAGE_UPLOAD_VERSION}/`;
  const params = {
    jsv: '2.6.1',
    appKey: XIANYU_APP_KEY,
    t,
    sign,
    api: TAOBAO_IMAGE_UPLOAD_API,
    v: TAOBAO_IMAGE_UPLOAD_VERSION,
    type: 'originaljson',
    dataType: 'json',
  };

  type UploadResp = {
    api: string;
    ret: string[];
    data?: {
      // 不同版本字段名略有差异，全都兜底
      id?: string;
      imageId?: string;
      cdnUrl?: string;
      url?: string;
    };
  };

  const { data: resp, headers } = await firstValueFrom(
    http.post<UploadResp>(url, form as unknown as Record<string, unknown>, {
      params,
      headers: {
        ...form.getHeaders(),
        cookie,
        referer: XIANYU_REFERER,
        origin: 'https://www.goofish.com',
        'user-agent': XIANYU_USER_AGENT,
      },
      timeout: timeoutMs,
      maxBodyLength: 10 * 1024 * 1024, // 10 MB；闲鱼单图大小上限
      validateStatus: () => true,
    }),
  );

  // 合并 set-cookie（图片上传也可能触发 _m_h5_tk 刷新）
  const sc =
    (headers as Record<string, string[] | string | undefined>)['set-cookie'] ??
    (headers as Record<string, string[] | string | undefined>)['Set-Cookie'];
  const setCookie = Array.isArray(sc) ? sc : sc ? [sc] : undefined;
  const updatedCookieRaw = mergeSetCookie(cookie, setCookie);
  const updatedCookie =
    updatedCookieRaw !== cookie ? updatedCookieRaw : undefined;

  const success = (resp?.ret ?? []).some((r) => /^SUCCESS::/.test(r));
  if (!success) {
    const reason = (resp?.ret ?? []).join(' | ') || 'no ret';
    logger.warn(`[xianyu] image upload failed: ${reason}`);
    throw new Error(`xianyu image upload failed: ${reason}`);
  }

  const imageId = resp?.data?.imageId ?? resp?.data?.id;
  if (!imageId) {
    throw new Error('xianyu image upload returned success but no imageId');
  }

  return {
    imageId,
    url: resp?.data?.cdnUrl ?? resp?.data?.url,
    updatedCookie,
  };
}

/**
 * 通过 URL 上传图片：先下载到 Buffer，再走 uploadImageBufferToTaobaoCDN。
 *
 * 适用场景：上层 publishItem 拿到的是 dto.imgUrlList（通常是已经在我们自己
 * 资源系统/外部 URL 上的图片），需要"中转"上传到淘系 CDN。
 */
export async function uploadImageUrlToTaobaoCDN(
  http: HttpService,
  cookie: string,
  imageUrl: string,
  options: { logger?: Logger; timeoutMs?: number } = {},
): Promise<{ imageId: string; url?: string; updatedCookie?: string }> {
  const downloadTimeout = options.timeoutMs ?? 15_000;

  const { data, headers } = await firstValueFrom(
    http.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
      timeout: downloadTimeout,
      // 不发 cookie：图片源站通常和闲鱼无关；若是私链由调用方自己换成 Buffer 入参
      maxRedirects: 5,
    }),
  );
  const buffer = Buffer.from(data);
  const contentTypeHeader = (headers as Record<string, string | undefined>)[
    'content-type'
  ];
  const mimeType =
    typeof contentTypeHeader === 'string'
      ? contentTypeHeader.split(';')[0].trim()
      : 'image/jpeg';

  // 文件名取 URL 末段，便于排查；闲鱼接口本身只看 mimeType
  let filename: string;
  try {
    const u = new URL(imageUrl);
    filename = u.pathname.split('/').filter(Boolean).pop() ?? 'image.jpg';
  } catch {
    filename = 'image.jpg';
  }

  return uploadImageBufferToTaobaoCDN(
    http,
    cookie,
    { data: buffer, mimeType, filename },
    options,
  );
}
