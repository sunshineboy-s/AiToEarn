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
import { FacebookDataService } from './facebook-data.service'
import { GoogleBusinessDataService } from './google-business-data.service'
import { InstagramDataService } from './instagram.service'
import { KwaiDataService } from './kwai-data.service'
import { LinkedinDataService } from './linkedin-data.service'
import { PinterestDataService } from './pinterest-data.service'
import { ThreadsDataService } from './threads.service'
import { TiktokDataService } from './tiktok-data.service'
import { TwitterDataService } from './twitter-data.service'
import { WxGzhDataService } from './wx-gzh-data.service'
import { WxSphDataService } from './wx-sph-data.service'
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
    readonly facebookDataService: FacebookDataService,
    readonly googleBusinessDataService: GoogleBusinessDataService,
    readonly instagramDataService: InstagramDataService,
    readonly kwaiDataService: KwaiDataService,
    readonly linkedinDataService: LinkedinDataService,
    readonly pinterestDataService: PinterestDataService,
    readonly threadsDataService: ThreadsDataService,
    readonly tiktokDataService: TiktokDataService,
    readonly twitterDataService: TwitterDataService,
    readonly wxGzhDataService: WxGzhDataService,
    readonly wxSphDataService: WxSphDataService,
    readonly xhsDataService: XhsDataService,
    readonly youtubeDataService: YoutubeDataService,
  ) {
    this.dataCubeMap.set(AccountType.BILIBILI, bilibiliDataService)
    this.dataCubeMap.set(AccountType.Douyin, douyinDataService)
    this.dataCubeMap.set(AccountType.FACEBOOK, facebookDataService)
    this.dataCubeMap.set(AccountType.GOOGLE_BUSINESS, googleBusinessDataService)
    this.dataCubeMap.set(AccountType.INSTAGRAM, instagramDataService)
    this.dataCubeMap.set(AccountType.KWAI, kwaiDataService)
    this.dataCubeMap.set(AccountType.LINKEDIN, linkedinDataService)
    this.dataCubeMap.set(AccountType.PINTEREST, pinterestDataService)
    this.dataCubeMap.set(AccountType.THREADS, threadsDataService)
    this.dataCubeMap.set(AccountType.TIKTOK, tiktokDataService)
    this.dataCubeMap.set(AccountType.TWITTER, twitterDataService)
    this.dataCubeMap.set(AccountType.WxGzh, wxGzhDataService)
    this.dataCubeMap.set(AccountType.WxSph, wxSphDataService)
    this.dataCubeMap.set(AccountType.Xhs, xhsDataService)
    this.dataCubeMap.set(AccountType.YOUTUBE, youtubeDataService)
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
}
