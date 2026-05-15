import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * Pinterest Engagement Provider — skeleton.
 *
 * Pinterest API v5 does NOT expose a public comments endpoint. Engagement
 * surface area on Pinterest is limited to follows/saves, which our
 * `EngagementProvider` interface doesn't model yet. This stub keeps the
 * route resolvable; an RFC update is needed to extend the interface.
 */
@Injectable()
export class PinterestEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'pinterest'
  protected readonly logger = new Logger(PinterestEngagementProvider.name)
  protected readonly unsupportedReason
    = 'Pinterest API v5 does not expose comment endpoints'
}
