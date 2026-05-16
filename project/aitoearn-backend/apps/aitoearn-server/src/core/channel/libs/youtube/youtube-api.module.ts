import { Module } from '@nestjs/common'
import { YoutubeAnalyticsService } from './youtube-analytics.service'
import { YoutubeApiService } from './youtube-api.service'

@Module({
  imports: [],
  providers: [YoutubeApiService, YoutubeAnalyticsService],
  exports: [YoutubeApiService, YoutubeAnalyticsService],
})
export class YoutubeApiModule {}
