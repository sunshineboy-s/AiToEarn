import { Module } from '@nestjs/common'
import { XhsController } from './xhs.controller'
import { XhsService } from './xhs.service'

/**
 * Hosts the XHS Playwright service + REST controller. The BullMQ consumer
 * lives in `workers/automation.module.ts` and depends on this module's
 * exported XhsService.
 */
@Module({
  controllers: [XhsController],
  providers: [XhsService],
  exports: [XhsService],
})
export class XhsModule {}
