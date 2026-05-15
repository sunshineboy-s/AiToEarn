import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { GetToken, Public, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc } from '@yikart/common'
import {
  AIGenCommentDto,
  FavoritePostRequest,
  FetchCommentRepliesRequest,
  FetchMetaPostsRequest,
  FetchPostCommentsRequest,
  FetchPostsRequest,
  FollowUserRequest,
  LikePostRequest,
  PublishCommentReplyRequest,
  PublishCommentRequest,
  ReplyToCommentsDto,
} from './engagement.dto'
import { ActionResult, EngagementCapability, PublishCommentResponse } from './engagement.interface'
import { EngagementService } from './engagement.service'

@ApiTags('Engage/Engagement')
@Controller('channel/engagement')
export class EngagementController {
  constructor(
    private readonly engagementService: EngagementService,
  ) {}

  @ApiDoc({
    summary: 'Capability matrix (which actions each platform supports)',
  })
  @Get('/capabilities')
  capabilities(): Array<EngagementCapability & { platform: string }> {
    return this.engagementService.getCapabilities()
  }

  @ApiDoc({
    summary: 'List Channel Posts',
  })
  @Post('/posts')
  async fetchChannelPosts(
    @GetToken() token: TokenInfo,
    @Body() data: FetchPostsRequest,
  ) {
    return this.engagementService.fetchUserPosts(data)
  }

  @ApiDoc({
    summary: 'List Meta Posts',
    body: FetchMetaPostsRequest.schema,
  })
  @Post('/meta/posts')
  async fetchMetaPosts(
    @GetToken() token: TokenInfo,
    @Body() data: FetchMetaPostsRequest,
  ) {
    return this.engagementService.fetchMetaPosts(data)
  }

  // ---------------------------------------------------------------------------
  // engagement actions (Phase 1 unified surface — all platform-aware)
  // ---------------------------------------------------------------------------

  @ApiDoc({
    summary: 'Like a post',
    body: LikePostRequest.schema,
  })
  @Post('/post/like')
  async likePost(
    @GetToken() token: TokenInfo,
    @Body() data: LikePostRequest,
  ): Promise<ActionResult> {
    return this.engagementService.likePost(data)
  }

  @ApiDoc({
    summary: 'Unlike a post',
    body: LikePostRequest.schema,
  })
  @Post('/post/unlike')
  async unlikePost(
    @GetToken() token: TokenInfo,
    @Body() data: LikePostRequest,
  ): Promise<ActionResult> {
    return this.engagementService.unlikePost(data)
  }

  @ApiDoc({
    summary: 'Favorite (bookmark) a post',
    body: FavoritePostRequest.schema,
  })
  @Post('/post/favorite')
  async favoritePost(
    @GetToken() token: TokenInfo,
    @Body() data: FavoritePostRequest,
  ): Promise<ActionResult> {
    return this.engagementService.favoritePost(data)
  }

  @ApiDoc({
    summary: 'Remove favorite (bookmark) from a post',
    body: FavoritePostRequest.schema,
  })
  @Post('/post/unfavorite')
  async unfavoritePost(
    @GetToken() token: TokenInfo,
    @Body() data: FavoritePostRequest,
  ): Promise<ActionResult> {
    return this.engagementService.unfavoritePost(data)
  }

  @ApiDoc({
    summary: 'Follow a user / channel',
    body: FollowUserRequest.schema,
  })
  @Post('/user/follow')
  async followUser(
    @GetToken() token: TokenInfo,
    @Body() data: FollowUserRequest,
  ): Promise<ActionResult> {
    return this.engagementService.followUser(data)
  }

  @ApiDoc({
    summary: 'Unfollow a user / channel',
    body: FollowUserRequest.schema,
  })
  @Post('/user/unfollow')
  async unfollowUser(
    @GetToken() token: TokenInfo,
    @Body() data: FollowUserRequest,
  ): Promise<ActionResult> {
    return this.engagementService.unfollowUser(data)
  }

  // ---------------------------------------------------------------------------
  // comments / replies
  // ---------------------------------------------------------------------------

  @ApiDoc({
    summary: 'List Post Comments',
  })
  @Post('/post/comments')
  async fetchPostComments(
    @GetToken() token: TokenInfo,
    @Body() data: FetchPostCommentsRequest,
  ) {
    return this.engagementService.fetchPostComments(data)
  }

  @ApiDoc({
    summary: 'List Comment Replies',
  })
  @Post('/comment/replies')
  async fetchCommentReplies(
    @GetToken() token: TokenInfo,
    @Body() data: FetchCommentRepliesRequest,
  ) {
    return this.engagementService.fetchCommentReplies(data)
  }

  @ApiDoc({
    summary: 'Publish Comment on Post',
  })
  @Post('/post/comments/publish')
  async commentOnPost(
    @GetToken() token: TokenInfo,
    @Body() data: PublishCommentRequest,
  ): Promise<PublishCommentResponse> {
    return this.engagementService.commentOnPost(data)
  }

  @ApiDoc({
    summary: 'Publish Reply to Comment',
  })
  @Post('/comment/replies/publish')
  async replyToComment(
    @GetToken() token: TokenInfo,
    @Body() data: PublishCommentReplyRequest,
  ): Promise<PublishCommentResponse> {
    return this.engagementService.replyToComment(data)
  }

  @ApiDoc({
    summary: 'Generate Comment Replies with AI',
  })
  @Post('/comment/ai/replies')
  async generateRepliesByAI(
    @GetToken() token: TokenInfo,
    @Body() data: AIGenCommentDto,
  ) {
    return this.engagementService.batchGenReplyContent(data)
  }

  @ApiDoc({
    summary: 'Reply to Comments with AI Task',
  })
  @Post('/comment/ai/replies/tasks')
  async replyToCommentsByAI(
    @GetToken() token: TokenInfo,
    @Body() data: ReplyToCommentsDto,
  ) {
    return this.engagementService.ReplyToCommentsByAI(data)
  }

  @Public()
  @ApiDoc({
    summary: 'List User Posts (Crawler)',
    body: FetchPostsRequest.schema,
  })
  @Post('/list/user/posts')
  async crawlerFetchUserPosts(@Body() data: FetchPostsRequest) {
    return this.engagementService.fetchUserPosts(data)
  }
}
