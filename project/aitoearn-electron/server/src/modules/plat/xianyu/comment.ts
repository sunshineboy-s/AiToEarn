/**
 * 闲鱼（Xianyu / Goofish）平台共享类型。
 *
 * 闲鱼对个人用户没有公开 OAuth API。在 Electron 桌面端我们使用
 * Cookie 注入的方式：用户在我们的 BrowserWindow 中登录闲鱼网页版，
 * 我们抓取 Cookie 后保存到 account.loginCookie，再用 Cookie 调用
 * goofish.com 内部接口完成商品发布、查询、删除等操作。
 *
 * 注意：闲鱼内部接口未公开文档，签名（h5api 的 sign）随时可能变。
 * 这里只搭骨架，具体 sign 实现见 demo/xhs/signature.js 同款思路。
 */

export interface XianyuItem {
  itemId: string;
  title: string;
  desc?: string;
  price: number;
  reservePrice?: number;
  /** 1=全新 2=99新 3=95新 4=9成新 5=8成新及以下 */
  stuffStatus?: 1 | 2 | 3 | 4 | 5;
  imageUrls: string[];
  videoUrl?: string;
  status: 'on_sale' | 'sold_out' | 'offline' | 'reviewing' | 'rejected';
  workLink: string;
  publishTime?: Date;
}

export interface XianyuPublishOption {
  price?: number;
  reservePrice?: number;
  stuffStatus?: 1 | 2 | 3 | 4 | 5;
  freeShipping?: boolean;
  location?: { province?: string; city?: string; district?: string };
  catId?: number;
  fishpondId?: number;
  enableAutoReply?: boolean;
  videoDurationSec?: number;
  serviceLabels?: string[];
}

export interface XianyuLoginContext {
  /** 完整的登录态 Cookie 串，例如 "_m_h5_tk=xxx; cookie2=yyy; ..." */
  cookie: string;
  /** 闲鱼 uid（_id 也可），与 cookie 一致 */
  uid: string;
  /** 用户昵称 */
  nickname?: string;
  /** 头像 */
  avatar?: string;
}
