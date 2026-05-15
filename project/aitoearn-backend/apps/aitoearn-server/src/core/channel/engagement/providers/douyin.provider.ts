import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * Douyin Engagement Provider — skeleton.
 *
 * Douyin Open Platform exposes both reads (`item/comment/list`) and
 * writes (`item/comment/reply`), but they are scope-gated. Once the
 * scopes are granted on the corp app, this stub is replaced with a
 * real implementation backed by `DouyinService`.
 */
@Injectable()
export class DouyinEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'douyin'
  protected readonly logger = new Logger(DouyinEngagementProvider.name)
  protected readonly unsupportedReason
    = 'Douyin Open Platform comment scopes not yet provisioned'
}
