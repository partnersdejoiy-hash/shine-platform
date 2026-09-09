import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FilesService } from "./files.service";
@Controller("api/files")
@UseGuards(AuthGuard("jwt"))
export class FilesController {
  constructor(private svc: FilesService) {}
  @Get() list(@Req() req: any) { return this.svc.list(req.user.sub); }
  @Post() upload(@Req() req: any, @Body() body: any) { return this.svc.upload(req.user.sub, body); }
  @Get("search") search(@Query("q") q: string, @Req() req: any) { return this.svc.search(q, req.user.sub); }
  @Get("conversation/:convId") byConv(@Param("convId") convId: string) { return this.svc.listByConversation(convId); }
  @Get("folders") folders(@Req() req: any) { return this.svc.listFolders(req.user.sub); }
  @Post("folders") createFolder(@Req() req: any, @Body() body: any) { return this.svc.createFolder(req.user.sub, body.name, body.parentId); }
  @Delete("folders/:id") deleteFolder(@Param("id") id: string, @Req() req: any) { return this.svc.deleteFolder(id, req.user.sub); }
  @Put(":id") rename(@Param("id") id: string, @Req() req: any, @Body() body: any) { return this.svc.rename(id, req.user.sub, body.name); }
  @Delete(":id") delete(@Param("id") id: string, @Req() req: any) { return this.svc.delete(id, req.user.sub); }
}
