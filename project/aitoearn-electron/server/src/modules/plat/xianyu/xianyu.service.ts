/*
 * 闲鱼（咸鱼 / Goofish）平台 Service —— Electron 桌面端 Cookie 注入版本。
 *
 * 闲鱼对个人用户没有公开 OAuth API，所以本 Service 的所有写操作都依赖：
 *   1. 用户已经在主进程的登录 BrowserWindow 完成扫码 / 账密登录；
 *   2. 我们已把 Cookie 字符串保存到 Account.loginCookie。
 *
 * 在此 Service 中，我们只负责：
 *   - 从 Account 取出 cookie；
 *   - 通过 mtop-client 调用 goofish.com h5api（mtop 协议）；
 *   - 失败时上抛清晰的错误，并在 token 失效时把 Account 标记为 DISABLE。
 *
 * mtop 协议（sign 计算 + 参数排布 + token 重试）已经全部由 mtop-client 实现。
 *
 * --- 留给抓包确认的部分 ---
 *
 * mtop API 名 / 版本 / 字段名会随闲鱼前端版本变化。下面 XIANYU_API_*
 * 常量是基于公开抓包记录的"较稳定"组合，但任何时候用户在浏览器里
 * F12 → Network 抓到的形态才是 ground truth；如果发现 ret 报
 * `FAIL_BIZ_API_NOT_FOUND` 之类，第一时间替换这些常量即可。
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Account,
  AccountStatus,
  AccountType,
} from 'src/db/schema/account.schema';
import { CreateXianyuItemDto, XianyuItemFilterDto } from './dto/xianyu.dto';
import { XianyuItem, XianyuLoginContext } from './comment';
import {
  callMtop,
  MtopBusinessError,
  MtopNetworkError,
  MtopTokenError,
} from './mtop-client';

/**
 * mtop API 名 / 版本。基于公开抓包（goofish.com PC 网页版）；
 * 如果以后变了，只需改这一处。
 */
const XIANYU_API = {
  publishItem: { api: 'mtop.idle.user.publish.publish', version: '4.0' },
  deleteItem: { api: 'mtop.idle.user.delete', version: '1.0' },
  listMyItems: { api: 'mtop.idle.user.publishedlist', version: '1.0' },
  /** 心跳：拿当前登录用户信息，同时让 mtop 网关下发 _m_h5_tk */
  whoami: { api: 'mtop.taobao.idle.user.getuserinfo', version: '1.0' },
} as const;

@Injectable()
export class XianyuService {
  private readonly logger = new Logger(XianyuService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
  ) {}

  /**
   * 把扫码登录后获得的 Cookie 持久化为闲鱼账号。
   * 由主进程 BrowserWindow 的 cookie 拦截逻辑调用。
   */
  async upsertCookieAccount(
    userId: string,
    ctx: XianyuLoginContext,
    groupId: number,
  ): Promise<Account> {
    const existing = await this.accountModel.findOne({
      userId,
      type: AccountType.XIANYU,
      uid: ctx.uid,
    });

    if (existing) {
      existing.loginCookie = ctx.cookie;
      existing.loginTime = new Date();
      existing.status = AccountStatus.USABLE;
      if (ctx.nickname) existing.nickname = ctx.nickname;
      if (ctx.avatar) existing.avatar = ctx.avatar;
      await existing.save();
      return existing;
    }

    const created = await this.accountModel.create({
      id: Date.now(),
      userId,
      type: AccountType.XIANYU,
      uid: ctx.uid,
      account: ctx.uid,
      loginCookie: ctx.cookie,
      loginTime: new Date(),
      avatar: ctx.avatar ?? '',
      nickname: ctx.nickname ?? `xianyu_${ctx.uid.slice(-6)}`,
      groupId,
      status: AccountStatus.USABLE,
    });
    return created;
  }

