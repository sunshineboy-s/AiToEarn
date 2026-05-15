import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { BaseUnsupportedDataCubeService } from './unsupported.base'

/**
 * Google Business Profile data-cube — skeleton.
 *
 * Google Business Profile Performance API exposes views / searches /
 * clicks / actions per location. The metrics are POI-style
 * (impressions, direction-clicks) and don't align cleanly with the
 * creator-style ChannelAccountDataCube; mapping rules need RFC review.
 */
@Injectable()
export class GoogleBusinessDataService extends BaseUnsupportedDataCubeService {
  protected readonly platform = 'google_business'
  protected readonly logger = new Logger(GoogleBusinessDataService.name)
  protected readonly unsupportedReason
    = 'Google Business Performance metrics need POI-vs-creator mapping RFC'

  @OnEvent(`account.create.${AccountType.GOOGLE_BUSINESS}`)
  override async accountPortraitReport(accountId: string): Promise<void> {
    return super.accountPortraitReport(accountId)
  }
}
