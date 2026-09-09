import { Controller, Get, Post, Param, Body, UseGuards, Req, Put, Delete } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MeetingsService } from "./meetings.service";

@Controller("api/meetings")
@UseGuards(AuthGuard("jwt"))
export class MeetingsController {
  constructor(private svc: MeetingsService) {}

  // Static routes MUST precede :id routes (Nest matches in order)
  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub); }
  @Get("history") history(@Req() req: any) { return this.svc.history(req.user.sub); }
  @Get("admin/live") adminLive() { return this.svc.adminLiveMeetings(); }
  @Get("room/:roomCode") byRoom(@Param("roomCode") code: string) { return this.svc.getByRoomCode(code); }

  @Post() create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user.sub, body); }

  @Get(":id") get(@Param("id") id: string) { return this.svc.findById(id); }
  @Get(":id/report") report(@Param("id") id: string) { return this.svc.meetingReport(id); }

  @Post(":id/join") join(@Param("id") id: string, @Req() req: any) { return this.svc.join(id, req.user.sub); }
  @Post(":id/leave") leave(@Param("id") id: string, @Req() req: any) { return this.svc.leave(id, req.user.sub); }
  @Post(":id/start") start(@Param("id") id: string, @Req() req: any) { return this.svc.start(id, req.user.sub); }
  @Post(":id/end") end(@Param("id") id: string, @Req() req: any) { return this.svc.end(id, req.user.sub); }
  @Post(":id/cancel") cancel(@Param("id") id: string, @Req() req: any) { return this.svc.cancel(id, req.user.sub); }
  @Post(":id/admin-end") adminEnd(@Param("id") id: string) { return this.svc.adminEndMeeting(id); }
  @Post(":id/mute-all") muteAll(@Param("id") id: string, @Req() req: any) { return this.svc.muteAll(id, req.user.sub); }
  @Post(":id/lobby") lobby(@Param("id") id: string, @Req() req: any, @Body() body: { enabled?: boolean }) { return this.svc.setLobbyEnabled(id, req.user.sub, body?.enabled !== false); }
  @Post(":id/locked") locked(@Param("id") id: string, @Req() req: any, @Body() body: { locked?: boolean }) { return this.svc.setLocked(id, req.user.sub, body?.locked === true); }

  @Get(":id/participants") participants(@Param("id") id: string) { return this.svc.getParticipants(id); }
  @Post(":id/participants/:userId") setState(@Param("id") id: string, @Param("userId") userId: string, @Body() body: { status: string }) { return this.svc.setParticipantState(id, userId, body.status); }
  @Put(":id/participants/:userId/role") setRole(@Param("id") id: string, @Param("userId") userId: string, @Body() body: { role: string }) { return this.svc.setParticipantRole(id, userId, body.role); }
  @Post(":id/admit/:userId") admit(@Param("id") id: string, @Param("userId") userId: string) { return this.svc.admitParticipant(id, userId); }
  @Post(":id/remove/:userId") remove(@Param("id") id: string, @Param("userId") userId: string) { return this.svc.removeParticipant(id, userId); }

  @Post(":id/breakouts") createBreakouts(@Param("id") id: string, @Req() req: any, @Body() body: { rooms: { name: string }[] }) { return this.svc.createBreakoutRooms(id, req.user.sub, body.rooms || []); }
  @Post(":id/breakouts/start") startBreakouts(@Param("id") id: string, @Req() req: any, @Body() body: { durationMinutes?: number }) { return this.svc.startBreakouts(id, req.user.sub, body?.durationMinutes || 15); }
  @Post(":id/breakouts/end") endBreakouts(@Param("id") id: string, @Req() req: any) { return this.svc.endBreakouts(id, req.user.sub); }
  @Post(":id/breakouts/assign") assignBreakout(@Param("id") id: string, @Req() req: any, @Body() body: { breakoutId: string; participantIds: string[] }) { return this.svc.assignToBreakout(id, req.user.sub, body.breakoutId, body.participantIds || []); }

  @Post(":id/activity") activity(@Param("id") id: string, @Req() req: any, @Body() body: { type: string; detail?: string }) { return this.svc.logActivity(id, req.user.sub, body.type, body.detail); }
  @Post(":id/emails") emails(@Param("id") id: string, @Req() req: any, @Body() body: { emails: string[] }) { return this.svc.sendInviteEmails(id, req.user.sub, body.emails || []); }
}