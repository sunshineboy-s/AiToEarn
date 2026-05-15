import { Module } from '@nestjs/common'
import { ChannelSharedModule } from '../platforms/channel-shared.module'
import { MetaModule } from '../platforms/meta/meta.module'
import { TwitterModule } from '../platforms/twitter/twitter.module'
import { YoutubeModule } from '../platforms/youtube/youtube.module'
import { EngagementAutomationRpcService } from './automation/automation-rpc.service'
import { DouyinAutomationProvider } from './automation/douyin-automation.provider'
import { XhsAutomationProvider } from './automation/xhs-automation.provider'
import { BrandMonitorScanConsumer } from './brand/brand-monitor.consumer'
import { BrandMonitorController } from './brand/brand-monitor.controller'
import { BrandMonitorService } from './brand/brand-monitor.service'
import { EngagementController } from './engagement.controller'
import { EngagementRecordService } from './engagement.record.service'
import { EngagementService } from './engagement.service'
import { EngagementMiningController } from './mining/engagement-mining.controller'
import { EngagementMiningConsumer } from './mining/engagement-mining.consumer'
import { EngagementMiningService } from './mining/engagement-mining.service'
import { FacebookEngagementProvider } from './providers/facebook.provider'
import { InstagramEngagementProvider } from './providers/instagram.provider'
import { ThreadsEngagementProvider } from './providers/threads.provider'
import { TwitterEngagementProvider } from './providers/twitter.provider'
import { YoutubeEngagementProvider } from './providers/youtube.provider'
import { EngagementRateLimitGuardService } from './rate-limit-guard.service'
import { EngagementTaskDistributionConsumer } from './workers/distribute-engagement-task.consumer'
import { EngagementReplyToCommentConsumer } from './workers/reply-to-comment.consumer'

@Module({
  imports: [
    ChannelSharedModule,
    MetaModule,
    YoutubeModule,
    TwitterModule,
  ],
  controllers: [
    EngagementController,
    EngagementMiningController,
    BrandMonitorController,
  ],
  providers: [
    FacebookEngagementProvider,
    InstagramEngagementProvider,
    ThreadsEngagementProvider,
    YoutubeEngagementProvider,
    TwitterEngagementProvider,
    XhsAutomationProvider,
    DouyinAutomationProvider,
    EngagementAutomationRpcService,
    EngagementService,
    EngagementRecordService,
    EngagementMiningService,
    BrandMonitorService,
    ...EngagementRateLimitGuardService.provide(),
    EngagementTaskDistributionConsumer,
    EngagementReplyToCommentConsumer,
    EngagementMiningConsumer,
    BrandMonitorScanConsumer,
  ],
  exports: [
    FacebookEngagementProvider,
    InstagramEngagementProvider,
    ThreadsEngagementProvider,
    YoutubeEngagementProvider,
    TwitterEngagementProvider,
    XhsAutomationProvider,
    DouyinAutomationProvider,
    EngagementAutomationRpcService,
    EngagementService,
    EngagementRecordService,
    EngagementMiningService,
    BrandMonitorService,
    EngagementRateLimitGuardService,
    EngagementTaskDistributionConsumer,
    EngagementReplyToCommentConsumer,
    EngagementMiningConsumer,
    BrandMonitorScanConsumer,
  ],
})
export class EngagementModule {}
