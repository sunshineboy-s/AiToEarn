import { Module } from '@nestjs/common'
import { XhsAutomationConsumer } from './xhs.consumer'
import { XhsController } from './xhs.controller'
import { XhsService } from './xhs.service'

@Module({
  controllers: [XhsController],
  providers: [XhsService, XhsAutomationConsumer],
  exports: [XhsService],
})
export class XhsModule {}
