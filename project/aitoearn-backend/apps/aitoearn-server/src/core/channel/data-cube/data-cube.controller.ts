import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { AccountType } from '@yikart/aitoearn-server-client'
import { ApiDoc, AppException, ResponseCode } from '@yikart/common'
import { RelayAccountException } from '../../relay/relay-account.exception'
import { ChannelAccountService } from '../platforms/channel-account.service'
import { BilibiliDataService } from './bilibili-data.service'
import { DataCubeBase } from './data.base'
import { DouyinDataService } from './douyin-data.service'
import { InstagramDataService } from './instagram.service'
import { TiktokDataService } from './tiktok-data.service'
import { WxGzhDataService } from './wx-gzh-data.service'
import { XhsDataService } from './xhs-data.service'
import { YoutubeDataService } from './youtube-data.service'

@ApiTags('Data/DataCube')
@Controller('channel/dataCube')
export class DataCubeController {
  private readonly dataCubeMap = new Map<AccountType, DataCubeBase>()

  constructor(
    readonly channelAccountService: ChannelAccountService,
    readonly bilibiliDataService: BilibiliDataService,
    readonly douyinDataService: DouyinDataService,
    readonly instagramDataService: InstagramDataService,
    readonly tiktokDataService: TiktokDataService,
    readonly xhsDataService: XhsDataService,
    readonly youtubeDataService: YoutubeDataService,
    readonly wxGzhDataService: WxGzhDataService,
  ) {
    this.dataCubeMap.set(AccountType.BILIBILI, bilibiliDataService)
    this.dataCubeMap.set(AccountType.Douyin, douyinDataService)
    this.dataCubeMap.set(AccountType.INSTAGRAM, instagramDataService)
    this.dataCubeMap.set(AccountType.TIKTOK, tiktokDataService)
    this.dataCubeMap.set(AccountType.Xhs, xhsDataService)
    this.dataCubeMap.set(AccountType.YOUTUBE, youtubeDataService)
    this.dataCubeMap.set(AccountType.WxGzh, wxGzhDataService)
  }

  private async getDataCube(accountId: string) {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (!account)
      throw new AppException(ResponseCode.ChannelAccountNotFound)
    if (account.relayAccountRef) {
      throw new RelayAccountException(account.relayAccountRef, accountId)
    }
    const dataCube = this.dataCubeMap.get(account.type)
    if (!dataCube)
      throw new AppException(ResponseCode.DataCubeAccountTypeNotSupported)
    return dataCube
  }

  @ApiDoc({
    summary: 'Get Account Data Cube',
  })
  @Get('/accountDataCube/:accountId')
  async getAccountDataCube(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getDataCube(accountId)
    return await dataCube.getAccountDataCube(accountId)
  }

  @ApiDoc({
    summary: 'Get Account Data Bulk',
  })
  @Get('/getAccountDataBulk/:accountId')
  async getAccountDataBulk(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getDataCube(accountId)
    return await dataCube.getAccountDataBulk(accountId)
  }

  @ApiDoc({
    summary: 'Get Post Data Cube',
  })
  @Get('/getArcDataCube/:accountId/:dataId')
  async getArcDataCube(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
    @Param('dataId') dataId: string,
  ) {
    const dataCube = await this.getDataCube(accountId)
    return await dataCube.getArcDataCube(accountId, dataId)
  }

  @ApiDoc({
    summary: 'Get Post Data Bulk',
  })
  @Get('/getArcDataBulk/:accountId/:dataId')
  async getArcDataBulk(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
    @Param('dataId') dataId: string,
  ) {
    const dataCube = await this.getDataCube(accountId)
    return await dataCube.getArcDataBulk(accountId, dataId)
  }

  // ── YouTube-specific deep analytics ────────────────────────────────
  // 这些端点只对 YouTube 账号有效；其他平台调用会返回
  // DataCubeAccountTypeNotSupported（路由层不强制白名单，方便未来扩展到
  // 别的有等价 Analytics API 的平台）。

