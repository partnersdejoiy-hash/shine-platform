import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuditService } from "./audit.service";
@Controller("api/audit")
@UseGuards(AuthGuard("jwt"))
export class AuditController {
  constructor(private svc: AuditService) {}
  @Get() list(@Query("orgId") orgId?: string) { return this.svc.list(orgId); }
}
