import { Controller, Get, Post, Param, Body, UseGuards, Req, Put } from "@nestjs/common";
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

  @Get("my")
  myOrgs(@Req() req: any) {
    return this.orgsService.getUserOrgs(req.user.sub);
  }

  @Get(":id")
  getOrg(@Param("id") id: string) {
    return this.orgsService.findById(id);
  }

  @Get(":id/members")
  members(@Param("id") id: string) {
    return this.orgsService.getMembers(id);
  }

  @Post(":id/members")
  addMember(@Param("id") id: string, @Body() body: { userId: string; role?: string }) {
    return this.orgsService.addMember(id, body.userId, body.role);
  }
}
