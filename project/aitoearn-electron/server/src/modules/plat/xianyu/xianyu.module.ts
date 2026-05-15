/*
 * 闲鱼（咸鱼 / Goofish）平台模块 —— Electron 桌面端 Cookie 注入版本。
 *
 * 与其他平台不同，闲鱼对个人用户没有公开 OAuth API，因此本模块完全
 * 依赖主进程登录 BrowserWindow 抓取的 Cookie。本模块只暴露给本地后端
 * 调用，不应直接暴露给公网。
 */
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';

import { Account, AccountSchema } from 'src/db/schema/account.schema';
import { XianyuController } from './xianyu.controller';
import { XianyuService } from './xianyu.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: Account.name, schema: AccountSchema }]),
  ],
  controllers: [XianyuController],
  providers: [XianyuService],
  exports: [XianyuService],
})
export class XianyuModule {}
