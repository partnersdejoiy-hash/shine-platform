import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AdminService } from "./admin.service";

@Controller("api/admin")
@UseGuards(AuthGuard("jwt"))
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get("stats") stats() { return this.svc.getStats(); }

  @Get("users")
  users(@Query("limit") l?: string, @Query("offset") o?: string, @Query("search") s?: string) {
    return this.svc.listUsers(l ? parseInt(l) : 100, o ? parseInt(o) : 0, s);
  }

  @Post("users/ensure-employee-ids")
  ensureEmployeeIds() { return this.svc.ensureAllEmployeeIds(); }

  @Put("users/:id/role")
  setUserRole(@Param("id") id: string, @Body() body: { role: string }) { return this.svc.setUserRole(id, body.role); }

  @Put("users/:id/permissions")
  setUserPermission(@Param("id") id: string, @Body() body: { permission: string; granted?: boolean }) {
    return this.svc.setUserPermission(id, body.permission, body.granted !== false);
  }

  @Put("users/:id/org")
  setUserOrg(@Param("id") id: string, @Body() body: { orgId: string; role?: string }) {
    return this.svc.setUserOrg(id, body.orgId, body.role);
  }

  @Put("users/:id/active")
  setUserActive(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    return this.svc.setUserActive(id, body.isActive);
  }

  @Put("users/:id")
  updateUserField(@Param("id") id: string, @Body() body: any) {
    return this.svc.adminUpdateUserField(id, body);
  }

  @Get("orgs") orgs() { return this.svc.listOrgs(); }
  @Delete("orgs/:id")
  deleteOrg(@Param("id") id: string) { return this.svc.deleteOrg(id); }

  @Get("role-hierarchy") roleHierarchy() { return this.svc.roleHierarchy(); }
  @Get("breakdown") breakdown() { return this.svc.breakdown(); }
}