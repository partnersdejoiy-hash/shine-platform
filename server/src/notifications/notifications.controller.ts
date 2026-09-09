import { Controller, Get, Post, Param, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { NotificationsService } from "./notifications.service";
@Controller("api/notifications")
@UseGuards(AuthGuard("jwt"))
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get("unread-count") unreadCount(@Req() req: any) { return this.svc.unreadCount(req.user.sub); }
  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub); }
  @Post(":id/read") markRead(@Param("id") id: string, @Req() req: any) { return this.svc.markRead(id, req.user.sub); }
  @Post("read-all") markAllRead(@Req() req: any) { return this.svc.markAllRead(req.user.sub); }
}
