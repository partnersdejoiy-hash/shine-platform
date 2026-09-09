import { Controller, Get, Post, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PoliciesService } from "./policies.service";
@Controller("api/policies")
@UseGuards(AuthGuard("jwt"))
export class PoliciesController {
  constructor(private svc: PoliciesService) {}
  @Get() list(@Req() req: any) { return this.svc.list(); }
  @Get("published") published() { return this.svc.published(); }
  @Get("stats") stats() { return this.svc.stats(); }
  @Get("seed") seed(@Req() req: any) { return this.svc.seedDefaults(req.user.sub); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user.sub, body); }
  @Post("seed") seedPost(@Req() req: any) { return this.svc.seedDefaults(req.user.sub); }
  @Post(":id/publish") publish(@Param("id") id: string, @Req() req: any) { return this.svc.publish(id, req.user.sub); }
  @Post(":id/acknowledge") ack(@Param("id") id: string, @Req() req: any) { return this.svc.acknowledge(id, req.user.sub); }
  @Get("pending-acks") pendingAcks(@Req() req: any) { return this.svc.pendingAcks(req.user.sub); }
}
