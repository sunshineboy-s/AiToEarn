import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc } from '@yikart/common'
import {
  CreateBrandMonitorRequest,
  ListMentionsRequest,
  UpdateBrandMonitorRequest,
} from './brand-monitor.dto'
import { BrandMonitorService } from './brand-monitor.service'

@ApiTags('Engage/BrandMonitor')
@Controller('brand-monitor')
export class BrandMonitorController {
  constructor(private readonly service: BrandMonitorService) {}

  @ApiDoc({ summary: 'Create a brand monitor' })
  @Post('/')
  async create(
    @GetToken() token: TokenInfo,
    @Body() body: CreateBrandMonitorRequest,
  ) {
    return this.service.createMonitor(token.id, body)
  }

  @ApiDoc({ summary: 'List my brand monitors' })
  @Get('/')
  async list(@GetToken() token: TokenInfo) {
    return this.service.listForUser(token.id)
  }

  @ApiDoc({ summary: 'Get one brand monitor' })
  @Get('/:id')
  async get(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
  ) {
    return this.service.getForUser(token.id, id)
  }

  @ApiDoc({ summary: 'Update brand monitor' })
  @Patch('/:id')
  async update(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
    @Body() body: UpdateBrandMonitorRequest,
  ) {
    return this.service.updateMonitor(token.id, id, body)
  }

  @ApiDoc({ summary: 'Delete brand monitor' })
  @Delete('/:id')
  async remove(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
  ) {
    await this.service.deleteMonitor(token.id, id)
    return { success: true }
  }

  @ApiDoc({ summary: 'Trigger an immediate scan' })
  @Post('/:id/scan')
  async scan(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
  ) {
    return this.service.triggerScan(token.id, id)
  }

  @ApiDoc({ summary: 'List mentions captured by this monitor' })
  @Get('/:id/mentions')
  async mentions(
    @GetToken() token: TokenInfo,
    @Param('id') id: string,
    @Query() query: ListMentionsRequest,
  ) {
    return this.service.listMentions(token.id, id, query)
  }
}
