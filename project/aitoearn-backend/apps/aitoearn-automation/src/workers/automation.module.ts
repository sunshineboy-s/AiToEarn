import { Module } from '@nestjs/common'
import { AutomationDispatcherConsumer } from './automation.consumer'
import { DouyinModule } from './douyin/douyin.module'
import { XhsModule } from './xhs/xhs.module'

/**
 * Hosts the BullMQ consumer that fans engagement_automation_action jobs out
 * to per-platform Playwright workers. Each platform module exports its
 * service; the consumer reads `job.data.platform` and dispatches.
 */
@Module({
  imports: [XhsModule, DouyinModule],
  providers: [AutomationDispatcherConsumer],
  exports: [AutomationDispatcherConsumer],
})
export class AutomationModule {}
