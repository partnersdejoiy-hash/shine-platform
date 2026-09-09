import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { StatusesService } from "./statuses.service";

@Controller("api/statuses")
@UseGuards(AuthGuard("jwt"))
export class StatusesController {
  constructor(private svc: StatusesService) {}

  @Get("feed")
  feed(@Req() req: any) { return this.svc.feed(req.user.sub); }

  @Get("my")
  my(@Req() req: any) { return this.svc.myStatuses(req.user.sub); }

  @Post()
  create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user.sub, body); }

  @Put(":id")
  update(@Req() req: any, @Param("id") id: string, @Body() body: any) { return this.svc.update(req.user.sub, id, body); }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) { return this.svc.remove(req.user.sub, id); }

  @Post(":id/view")
  view(@Req() req: any, @Param("id") id: string) { return this.svc.view(req.user.sub, id); }
}