  private async getYoutubeDataCube(accountId: string): Promise<YoutubeDataService> {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (!account)
      throw new AppException(ResponseCode.ChannelAccountNotFound)
    if (account.relayAccountRef) {
      throw new RelayAccountException(account.relayAccountRef, accountId)
    }
    if (account.type !== AccountType.YOUTUBE) {
      throw new AppException(ResponseCode.DataCubeAccountTypeNotSupported)
    }
    return this.youtubeDataService
  }

  @ApiDoc({
    summary: 'YouTube Audience Demographics (age × gender)',
  })
  @Get('/youtube/audienceDemographics/:accountId')
  async youtubeAudienceDemographics(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getYoutubeDataCube(accountId)
    return await dataCube.getAudienceDemographics(accountId)
  }

  @ApiDoc({
    summary: 'YouTube Traffic Sources (search / suggested / external / ...)',
  })
  @Get('/youtube/trafficSources/:accountId')
  async youtubeTrafficSources(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getYoutubeDataCube(accountId)
    return await dataCube.getTrafficSources(accountId)
  }

  @ApiDoc({
    summary: 'YouTube Device Types (mobile / desktop / TV / tablet)',
  })
  @Get('/youtube/deviceTypes/:accountId')
  async youtubeDeviceTypes(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getYoutubeDataCube(accountId)
    return await dataCube.getDeviceTypes(accountId)
  }

  @ApiDoc({
    summary: 'YouTube Audience Retention curve (per video)',
  })
  @Get('/youtube/videoRetention/:accountId/:videoId')
  async youtubeVideoRetention(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
    @Param('videoId') videoId: string,
  ) {
    const dataCube = await this.getYoutubeDataCube(accountId)
    return await dataCube.getVideoRetention(accountId, videoId)
  }

  // ── Instagram-specific deep analytics ──────────────────────────────
  // 同样仅对 IG 账号有效，路由级硬绑定到 AccountType.INSTAGRAM。

  private async getInstagramDataCube(accountId: string): Promise<InstagramDataService> {
    const account = await this.channelAccountService.getAccountInfo(accountId)
    if (!account)
      throw new AppException(ResponseCode.ChannelAccountNotFound)
    if (account.relayAccountRef) {
      throw new RelayAccountException(account.relayAccountRef, accountId)
    }
    if (account.type !== AccountType.INSTAGRAM) {
      throw new AppException(ResponseCode.DataCubeAccountTypeNotSupported)
    }
    return this.instagramDataService
  }

  @ApiDoc({
    summary: 'Instagram Audience Demographics (age × gender, last 30 days)',
  })
  @Get('/instagram/audienceDemographics/:accountId')
  async instagramAudienceDemographics(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getInstagramDataCube(accountId)
    return await dataCube.getAudienceDemographics(accountId)
  }

  @ApiDoc({
    summary: 'Instagram Engaged Audience by Country (last 30 days)',
  })
  @Get('/instagram/audienceByCountry/:accountId')
  async instagramAudienceByCountry(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getInstagramDataCube(accountId)
    return await dataCube.getAudienceByCountry(accountId)
  }

  @ApiDoc({
    summary: 'Instagram Engaged Audience by City (top, last 30 days)',
  })
  @Get('/instagram/audienceByCity/:accountId')
  async instagramAudienceByCity(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getInstagramDataCube(accountId)
    return await dataCube.getAudienceByCity(accountId)
  }

  @ApiDoc({
    summary: 'Instagram Follows / Unfollows breakdown (last 30 days)',
  })
  @Get('/instagram/followsBreakdown/:accountId')
  async instagramFollowsBreakdown(
    @GetToken() token: TokenInfo,
    @Param('accountId') accountId: string,
  ) {
    const dataCube = await this.getInstagramDataCube(accountId)
    return await dataCube.getFollowsBreakdown(accountId)
  }
}
