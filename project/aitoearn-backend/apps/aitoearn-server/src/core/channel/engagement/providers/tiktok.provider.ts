import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * TikTok Engagement Provider — skeleton.
 *
 * TikTok Display API (`/v2/user/info/`, `/v2/video/list/`) covers reads
 * for own posts; the comment-list and comment-write endpoints are part
 * of TikTok Research API which requires academic-institution gating.
 *
 * For now we wire the route so the engagement controller no longer
 * "provider not found" 500s on TikTok accounts. Read/write methods
 * stay unsupported per RFC 0001 §7.
 */
@Injectable()
export class TiktokEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'tiktok'
  protected readonly logger = new Logger(TiktokEngagementProvider.name)
  protected readonly unsupportedReason
    = 'TikTok comment endpoints require Research API access'
}
