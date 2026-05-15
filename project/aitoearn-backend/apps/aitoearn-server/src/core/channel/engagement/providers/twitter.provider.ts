import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * Twitter / X Engagement Provider — skeleton.
 *
 * X API v2 supports tweet lookup and reply creation, but the Free tier
 * heavily rate-limits everything except basic tweet posting. Real impl
 * will route through `TwitterService` and require Basic+ tier.
 */
@Injectable()
export class TwitterEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'twitter'
  protected readonly logger = new Logger(TwitterEngagementProvider.name)
  protected readonly unsupportedReason
    = 'X API v2 reply endpoints require Basic tier; not provisioned'
}
