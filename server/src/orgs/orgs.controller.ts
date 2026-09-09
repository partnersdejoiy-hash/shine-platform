import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { OrgsService } from "./orgs.service";

@Controller("api/orgs")
@UseGuards(AuthGuard("jwt"))
export class OrgsController {
  constructor(private orgsService: OrgsService) {}

  @Get()
  list() { return this.orgsService.list(); }

  @Post()
  create(@Req() req: any, @Body() body: { name: string; description?: string; slug?: string }) {
    return this.orgsService.create({ ...body, ownerId: req.user.sub });
  }

  @Post("auto-join")
  autoJoin(@Req() req: any) {
    return this.orgsService.autoJoinByEmailDomain(req.user.sub);
  }

  @Get("my")
  myOrgs(@Req() req: any) {
    return this.orgsService.getUserOrgs(req.user.sub);
  }

  @Get(":id")
  getOrg(@Param("id") id: string) {
    return this.orgsService.findById(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.orgsService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.orgsService.deleteOrg(id);
  }

  @Get(":id/members")
  members(@Param("id") id: string) {
    return this.orgsService.getMembers(id);
  }

  @Post(":id/members")
  addMember(@Param("id") id: string, @Body() body: { userId: string; role?: string }) {
    return this.orgsService.addMember(id, body.userId, body.role);
  }

  @Put(":id/members/:userId")
  setMemberRole(@Param("id") id: string, @Param("userId") userId: string, @Body() body: { role: string }) {
    return this.orgsService.setMemberRole(id, userId, body.role);
  }

  @Delete(":id/members/:userId")
  removeMember(@Param("id") id: string, @Param("userId") userId: string) {
    return this.orgsService.removeMember(id, userId);
  }

  @Post(":orgId/teams")
  createTeam(@Param("orgId") orgId: string, @Req() req: any, @Body() body: { name: string; description?: string; memberIds?: string[] }) {
    return this.orgsService.createTeam(orgId, body, req.user.sub);
  }

  @Get(":orgId/teams/:teamId")
  teamDetail(@Param("orgId") orgId: string, @Param("teamId") teamId: string) {
    return this.orgsService.teamDetail(orgId, teamId);
  }

  @Post(":orgId/teams/:teamId/members")
  addTeamMember(@Param("orgId") orgId: string, @Param("teamId") teamId: string, @Body() body: { userId: string; role?: string }) {
    return this.orgsService.addTeamMember(orgId, teamId, body.userId, body.role);
  }

  @Delete(":orgId/teams/:teamId/members/:userId")
  removeTeamMember(@Param("orgId") orgId: string, @Param("teamId") teamId: string, @Param("userId") userId: string) {
    return this.orgsService.removeTeamMember(orgId, teamId, userId);
  }
}