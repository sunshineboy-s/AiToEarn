import { Module } from '@nestjs/common'
import { BilibiliModule } from '../platforms/bilibili/bilibili.module'
import { ChannelSharedModule } from '../platforms/channel-shared.module'
import { MetaModule } from '../platforms/meta/meta.module'
import { YoutubeModule } from '../platforms/youtube/youtube.module'
import { EngagementController } from './engagement.controller'
import { EngagementRecordService } from './engagement.record.service'
import { EngagementService } from './engagement.service'
import { BilibiliEngagementProvider } from './providers/bilibili.provider'
import { DouyinEngagementProvider } from './providers/douyin.provider'
import { FacebookEngagementProvider } from './providers/facebook.provider'
import { InstagramEngagementProvider } from './providers/instagram.provider'
import { KwaiEngagementProvider } from './providers/kwai.provider'
import { LinkedinEngagementProvider } from './providers/linkedin.provider'
import { PinterestEngagementProvider } from './providers/pinterest.provider'
import { ThreadsEngagementProvider } from './providers/threads.provider'
import { TiktokEngagementProvider } from './providers/tiktok.provider'
import { TwitterEngagementProvider } from './providers/twitter.provider'
import { WxGzhEngagementProvider } from './providers/wx-gzh.provider'
import { XhsEngagementProvider } from './providers/xhs.provider'
import { YoutubeEngagementProvider } from './providers/youtube.provider'
import { EngagementTaskDistributionConsumer } from './workers/distribute-engagement-task.consumer'
import { EngagementReplyToCommentConsumer } from './workers/reply-to-comment.consumer'

const realProviders = [
  BilibiliEngagementProvider,
  FacebookEngagementProvider,
  InstagramEngagementProvider,
  ThreadsEngagementProvider,
  YoutubeEngagementProvider,
]

const stubProviders = [
  DouyinEngagementProvider,
  KwaiEngagementProvider,
  LinkedinEngagementProvider,
  PinterestEngagementProvider,
  TiktokEngagementProvider,
  TwitterEngagementProvider,
  WxGzhEngagementProvider,
  XhsEngagementProvider,
]

@Module({
  imports: [
    BilibiliModule,
    ChannelSharedModule,
    MetaModule,
    YoutubeModule,
  ],
  controllers: [EngagementController],
  providers: [
    ...realProviders,
    ...stubProviders,
    EngagementService,
    EngagementRecordService,
    EngagementTaskDistributionConsumer,
    EngagementReplyToCommentConsumer,
  ],
  exports: [
    ...realProviders,
    ...stubProviders,
    EngagementService,
    EngagementRecordService,
    EngagementTaskDistributionConsumer,
    EngagementReplyToCommentConsumer,
  ],
})
export class EngagementModule {}
