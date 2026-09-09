import { Controller, Get, Post, Put, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsService } from "./permissions.service";
@Controller("api/permissions")
@UseGuards(AuthGuard("jwt"))
export class PermissionsController {
  constructor(private svc: PermissionsService) {}
  @Get("roles/:role") getRolePerms(@Param("role") role: string) { return this.svc.getRolePermissions(role); }
  @Put("roles/:role") updateRolePerms(@Param("role") role: string, @Body() body: any, @Req() req: any) { return this.svc.updateRolePermissions(role, body.permissions, req.user.sub); }
  @Post("request") requestPerm(@Req() req: any, @Body() body: any) { return this.svc.requestPermission(req.user.sub, body.permission, body.reason); }
  @Get("requests") listRequests() { return this.svc.listRequests(); }
  @Put("requests/:id") review(@Param("id") id: string, @Req() req: any, @Body() body: any) { return this.svc.reviewRequest(id, req.user.sub, body.status); }
}
