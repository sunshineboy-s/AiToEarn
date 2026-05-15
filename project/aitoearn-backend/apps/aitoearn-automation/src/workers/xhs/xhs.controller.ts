import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@yikart/common'
import { LikeNoteDto, ReplyToNoteDto, SearchKeywordDto } from './xhs.dto'
import { XhsService } from './xhs.service'

@ApiTags('Engage/Automation/XHS')
@Controller('automation/xhs')
export class XhsController {
  constructor(private readonly xhsService: XhsService) {}

  @ApiDoc({ summary: 'Like a note (no browser plugin required)' })
  @Post('/note/like')
  async likeNote(@Body() body: LikeNoteDto) {
    return this.xhsService.likeNote(body.accountId, body.noteUrl)
  }

  @ApiDoc({ summary: 'Reply to a note' })
  @Post('/note/reply')
  async replyToNote(@Body() body: ReplyToNoteDto) {
    return this.xhsService.replyToNote(body.accountId, body.noteUrl, body.comment)
  }

  @ApiDoc({ summary: 'Search notes by brand / keyword' })
  @Post('/search')
  async search(@Body() body: SearchKeywordDto) {
    return this.xhsService.search(body.accountId, body.keyword, body.limit)
  }
}
