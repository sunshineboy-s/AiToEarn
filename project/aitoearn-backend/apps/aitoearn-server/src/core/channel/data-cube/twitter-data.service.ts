import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { BaseUnsupportedDataCubeService } from './unsupported.base'

/**
 * Twitter / X data-cube — skeleton.
 *
 * X API v2 `users/me` and `tweets/:id` cover follower / view / like /
 * reply counts, but Free-tier limits make them unusable for an
 * analytics product. Real impl gates behind Basic+ tier.
 */
@Injectable()
export class TwitterDataService extends BaseUnsupportedDataCubeService {
  protected readonly platform = 'twitter'
  protected readonly logger = new Logger(TwitterDataService.name)
  protected readonly unsupportedReason
    = 'X API v2 metrics endpoints rate-limited on Free tier; not provisioned'

  @OnEvent(`account.create.${AccountType.TWITTER}`)
  override async accountPortraitReport(accountId: string): Promise<void> {
    return super.accountPortraitReport(accountId)
  }
}
