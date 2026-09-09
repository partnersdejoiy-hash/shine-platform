import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { TasksService } from "./tasks.service";
@Controller("api/tasks")
@UseGuards(AuthGuard("jwt"))
export class TasksController {
  constructor(private svc: TasksService) {}
  @Get() list(@Query("orgId") orgId: string) { return this.svc.list(orgId); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.svc.create(req.user.sub, body); }
  @Put(":id") update(@Param("id") id: string, @Body() body: any) { return this.svc.update(id, body); }
  @Delete(":id") delete(@Param("id") id: string) { return this.svc.delete(id); }
}
