import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { XianyuService } from './xianyu.service';
import { CreateXianyuItemDto, XianyuItemFilterDto } from './dto/xianyu.dto';

@ApiTags('plat/xianyu - 闲鱼平台')
@Controller('plat/xianyu')
export class XianyuController {
  constructor(private readonly xianyuService: XianyuService) {}

  @Post('items')
  @ApiOperation({ summary: '发布闲鱼商品（Cookie 通路）' })
  publishItem(@Query('accountId') accountId: string, @Body() dto: CreateXianyuItemDto) {
    if (!accountId) throw new BadRequestException('accountId 是必须的');
    return this.xianyuService.publishItem(accountId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: '下架闲鱼商品' })
  @ApiParam({ name: 'itemId' })
  deleteItem(@Query('accountId') accountId: string, @Param('itemId') itemId: string) {
    if (!accountId) throw new BadRequestException('accountId 是必须的');
    return this.xianyuService.deleteItem(accountId, itemId);
  }

  @Get('items')
  @ApiOperation({ summary: '获取闲鱼商品列表' })
  listItems(@Query() filter: XianyuItemFilterDto) {
    return this.xianyuService.listItems(filter);
  }

  @Get('auth/check')
  @ApiOperation({ summary: '检查闲鱼 Cookie 登录态' })
  checkAuth(@Query('accountId') accountId: string) {
    if (!accountId) throw new BadRequestException('accountId 是必须的');
    return this.xianyuService.checkLoginStatus(accountId);
  }
}
