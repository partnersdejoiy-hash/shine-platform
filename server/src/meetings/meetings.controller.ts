import { Controller, Get, Post, Param, Body, UseGuards, Req, Put } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MeetingsService } from "./meetings.service";
@Controller("api/meetings")
@UseGuards(AuthGuard("jwt"))
export class MeetingsController {
  constructor(private svc: MeetingsService) {}
  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user.sub, body); }
  @Get("room/:roomCode") byRoom(@Param("roomCode") code: string) { return this.svc.getByRoomCode(code); }
  @Get(":id") get(@Param("id") id: string) { return this.svc.findById(id); }
  @Post(":id/join") join(@Param("id") id: string, @Req() req: any) { return this.svc.join(id, req.user.sub); }
  @Post(":id/leave") leave(@Param("id") id: string, @Req() req: any) { return this.svc.leave(id, req.user.sub); }
  @Post(":id/end") end(@Param("id") id: string, @Req() req: any) { return this.svc.end(id, req.user.sub); }
  @Get(":id/participants") participants(@Param("id") id: string) { return this.svc.getParticipants(id); }
}
