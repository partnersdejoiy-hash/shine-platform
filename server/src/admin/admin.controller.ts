import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AdminService } from "./admin.service";
@Controller("api/admin")
@UseGuards(AuthGuard("jwt"))
export class AdminController {
  constructor(private svc: AdminService) {}
  @Get("stats") stats() { return this.svc.getStats(); }
  @Get("users") users(@Query("limit") l?: string, @Query("offset") o?: string, @Query("search") s?: string) {
    return this.svc.listUsers(l ? parseInt(l) : 100, o ? parseInt(o) : 0, s);
  }
  @Get("orgs") orgs() { return this.svc.listOrgs(); }
}
