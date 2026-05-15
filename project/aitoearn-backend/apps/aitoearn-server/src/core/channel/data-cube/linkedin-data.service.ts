import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { BaseUnsupportedDataCubeService } from './unsupported.base'

/**
 * LinkedIn data-cube — skeleton.
 *
 * LinkedIn's `organizationalEntityFollowerStatistics` and
 * `organizationalEntityShareStatistics` cover account- and post-level
 * metrics but require partner-program approval. Real impl will route
 * through `LinkedinService` once the app is reviewed.
 */
@Injectable()
export class LinkedinDataService extends BaseUnsupportedDataCubeService {
  protected readonly platform = 'linkedin'
  protected readonly logger = new Logger(LinkedinDataService.name)
  protected readonly unsupportedReason
    = 'LinkedIn analytics endpoints require partner-program approval'

  @OnEvent(`account.create.${AccountType.LINKEDIN}`)
  override async accountPortraitReport(accountId: string): Promise<void> {
    return super.accountPortraitReport(accountId)
  }
}
