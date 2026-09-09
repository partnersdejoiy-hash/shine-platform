import { Controller, Get, Post, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CallsService } from "./calls.service";
@Controller("api/calls")
@UseGuards(AuthGuard("jwt"))
export class CallsController {
  constructor(private svc: CallsService) {}
  @Post("start") start(@Req() req: any, @Body() body: any) { return this.svc.start(req.user.sub, body); }
  @Post(":id/answer") answer(@Param("id") id: string, @Req() req: any) { return this.svc.answer(id, req.user.sub); }
  @Post(":id/decline") decline(@Param("id") id: string) { return this.svc.decline(id); }
  @Post(":id/end") end(@Param("id") id: string) { return this.svc.end(id); }
  @Post("signal") signal(@Req() req: any, @Body() body: any) { return this.svc.sendSignal({ ...body, fromId: req.user.sub }); }
  @Get("history") history(@Req() req: any) { return this.svc.history(req.user.sub); }
}
