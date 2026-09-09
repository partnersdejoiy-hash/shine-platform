import { Controller, Get, Post, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CallsService } from "./calls.service";
@Controller("api/calls")
@UseGuards(AuthGuard("jwt"))
export class CallsController {
  constructor(private svc: CallsService) {}
  @Get("live") live() { return this.svc.liveCalls(); }
  @Get("history") history(@Req() req: any) { return this.svc.history(req.user.sub); }
  @Get("meeting-signals/:meetingId") meetingSignals(@Param("meetingId") meetingId: string) { return this.svc.meetingSignalsFor(meetingId); }
  @Post("start") start(@Req() req: any, @Body() body: any) { return this.svc.start(req.user.sub, body); }
  @Post("signal") signal(@Req() req: any, @Body() body: any) { return this.svc.sendSignal({ ...body, fromId: req.user.sub }); }
  @Post("meeting-signal") meetingSignal(@Req() req: any, @Body() body: any) { return this.svc.sendMeetingSignal(req.user.sub, body); }
  @Get(":id/signals") signals(@Param("id") id: string, @Req() req: any) { return this.svc.signalsFor(id, req.user.sub); }
  @Post(":id/answer") answer(@Param("id") id: string, @Req() req: any) { return this.svc.answer(id, req.user.sub); }
  @Post(":id/decline") decline(@Param("id") id: string) { return this.svc.decline(id); }
  @Post(":id/end") end(@Param("id") id: string) { return this.svc.end(id); }
  @Post(":id/recording") recording(@Param("id") id: string, @Req() req: any, @Body() body: { recording?: boolean }) { return this.svc.setRecording(id, req.user.sub, body?.recording === true); }
}
