import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * Kuaishou (KWAI) Engagement Provider — skeleton.
 *
 * Kuaishou Open Platform offers media publish APIs but does not yet
 * expose comment management for third-party apps. Once their
 * `comment.list` / `comment.reply` endpoints are GA'd this stub is
 * replaced with a real impl over `KwaiService`.
 */
@Injectable()
export class KwaiEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'KWAI'
  protected readonly logger = new Logger(KwaiEngagementProvider.name)
  protected readonly unsupportedReason
    = 'Kuaishou Open Platform comment endpoints not generally available'
}
