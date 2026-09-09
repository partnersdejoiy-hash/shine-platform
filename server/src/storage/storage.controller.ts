import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, StreamableFile } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { StorageService } from "./storage.service";

@Controller("api/storage")
@UseGuards(AuthGuard("jwt"))
export class StorageController {
  constructor(private svc: StorageService) {}

  /** Presigned PUT url for browser→MinIO direct upload. */
  @Post("upload-url")
  getUploadUrl(@Body() body: { filename: string; mimeType?: string; folder?: string }) {
    return this.svc.getUploadUrl(body.filename, body.mimeType, body.folder);
  }

  /** Health probe used by the frontend's storage liveness check. */
  @Get("ping")
  ping() {
    return this.svc.ping();
  }

  /**
   * Direct server-side upload. The route has `express.raw()` mounted in
   * main.ts, so `req.body` is a Buffer holding the full payload.
   */
  @Post("upload")
  async upload(
    @Query("name") name: string,
    @Query("folder") folder: string,
    @Req() req: any,
  ) {
    const filename = name || "file";
    const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!raw || raw.length === 0) return { error: "empty body" };
    const fileId = this.svc["minio"].objectKeyForPrefix(folder || "chat", filename);
    const contentType = req.headers?.["content-type"] || "application/octet-stream";
    const { url } = await this.svc.putObject(fileId, raw, contentType);
    return { storageId: fileId, fileId, url, name: filename, mimeType: contentType, size: raw.length };
  }

  /** Stream a stored object back (used when presigned URLs are disabled). */
  @Get("download/:fileId")
  async download(@Param("fileId") fileId: string) {
    const stat = await this.svc.stat(fileId).catch(() => null);
    const stream = await this.svc.stream(fileId);
    return new StreamableFile(stream, {
      type: stat?.metaData?.["Content-Type"] ?? "application/octet-stream",
      length: stat?.size,
      disposition: "inline",
    });
  }

  @Post("remove")
  async remove(@Body() body: { fileId: string }) {
    await this.svc.remove(body.fileId);
    return { ok: true };
  }
}