import { Controller, Get, Param, Query, UseGuards, Put, Body, Req } from "@nestjs/common";
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

  @Get("search")
  search(@Query("q") q: string, @Query("limit") limit?: string) {
    return this.usersService.search(q, limit ? parseInt(limit) : 50);
  }

  @Get("presence/:userId")
  presence(@Param("userId") userId: string) {
    return this.usersService.getPresence(userId);
  }

  @Put("presence")
  setPresence(@Req() req: any, @Body() body: { status: string; customStatus?: string }) {
    return this.usersService.setPresence(req.user.sub, body.status, body.customStatus);
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
