import { Module } from '@nestjs/common'
import { DouyinModule } from '../douyin/douyin.module'
import { XhsAutomationConsumer } from './xhs.consumer'
import { XhsController } from './xhs.controller'
import { XhsService } from './xhs.service'

@Module({
  imports: [DouyinModule],
  controllers: [XhsController],
  providers: [XhsService, XhsAutomationConsumer],
  exports: [XhsService],
})
export class XhsModule {}
