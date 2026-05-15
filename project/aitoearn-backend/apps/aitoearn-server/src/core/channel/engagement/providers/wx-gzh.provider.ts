import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * WeChat Official Account (公众号) Engagement Provider — skeleton.
 *
 * WeChat exposes a `comment` API set for service accounts (开通了留言功能
 * 的公众号), gated by `comment_*` scopes. Real implementation will route
 * through `WxGzhService`. Until scopes are confirmed in production, this
 * stub keeps the engagement controller honest.
 */
@Injectable()
export class WxGzhEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'wxGzh'
  protected readonly logger = new Logger(WxGzhEngagementProvider.name)
  protected readonly unsupportedReason
    = 'WeChat OA comment API scopes not yet confirmed for tenant'
}
