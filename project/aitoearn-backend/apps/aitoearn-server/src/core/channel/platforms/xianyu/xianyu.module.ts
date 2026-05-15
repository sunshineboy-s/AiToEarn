import { Module } from '@nestjs/common'
import { XianyuService } from './xianyu.service'

@Module({
  providers: [XianyuService],
  exports: [XianyuService],
})
export class XianyuModule {}
