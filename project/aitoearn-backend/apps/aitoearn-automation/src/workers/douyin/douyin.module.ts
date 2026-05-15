import { Module } from '@nestjs/common'
import { DouyinService } from './douyin.service'

/**
 * Module wrapper for the Douyin worker. Exports the service so the unified
 * automation consumer can route `platform: 'douyin'` jobs into it.
 */
@Module({
  providers: [DouyinService],
  exports: [DouyinService],
})
export class DouyinModule {}
