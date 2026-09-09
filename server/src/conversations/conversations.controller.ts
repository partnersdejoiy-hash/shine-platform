import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConversationsService } from "./conversations.service";

@Controller("api/conversations")
@UseGuards(AuthGuard("jwt"))
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Get()
  list(@Req() req: any) { return this.svc.getUserConversations(req.user.sub); }

  @Get("unread-count")
  unreadCount(@Req() req: any) { return this.svc.countUnread(req.user.sub); }

  @Post("direct")
  openDirect(@Req() req: any, @Body() body: { userId: string }) {
    return this.svc.createDirect(req.user.sub, body.userId);
  }

  @Post("group")
  createGroup(@Req() req: any, @Body() body: { name: string; memberIds?: string[]; orgId?: string; description?: string }) {
    return this.svc.createGroup(req.user.sub, { ...body, memberIds: body.memberIds || [] });
  }

  @Post("channel")
  createChannel(@Req() req: any, @Body() body: { name: string; orgId?: string; channelKind?: string; description?: string }) {
    return this.svc.createChannel(req.user.sub, body);
  }

  @Get(":id")
  detail(@Param("id") id: string) { return this.svc.findById(id); }

  @Get(":id/members")
  members(@Param("id") id: string) { return this.svc.getMembers(id); }

  @Post(":id/members")
  addMember(@Param("id") id: string, @Req() req: any, @Body() body: { userId: string; role?: string }) {
    return this.svc.addMember(id, body.userId, req.user.sub, body.role);
  }

  @Put(":id/members/:userId")
  setMemberRole(@Param("id") id: string, @Param("userId") userId: string, @Req() req: any, @Body() body: { role?: string; isMuted?: boolean }) {
    if (body.isMuted !== undefined) return this.svc.setMuted(id, userId, body.isMuted);
    return this.svc.setMemberRole(id, userId, body.role || "member", req.user.sub);
  }

  @Delete(":id/members/:userId")
  removeMember(@Param("id") id: string, @Param("userId") userId: string, @Req() req: any) {
    return this.svc.removeMember(id, userId, req.user.sub);
  }

  @Post(":id/join")
  join(@Param("id") id: string, @Req() req: any) { return this.svc.joinChannel(id, req.user.sub); }

  @Post(":id/leave")
  leave(@Param("id") id: string, @Req() req: any) { return this.svc.leave(id, req.user.sub); }

  @Put(":id/read")
  markRead(@Param("id") id: string, @Req() req: any) { return this.svc.markRead(id, req.user.sub); }

  @Put(":id")
  update(@Param("id") id: string, @Req() req: any, @Body() body: any) {
    return this.svc.updateSettings(id, req.user.sub, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: any) { return this.svc.softDelete(id, req.user.sub); }

  @Post(":id/archive")
  archive(@Param("id") id: string, @Req() req: any) { return this.svc.archive(id, req.user.sub); }

  @Post(":id/pin")
  pin(@Param("id") id: string, @Req() req: any) { return this.svc.togglePin(id, req.user.sub); }

  @Put(":id/muted")
  mute(@Param("id") id: string, @Req() req: any, @Body() body: { muted: boolean }) {
    return this.svc.setMuted(id, req.user.sub, !!body.muted);
  }
}