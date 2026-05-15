import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { BaseUnsupportedDataCubeService } from './unsupported.base'

/**
 * WeChat 视频号 (Channels) data-cube — skeleton.
 *
 * As of 2026-05, WeChat Channels has NO open data API for third-party
 * apps. The only viable path is the Electron client scraping the
 * creator-portal Web pages with a logged-in cookie session — same
 * mechanism AiToEarn-electron already uses for publish.
 *
 * This service exists so that `AccountType.WxSph` routes resolve in
 * the data-cube controller. A real backend belongs in a
 * `WxSphAnalyticsScraper` (RFC 0001 §6.2) — out of scope here.
 */
@Injectable()
export class WxSphDataService extends BaseUnsupportedDataCubeService {
  protected readonly platform = 'wxSph'
  protected readonly logger = new Logger(WxSphDataService.name)
  protected readonly unsupportedReason
    = 'WeChat Channels has no Open Platform; cookie-scrape fallback pending RFC'

  @OnEvent(`account.create.${AccountType.WxSph}`)
  override async accountPortraitReport(accountId: string): Promise<void> {
    return super.accountPortraitReport(accountId)
  }
}