  /**
   * 发布商品。
   *
   * 注意：闲鱼发布通常要求图片是淘系 CDN 的 imageId（h5 上传得到），不能直接吃外链 URL。
   * 如果传入的是外链，闲鱼网关会返回 `FAIL_BIZ_PIC_NEED_UPLOAD`。这种情况下调用方
   * 需要先把图片上传到淘系 CDN（通过 mtop.taobao.litegw.image.upload 或主进程
   * 用 BrowserWindow 复用页面 fetch 上传），拿到 imageId 后再调本接口。
   */
  async publishItem(
    accountId: string,
    dto: CreateXianyuItemDto,
  ): Promise<XianyuItem> {
    const account = await this.requireUsableAccount(accountId);

    if (!dto.imgUrlList?.length) {
      throw new BadRequestException('imgUrlList 不能为空');
    }
    if (dto.imgUrlList.length > 9) {
      throw new BadRequestException('imgUrlList 最多 9 张');
    }
    if (dto.price === undefined && dto.reservePrice === undefined) {
      throw new BadRequestException('price 与 reservePrice 不能同时为空');
    }

    /*
     * mtop.idle.user.publish.publish 的字段名以闲鱼网页 F12 抓包为准。
     * 已知必填：title / content / images / price / stuffStatus
     * 已知可选：reservePrice / freeShipping / catId / fishpondId / videoId
     *
     * NOTE: images 在闲鱼真实接口里期望的是 imageId 数组；外链图需要先经过
     * 淘系 CDN 上传。本骨架先按外链传过去，让后端报 PIC_NEED_UPLOAD 给上层
     * 触发上传逻辑（待补）。
     */
    const requestBody: Record<string, unknown> = {
      version: '4.0',
      images: dto.imgUrlList,
      title: dto.title,
      content: dto.desc ?? '',
      stuffStatus: dto.stuffStatus ?? 2,
      freeShipping: dto.freeShipping ?? false,
    };
    if (dto.price !== undefined) requestBody.price = dto.price;
    if (dto.reservePrice !== undefined)
      requestBody.reservePrice = dto.reservePrice;
    if (dto.catId !== undefined) requestBody.catId = dto.catId;
    if (dto.fishpondId !== undefined) requestBody.fishpondId = dto.fishpondId;
    if (dto.videoUrl) requestBody.videoUrl = dto.videoUrl;

    type PublishResp = { itemId: string; status?: XianyuItem['status'] };
    const { data, updatedCookie } = await this.callMtopForAccount<PublishResp>(
      account,
      {
        ...XIANYU_API.publishItem,
        data: requestBody,
      },
    );
    await this.persistUpdatedCookie(account, updatedCookie);

    if (!data?.itemId) {
      throw new BadRequestException('闲鱼发布响应缺少 itemId');
    }

    return {
      itemId: data.itemId,
      title: dto.title,
      desc: dto.desc,
      price: dto.price ?? dto.reservePrice ?? 0,
      reservePrice: dto.reservePrice,
      stuffStatus: dto.stuffStatus,
      imageUrls: dto.imgUrlList,
      videoUrl: dto.videoUrl,
      status: data.status ?? 'on_sale',
      workLink: `https://www.goofish.com/item?id=${data.itemId}`,
      publishTime: new Date(),
    };
  }

  async deleteItem(accountId: string, itemId: string): Promise<boolean> {
    const account = await this.requireUsableAccount(accountId);
    const { updatedCookie } = await this.callMtopForAccount(account, {
      ...XIANYU_API.deleteItem,
      data: { itemId },
    });
    await this.persistUpdatedCookie(account, updatedCookie);
    return true;
  }

