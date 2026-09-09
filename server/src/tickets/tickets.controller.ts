import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { TicketsService } from "./tickets.service";

@Controller("api/tickets")
@UseGuards(AuthGuard("jwt"))
export class TicketsController {
  constructor(private svc: TicketsService) {}

  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub, req.user.role); }

  @Get("my") my(@Req() req: any) { return this.svc.myTickets(req.user.sub); }

  @Get("approval-queue") queue() { return this.svc.approvalQueue(); }

  @Post() create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user.sub, body); }

  @Get(":id") get(@Param("id") id: string) { return this.svc.findById(id); }

  @Put(":id/status") updateStatus(@Param("id") id: string, @Body() body: { status: string }) { return this.svc.updateStatus(id, body.status); }

  @Post(":id/notes") addNote(@Param("id") id: string, @Req() req: any, @Body() body: { text: string }) { return this.svc.addNote(id, req.user.sub, body.text); }

  @Post(":id/decide") decide(@Param("id") id: string, @Req() req: any, @Body() body: any) { return this.svc.decide(id, req.user.sub, body.action, body.comment); }

  @Post(":id/cancel") cancel(@Param("id") id: string, @Req() req: any) { return this.svc.cancelTicket(id, req.user.sub); }

  @Post(":id/pickup") pickup(@Param("id") id: string, @Req() req: any) { return this.svc.pickupTicket(id, req.user.sub); }

  @Post(":id/password-ticket") passwordTicket(@Param("id") id: string) { return { ok: true, queued: true }; }

  @Post(":id/send-temp-password") sendTemp(@Param("id") id: string) { return { ok: true, emailed: false, note: "SMTP not configured" }; }

  @Delete(":id") remove(@Param("id") id: string) { return this.svc.deleteTicket(id); }
}