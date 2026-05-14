import { Module } from '@nestjs/common'
import { XhsController } from './xhs.controller'
import { XhsService } from './xhs.service'

@Module({
  controllers: [XhsController],
  providers: [XhsService],
  exports: [XhsService],
})
export class XhsModule {}
