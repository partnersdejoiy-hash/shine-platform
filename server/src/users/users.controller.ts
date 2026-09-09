import { Controller, Get, Param, Query, UseGuards, Put, Post, Delete, Body, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UsersService } from "./users.service";

@Controller("api/users")
@UseGuards(AuthGuard("jwt"))
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get("me")
  me(@Req() req: any) {
    return this.usersService.findById(req.user.sub);
  }

  @Put("me")
  updateMe(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMe(req.user.sub, body);
  }

  @Get("search")
  search(@Query("q") q: string, @Query("limit") limit?: string) {
    return this.usersService.search(q, limit ? parseInt(limit) : 50);
  }

  @Get("presence")
  listPresence() {
    return this.usersService.listPresence();
  }

  @Get("presence/:userId")
  presence(@Param("userId") userId: string) {
    return this.usersService.getPresence(userId);
  }

  @Put("presence")
  setPresence(@Req() req: any, @Body() body: { status: string; customStatus?: string }) {
    return this.usersService.setPresence(req.user.sub, body.status, body.customStatus);
  }

  // ── Devices ────────────────────────────────────────────────────────
  @Get("devices")
  devices(@Req() req: any) {
    return this.usersService.listDevices(req.user.sub);
  }

  @Post("import")
  importUsers(@Body() body: any) {
    return this.usersService.importUsers(body.users || body.rows || body.data || []);
  }

  @Get("export")
  exportUsers() {
    return this.usersService.exportUsers();
  }

  @Post("bulk")
  bulkUserAction(@Body() body: any) {
    return this.usersService.bulkUserAction(body);
  }

  @Post("devices")
  registerDevice(@Req() req: any, @Body() body: { name?: string; platform?: string; isCurrent?: boolean }) {
    return this.usersService.registerDevice(req.user.sub, body);
  }

  @Put("devices/:id")
  setDevice(@Req() req: any, @Param("id") id: string, @Body() body: { isTrusted?: boolean }) {
    return this.usersService.setDeviceTrusted(req.user.sub, id, !!body.isTrusted);
  }

  @Delete("devices/:id")
  removeDevice(@Req() req: any, @Param("id") id: string) {
    return this.usersService.removeDevice(req.user.sub, id);
  }

  // ── Bootstrap helpers (replaces Convex hooks) ─────────────────────
  @Post("ensure-admin")
  ensureAdmin(@Req() req: any) {
    return this.usersService.ensureAdmin(req.user.sub);
  }

  @Post("bootstrap-super-admin")
  bootstrapSuperAdmin(@Req() req: any) {
    return this.usersService.bootstrapSuperAdmin(req.user.sub);
  }

  @Post("bootstrap-dejoiy-membership")
  bootstrapDejoiyMembership(@Req() req: any) {
    return this.usersService.bootstrapDejoiyMembership(req.user.sub);
  }

  @Get("my-orgs")
  myOrgs(@Req() req: any) {
    return this.usersService.getOrganizations(req.user.sub);
  }

  @Get(":id")
  getUser(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Put(":id")
  updateUser(@Param("id") id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }
}