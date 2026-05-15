import { Module } from '@nestjs/common'
import { BilibiliModule } from '../platforms/bilibili/bilibili.module'
import { ChannelSharedModule } from '../platforms/channel-shared.module'
import { DouyinModule } from '../platforms/douyin/douyin.module'
import { MetaModule } from '../platforms/meta/meta.module'
import { PinterestModule } from '../platforms/pinterest/pinterest.module'
import { TiktokModule } from '../platforms/tiktok/tiktok.module'
import { WxPlatModule } from '../platforms/wx-plat/wx-plat.module'
import { XiaohongshuModule } from '../platforms/xiaohongshu/xiaohongshu.module'
import { YoutubeModule } from '../platforms/youtube/youtube.module'
import { BilibiliDataService } from './bilibili-data.service'
import { DataCubeController } from './data-cube.controller'
import { DouyinDataService } from './douyin-data.service'
import { FacebookDataService } from './facebook-data.service'
import { GoogleBusinessDataService } from './google-business-data.service'
import { InstagramDataService } from './instagram.service'
import { KwaiDataService } from './kwai-data.service'
import { LinkedinDataService } from './linkedin-data.service'
import { PinterestDataService } from './pinterest-data.service'
import { ThreadsDataService } from './threads.service'
import { TiktokDataService } from './tiktok-data.service'
import { TwitterDataService } from './twitter-data.service'
import { WxGzhDataService } from './wx-gzh-data.service'
import { WxSphDataService } from './wx-sph-data.service'
import { XhsDataService } from './xhs-data.service'
import { YoutubeDataService } from './youtube-data.service'

const realProviders = [
  BilibiliDataService,
  DouyinDataService,
  FacebookDataService,
  InstagramDataService,
  PinterestDataService,
  ThreadsDataService,
  TiktokDataService,
  WxGzhDataService,
  XhsDataService,
  YoutubeDataService,
]

const stubProviders = [
  GoogleBusinessDataService,
  KwaiDataService,
  LinkedinDataService,
  TwitterDataService,
  WxSphDataService,
]

@Module({
  imports: [
    ChannelSharedModule,
    BilibiliModule,
    DouyinModule,
    MetaModule,
    PinterestModule,
    TiktokModule,
    WxPlatModule,
    XiaohongshuModule,
    YoutubeModule,
  ],
  controllers: [DataCubeController],
  providers: [...realProviders, ...stubProviders],
  exports: [...realProviders, ...stubProviders],
})
export class DataCubeModule {}
