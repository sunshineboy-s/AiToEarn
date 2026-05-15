import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * LinkedIn Engagement Provider — skeleton.
 *
 * LinkedIn's `socialActions` API supports reading and creating comments
 * on UGC posts but requires `r_member_social` and `w_member_social`
 * scopes plus partner-program review. Real impl will route through
 * `LinkedinService` once partner-program approval lands.
 */
@Injectable()
export class LinkedinEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'linkedin'
  protected readonly logger = new Logger(LinkedinEngagementProvider.name)
  protected readonly unsupportedReason
    = 'LinkedIn socialActions API requires partner-program approval'
}
