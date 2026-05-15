/*
 * 闲鱼（咸鱼 / Goofish）平台 Service —— Electron 桌面端 Cookie 注入版本。
 *
 * 与其他平台 OAuth 路径（B站、TikTok、YouTube、Twitter）不同，闲鱼对个人
 * 用户没有公开发布 API，所以本 Service 的所有写操作都依赖：
 *
 *   1. 用户已经在主进程的登录 BrowserWindow 完成扫码 / 账密登录；
 *   2. 我们已把 Cookie 字符串保存到 Account 文档的 loginCookie 字段。
 *
 * 在此 Service 中，我们只负责：
 *   - 从 Account 取出 cookie；
 *   - 构造请求头并调用 goofish.com 内部接口（签名细节占位为 TODO）；
 *   - 失败时上抛清晰的错误，不在本层做重试。
 *
 * 签名（h5api 的 sign）和实际接口路径会随闲鱼版本变化，需在主进程
 * 抓包获得后填入此处。仓库 demo/xhs/signature.js 是同思路的小红书示例。
 */

import { BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { firstValueFrom } from 'rxjs';
import { Model } from 'mongoose';

import { Account, AccountStatus, AccountType } from 'src/db/schema/account.schema';
import { CreateXianyuItemDto, XianyuItemFilterDto } from './dto/xianyu.dto';
import { XianyuItem, XianyuLoginContext } from './comment';

const XIANYU_H5_API = 'https://h5api.m.goofish.com/h5';

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
  async upsertCookieAccount(userId: string, ctx: XianyuLoginContext, groupId: number): Promise<Account> {
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
   * 发布商品。当前为骨架实现：
   *  - 校验账号存在且 cookie 未失效；
   *  - 调用 mtop.idle.user.publish.publish（占位，需要补 sign）；
   *  - 失败后把账号标记为 cookie 失效。
   */
  async publishItem(accountId: string, dto: CreateXianyuItemDto): Promise<XianyuItem> {
    const account = await this.requireUsableAccount(accountId);
    void account;

    if (!dto.imgUrlList?.length) {
      throw new BadRequestException('imgUrlList 不能为空');
    }
    if (dto.imgUrlList.length > 9) {
      throw new BadRequestException('imgUrlList 最多 9 张');
    }
    if (dto.price === undefined && dto.reservePrice === undefined) {
      throw new BadRequestException('price 与 reservePrice 不能同时为空');
    }

    // TODO(xianyu): 在抓到真实接口和签名实现前，这里只把请求体准备好，并占位返回。
    // 真实实现需要：
    //   1) buildSign(t, appKey, data, token) -> sign
    //   2) POST h5api 'mtop.idle.user.publish.publish' with cookie + sign
    //   3) 解析 ret/data.itemId
    const requestBody = {
      version: '4.0',
      images: dto.imgUrlList,
      title: dto.title,
      content: dto.desc ?? '',
      price: dto.price,
      reservePrice: dto.reservePrice,
      stuffStatus: dto.stuffStatus ?? 2,
      freeShipping: dto.freeShipping ?? false,
      catId: dto.catId,
      fishpondId: dto.fishpondId,
      videoUrl: dto.videoUrl,
    };
    this.logger.log(
      `[xianyu] publishItem accountId=${accountId} title="${dto.title}" payloadKeys=${Object.keys(requestBody).join(',')}`,
    );
    throw new NotImplementedException(
      '闲鱼商品发布接口签名尚未接入；请在主进程 BrowserWindow 抓包后实现 buildSign() 并替换此处占位。',
    );
  }

  async deleteItem(accountId: string, itemId: string): Promise<boolean> {
    const account = await this.requireUsableAccount(accountId);
    void account;
    void itemId;
    throw new NotImplementedException('闲鱼商品下架接口尚未接入');
  }

  async listItems(filter: XianyuItemFilterDto): Promise<{ list: XianyuItem[]; total: number }> {
    const account = await this.requireUsableAccount(filter.accountId);
    void account;
    throw new NotImplementedException('闲鱼商品列表接口尚未接入');
  }

  /**
   * 校验 Cookie 是否仍有效。失败时把账号置为 DISABLE。
   */
  async checkLoginStatus(accountId: string): Promise<boolean> {
    const account = await this.accountModel.findOne({ id: Number(accountId) });
    if (!account) return false;

    try {
      // mtop.taobao.havana.mtopsdk.user.session.validate 占位
      const { data } = await firstValueFrom(
        this.httpService.get(`${XIANYU_H5_API}/mtop.taobao.idle.user.getuserinfo/1.0/`, {
          headers: {
            cookie: account.loginCookie,
            referer: 'https://www.goofish.com/',
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          },
          timeout: 5000,
          validateStatus: () => true,
        }),
      );
      const ret: string[] = data?.ret ?? [];
      const ok = ret.some((r) => /SUCCESS::/.test(r));
      if (!ok) {
        await this.accountModel.updateOne({ _id: account._id }, { status: AccountStatus.DISABLE });
      }
      return ok;
    } catch (err) {
      this.logger.warn(`[xianyu] checkLoginStatus failed: ${(err as Error).message}`);
      return false;
    }
  }

  private async requireUsableAccount(accountId: string): Promise<Account> {
    const account = await this.accountModel.findOne({ id: Number(accountId) });
    if (!account) {
      throw new BadRequestException(`xianyu account not found: ${accountId}`);
    }
    if (account.type !== AccountType.XIANYU) {
      throw new BadRequestException(`account ${accountId} is not a xianyu account`);
    }
    if (account.status === AccountStatus.DISABLE || !account.loginCookie) {
      throw new BadRequestException(`xianyu cookie expired, please re-login: ${accountId}`);
    }
    return account;
  }
}
