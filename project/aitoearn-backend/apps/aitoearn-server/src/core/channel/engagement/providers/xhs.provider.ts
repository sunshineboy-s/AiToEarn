import { Injectable, Logger } from '@nestjs/common'
import { BaseUnsupportedEngagementProvider } from './unsupported.provider'

/**
 * Xiaohongshu Engagement Provider — skeleton.
 *
 * XHS has no public Open Platform. The realistic backend is one of:
 *   1. Cookie-mode HTTP scrape (matches MediaCrawler approach)
 *   2. Browser worker driven via Playwright
 *
 * Both touch RFC 0001 §6.2 (`BrowserAutomationModule`) and need their
 * own RFC for legal/anti-abuse review. Until then, this stub keeps the
 * engagement controller responding cleanly.
 */
@Injectable()
export class XhsEngagementProvider extends BaseUnsupportedEngagementProvider {
  protected readonly platform = 'xhs'
  protected readonly logger = new Logger(XhsEngagementProvider.name)
  protected readonly unsupportedReason
    = 'Xiaohongshu has no Open Platform; cookie/browser fallback pending RFC'
}
