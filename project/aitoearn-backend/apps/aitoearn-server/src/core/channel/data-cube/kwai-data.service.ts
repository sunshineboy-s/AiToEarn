import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { BaseUnsupportedDataCubeService } from './unsupported.base'

/**
 * Kuaishou (KWAI) data-cube — skeleton.
 *
 * Kuaishou Open Platform exposes user/works data APIs that map cleanly
 * to ChannelAccountDataCube / ChannelArcDataCube. They're scope-gated.
 * Real impl will route through `KwaiService` once the corp app is
 * granted the `clientCredential.userInfo` and `data` scopes.
 *
 * Replaces the prior placeholder which subscribed to the wrong event
 * (`AccountType.Xhs`) and silently returned zeros.
 */
@Injectable()
export class KwaiDataService extends BaseUnsupportedDataCubeService {
  protected readonly platform = 'KWAI'
  protected readonly logger = new Logger(KwaiDataService.name)
  protected readonly unsupportedReason
    = 'Kuaishou Open Platform data scopes not yet provisioned'

  @OnEvent(`account.create.${AccountType.KWAI}`)
  override async accountPortraitReport(accountId: string): Promise<void> {
    return super.accountPortraitReport(accountId)
  }
}
