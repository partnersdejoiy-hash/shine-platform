import { Controller, Get, Post, Param, Body, UseGuards, Req, Put } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConversationsService } from "./conversations.service";

@Controller("api/conversations")
@UseGuards(AuthGuard("jwt"))
export class ConversationsController {
  constructor(private convService: ConversationsService) {}

  @Get()
  list(@Req() req: any) { return this.convService.getUserConversations(req.user.sub); }

  @Get("unread-count")
  unreadCount(@Req() req: any) { return this.convService.countUnread(req.user.sub); }

  @Post("direct")
  createDirect(@Req() req: any, @Body() body: { userId: string }) {
    return this.convService.createDirect(req.user.sub, body.userId);
  }

  @Post("group")
  createGroup(@Req() req: any, @Body() body: any) {
    return this.convService.createGroup(req.user.sub, body);
  }

  @Post("channel")
  createChannel(@Req() req: any, @Body() body: any) {
    return this.convService.createChannel(req.user.sub, body);
  }

  @Get(":id")
  get(@Param("id") id: string) { return this.convService.findById(id); }

  @Get(":id/members")
  members(@Param("id") id: string) { return this.convService.getMembers(id); }

  @Post(":id/join")
  join(@Param("id") id: string, @Req() req: any) { return this.convService.joinChannel(id, req.user.sub); }

  @Post(":id/leave")
  leave(@Param("id") id: string, @Req() req: any) { return this.convService.leave(id, req.user.sub); }

  @Put(":id/read")
  markRead(@Param("id") id: string, @Req() req: any) { return this.convService.markRead(id, req.user.sub); }
}
