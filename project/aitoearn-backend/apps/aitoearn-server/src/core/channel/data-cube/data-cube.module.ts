import { Module } from '@nestjs/common'
import { PinterestDataService } from '../data-cube/pinterest-data.service'
import { BilibiliModule } from '../platforms/bilibili/bilibili.module'
import { ChannelSharedModule } from '../platforms/channel-shared.module'
import { KwaiModule } from '../platforms/kwai/kwai.module'
import { MetaModule } from '../platforms/meta/meta.module'
import { PinterestModule } from '../platforms/pinterest/pinterest.module'
import { WxPlatModule } from '../platforms/wx-plat/wx-plat.module'
import { XiaohongshuModule } from '../platforms/xiaohongshu/xiaohongshu.module'
import { YoutubeModule } from '../platforms/youtube/youtube.module'
import { BilibiliDataService } from './bilibili-data.service'
import { DataCubeController } from './data-cube.controller'
import { FacebookDataService } from './facebook-data.service'
import { InstagramDataService } from './instagram.service'
import { KwaiDataService } from './kwai-data.service'
import { ThreadsDataService } from './threads.service'
import { WxGzhDataService } from './wx-gzh-data.service'
import { XhsDataService } from './xhs-data.service'
import { YoutubeDataService } from './youtube-data.service'

@Module({
  imports: [ChannelSharedModule, BilibiliModule, MetaModule, YoutubeModule, WxPlatModule, PinterestModule, KwaiModule, XiaohongshuModule],
  controllers: [DataCubeController],
  providers: [BilibiliDataService, FacebookDataService, InstagramDataService, ThreadsDataService, YoutubeDataService, WxGzhDataService, PinterestDataService, KwaiDataService, XhsDataService],
  exports: [BilibiliDataService, FacebookDataService, InstagramDataService, ThreadsDataService, YoutubeDataService, WxGzhDataService, PinterestDataService, KwaiDataService, XhsDataService],
})
export class DataCubeModule {}
