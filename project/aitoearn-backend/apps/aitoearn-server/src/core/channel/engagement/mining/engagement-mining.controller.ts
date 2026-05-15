import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc } from '@yikart/common'
import { EngagementMiningService } from './engagement-mining.service'
import { ClassifyCommentsRequest, ListMiningHitsRequest, MarkMiningHitRequest } from './mining.dto'

@ApiTags('Engage/Mining')
@Controller('channel/engagement/mining')
export class EngagementMiningController {
  constructor(private readonly miningService: EngagementMiningService) {}

  @ApiDoc({ summary: 'List mining hits for the current user' })
  @Get('/hits')
  async list(
    @GetToken() token: TokenInfo,
    @Query() query: ListMiningHitsRequest,
  ) {
    return this.miningService.list(query, token.id)
  }

  @ApiDoc({ summary: 'Mark a mining hit as handled / ignored' })
  @Patch('/hits/status')
  async mark(
    @GetToken() token: TokenInfo,
    @Body() body: MarkMiningHitRequest,
  ) {
    return this.miningService.markStatus(body)
  }

  @ApiDoc({
    summary: 'Classify a batch of comments synchronously (rules + LLM)',
    body: ClassifyCommentsRequest.schema,
  })
  @Post('/classify')
  async classify(
    @GetToken() token: TokenInfo,
    @Body() body: ClassifyCommentsRequest,
  ) {
    return this.miningService.classifyAndStoreBatch({ ...body, userId: token.id })
  }
}
