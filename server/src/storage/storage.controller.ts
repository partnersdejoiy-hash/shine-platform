import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { StorageService } from "./storage.service";
@Controller("api/storage")
@UseGuards(AuthGuard("jwt"))
export class StorageController {
  constructor(private svc: StorageService) {}
  @Post("upload-url") getUploadUrl(@Body() body: { filename: string; mimeType: string }) { return this.svc.getUploadUrl(body.filename, body.mimeType); }
  @Get("download/:fileId") getDownloadUrl(@Param("fileId") fileId: string) { return this.svc.getDownloadUrl(fileId); }
}
