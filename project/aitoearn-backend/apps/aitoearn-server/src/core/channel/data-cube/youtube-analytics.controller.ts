import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { AccountType } from '@yikart/aitoearn-server-client'
import { ApiDoc, AppException, ResponseCode } from '@yikart/common'
import { RelayAccountException } from '../../relay/relay-account.exception'
import { ChannelAccountService } from '../platforms/channel-account.service'
import {
  YoutubeAnalyticsCountryBreakdownDto,
  YoutubeAnalyticsWindowDto,
} from './youtube-analytics.dto'
import { YoutubeDataService } from './youtube-data.service'

/**
 * YouTube-specific Analytics endpoints.
 *
 * Exposes the four richer surfaces added to YoutubeDataService in PR #16
 * (audience demographics, country breakdown, traffic sources, retention)
 * over HTTP. The five DataCubeBase methods stay on /channel/dataCube/*
 * because they are the unified contract every platform implements;
 * these four are YouTube-only and would not make sense on the unified
 * controller.
 *
 * When RFC 0001 §6.3 introduces a richer cross-platform adapter, this
 * controller may collapse back into /channel/dataCube/*. Keeping it
 * separate now avoids polluting the generic controller with platform
 * leakage and keeps the surface independently revertable.
 *
 * Auth: same TokenInfo contract as the rest of the data-cube layer.
 * Account-type guard: enforced at controller level so a non-YouTube
 * accountId returns DataCubeAccountTypeNotSupported instead of an
 * opaque OAuth scope error from Google.
 */
@ApiTags('Data/YoutubeAnalytics')
@Controller('channel/youtubeAnalytics')
export class YoutubeAnalyticsController {
  constructor(
    private readonly channelAccountService: ChannelAccountService,
    private readonly youtubeDataService: YoutubeDataService,
  ) {}

  /**
   * Validates that `accountId` is a YouTube account and not behind a
   * relay. Mirrors the helper in DataCubeController so the error
   * surface is consistent across the two controllers.
   */
  private async requireYoutubeAccount(accountId: string): Promise<void> {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (!account)
      throw new AppException(ResponseCode.ChannelAccountNotFound)
    if (account.relayAccountRef) {
      throw new RelayAccountException(account.relayAccountRef, accountId)
    }
    if (account.type !== AccountType.YOUTUBE) {
      throw new AppException(ResponseCode.DataCubeAccountTypeNotSupported)
    }
  }

  private resolveWindow(window: YoutubeAnalyticsWindowDto):
    | { startDate: string, endDate: string }
    | undefined {
    if (!window.startDate || !window.endDate)
      return undefined
    return { startDate: window.startDate, endDate: window.endDate }
  }

  @ApiDoc({
    summary: 'YouTube — Audience demographics (age × gender breakdown)',
  })
  @Get('/audienceDemographics/:accountId')
  async getAudienceDemographics(
    @GetToken() _token: TokenInfo,
    @Param('accountId') accountId: string,
    @Query() window: YoutubeAnalyticsWindowDto,
  ) {
    await this.requireYoutubeAccount(accountId)
    return this.youtubeDataService.getAudienceDemographics(
      accountId,
      this.resolveWindow(window),
    )
  }

  @ApiDoc({
    summary: 'YouTube — Top countries by views',
  })
  @Get('/countryBreakdown/:accountId')
  async getCountryBreakdown(
    @GetToken() _token: TokenInfo,
    @Param('accountId') accountId: string,
    @Query() query: YoutubeAnalyticsCountryBreakdownDto,
  ) {
    await this.requireYoutubeAccount(accountId)
    return this.youtubeDataService.getCountryBreakdown(
      accountId,
      this.resolveWindow(query),
      query.maxResults,
    )
  }

  @ApiDoc({
    summary: 'YouTube — Traffic source breakdown',
  })
  @Get('/trafficSources/:accountId')
  async getTrafficSources(
    @GetToken() _token: TokenInfo,
    @Param('accountId') accountId: string,
    @Query() window: YoutubeAnalyticsWindowDto,
  ) {
    await this.requireYoutubeAccount(accountId)
    return this.youtubeDataService.getTrafficSources(
      accountId,
      this.resolveWindow(window),
    )
  }

  @ApiDoc({
    summary: 'YouTube — Audience retention curve for a single video',
  })
  @Get('/videoRetention/:accountId/:videoId')
  async getVideoRetention(
    @GetToken() _token: TokenInfo,
    @Param('accountId') accountId: string,
    @Param('videoId') videoId: string,
    @Query() window: YoutubeAnalyticsWindowDto,
  ) {
    await this.requireYoutubeAccount(accountId)
    return this.youtubeDataService.getVideoRetention(
      accountId,
      videoId,
      this.resolveWindow(window),
    )
  }
}
