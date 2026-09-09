import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FilesService } from "./files.service";
@Controller("api/files")
@UseGuards(AuthGuard("jwt"))
export class FilesController {
  constructor(private svc: FilesService) {}
  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub); }
  @Post() upload(@Req() req: any, @Body() body: any) { return this.svc.upload(req.user.sub, body); }
  @Delete(":id") delete(@Param("id") id: string, @Req() req: any) { return this.svc.delete(id, req.user.sub); }
  @Get("search") search(@Query("q") q: string, @Req() req: any) { return this.svc.search(q, req.user.sub); }
  @Get("conversation/:convId") byConv(@Param("convId") convId: string) { return this.svc.listByConversation(convId); }
  @Get("folders") folders(@Req() req: any) { return this.svc.listFolders(req.user.sub); }
  @Post("folders") createFolder(@Req() req: any, @Body() body: any) { return this.svc.createFolder(req.user.sub, body.name, body.parentId); }
}
