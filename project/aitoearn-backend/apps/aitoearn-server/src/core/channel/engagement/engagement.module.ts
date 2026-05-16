import { Module } from '@nestjs/common'
import { BilibiliModule } from '../platforms/bilibili/bilibili.module'
import { ChannelSharedModule } from '../platforms/channel-shared.module'
import { DouyinModule } from '../platforms/douyin/douyin.module'
import { MetaModule } from '../platforms/meta/meta.module'
import { TiktokModule } from '../platforms/tiktok/tiktok.module'
import { YoutubeModule } from '../platforms/youtube/youtube.module'
import { EngagementController } from './engagement.controller'
import { EngagementRecordService } from './engagement.record.service'
import { EngagementService } from './engagement.service'
import { BilibiliEngagementProvider } from './providers/bilibili.provider'
import { DouyinEngagementProvider } from './providers/douyin.provider'
import { FacebookEngagementProvider } from './providers/facebook.provider'
import { InstagramEngagementProvider } from './providers/instagram.provider'
import { ThreadsEngagementProvider } from './providers/threads.provider'
import { TiktokEngagementProvider } from './providers/tiktok.provider'
import { XiaohongshuEngagementProvider } from './providers/xiaohongshu.provider'
import { YoutubeEngagementProvider } from './providers/youtube.provider'
import { EngagementTaskDistributionConsumer } from './workers/distribute-engagement-task.consumer'
import { EngagementReplyToCommentConsumer } from './workers/reply-to-comment.consumer'

@Module({
  imports: [
    ChannelSharedModule,
    BilibiliModule,
    DouyinModule,
    MetaModule,
    TiktokModule,
    YoutubeModule,
  ],
  controllers: [EngagementController],
  providers: [
    BilibiliEngagementProvider,
    DouyinEngagementProvider,
    FacebookEngagementProvider,
    InstagramEngagementProvider,
    ThreadsEngagementProvider,
    TiktokEngagementProvider,
    XiaohongshuEngagementProvider,
    YoutubeEngagementProvider,
    EngagementService,
    EngagementRecordService,
    EngagementTaskDistributionConsumer,
    EngagementReplyToCommentConsumer,
  ],
  exports: [
    BilibiliEngagementProvider,
    DouyinEngagementProvider,
    FacebookEngagementProvider,
    InstagramEngagementProvider,
    ThreadsEngagementProvider,
    TiktokEngagementProvider,
    XiaohongshuEngagementProvider,
    YoutubeEngagementProvider,
    EngagementService,
    EngagementRecordService,
    EngagementTaskDistributionConsumer,
    EngagementReplyToCommentConsumer,
  ],
})
export class EngagementModule {}