  async listItems(
    filter: XianyuItemFilterDto,
  ): Promise<{ list: XianyuItem[]; total: number }> {
    const account = await this.requireUsableAccount(filter.accountId);
    type ListResp = {
      itemList: Array<{
        id: string;
        title: string;
        price?: { number?: number; text?: string };
        priceInfo?: { price?: number };
        picUrlList?: string[];
        videoUrl?: string;
        status?: XianyuItem['status'];
        gmtCreate?: number;
      }>;
      total?: number;
    };
    const { data, updatedCookie } = await this.callMtopForAccount<ListResp>(
      account,
      {
        ...XIANYU_API.listMyItems,
        data: {
          rowsPerPage: filter.pageSize ?? 20,
          currentPage: filter.page ?? 1,
          ...(filter.status ? { status: filter.status } : {}),
        },
      },
    );
    await this.persistUpdatedCookie(account, updatedCookie);

    const items: XianyuItem[] = (data?.itemList ?? []).map((it) => ({
      itemId: it.id,
      title: it.title,
      // 闲鱼有时把价格放 price.number，有时放 priceInfo.price，全都兜底
      price: it.priceInfo?.price ?? it.price?.number ?? 0,
      imageUrls: it.picUrlList ?? [],
      videoUrl: it.videoUrl,
      status: it.status ?? 'on_sale',
      workLink: `https://www.goofish.com/item?id=${it.id}`,
      publishTime: it.gmtCreate ? new Date(it.gmtCreate) : undefined,
    }));
    return { list: items, total: data?.total ?? items.length };
  }

  /**
   * 校验 Cookie 是否仍有效。失败时把账号置为 DISABLE。
   *
   * 同时这次调用还顺带刷新了 _m_h5_tk —— 因为 mtop 网关在 token 缺失或
   * 过期时会主动 Set-Cookie 一个新的，client 已经把它合并进 updatedCookie。
   */
  async checkLoginStatus(accountId: string): Promise<boolean> {
    const account = await this.accountModel.findOne({ id: Number(accountId) });
    if (!account || !account.loginCookie) return false;

    try {
      const { updatedCookie } = await this.callMtopForAccount(account, {
        ...XIANYU_API.whoami,
        data: {},
      });
      await this.persistUpdatedCookie(account, updatedCookie);
      // 业务调用成功 == cookie 有效
      return true;
    } catch (err) {
      if (err instanceof MtopTokenError) {
        await this.accountModel.updateOne(
          { id: account.id },
          { status: AccountStatus.DISABLE },
        );
        return false;
      }
      // 业务错误也认为 cookie 还活着（只是接口本身报错），但记 warn
      this.logger.warn(
        `[xianyu] checkLoginStatus(${accountId}) error: ${(err as Error).message}`,
      );
      return err instanceof MtopBusinessError; // mtop 业务错说明网关是接受了 cookie 的
    }
  }

  /* ---------------------- 私有：mtop / 账号工具 ---------------------- */

  private async callMtopForAccount<T>(
    account: Account,
    req: { api: string; version: string; data: Record<string, unknown> },
  ): Promise<{ data: T; updatedCookie?: string }> {
    try {
      return await callMtop<T>(
        this.httpService,
        { cookie: account.loginCookie },
        req,
        { logger: this.logger },
      );
    } catch (err) {
      if (err instanceof MtopTokenError) {
        // token 真的不可恢复，cookie 已废
        await this.accountModel.updateOne(
          { id: account.id },
          { status: AccountStatus.DISABLE },
        );
        throw new BadRequestException(
          `xianyu cookie expired, please re-login: ${account.id}`,
        );
      }
      if (err instanceof MtopBusinessError) {
        throw new BadRequestException(err.message);
      }
      if (err instanceof MtopNetworkError) {
        // 网络层错误抛 5xx 让上层重试
        throw err;
      }
      throw err;
    }
  }

  private async persistUpdatedCookie(
    account: Account,
    updatedCookie: string | undefined,
  ): Promise<void> {
    if (!updatedCookie || updatedCookie === account.loginCookie) return;
    await this.accountModel.updateOne(
      { id: account.id },
      { loginCookie: updatedCookie },
    );
  }

  private async requireUsableAccount(accountId: string): Promise<Account> {
    const account = await this.accountModel.findOne({ id: Number(accountId) });
    if (!account) {
      throw new BadRequestException(`xianyu account not found: ${accountId}`);
    }
    if (account.type !== AccountType.XIANYU) {
      throw new BadRequestException(
        `account ${accountId} is not a xianyu account`,
      );
    }
    if (account.status === AccountStatus.DISABLE || !account.loginCookie) {
      throw new BadRequestException(
        `xianyu cookie expired, please re-login: ${accountId}`,
      );
    }
    return account;
  }
}
