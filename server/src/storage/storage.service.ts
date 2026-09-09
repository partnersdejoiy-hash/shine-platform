import { Injectable } from "@nestjs/common";
import { MinioService } from "./minio.service";

@Injectable()
export class StorageService {
  constructor(private readonly minio: MinioService) {}

  /** Presigned PUT url so browsers upload straight to MinIO. */
  async getUploadUrl(filename: string, mimeType: string, folder = "chat") {
    const key = this.minio.objectKeyForPrefix(folder, filename || "file");
    return {
      url: await this.minio.presignedPutUrl(key),
      fileId: key,
      method: "PUT",
      headers: { "Content-Type": mimeType || "application/octet-stream" },
    };
  }

  /** Presigned GET url to fetch a stored object. */
  async getDownloadUrl(fileId: string) {
    return { url: await this.minio.presignedGetUrl(fileId), fileId };
  }

  /** Direct server-side upload (binary body → MinIO). */
  async putObject(fileId: string, buffer: Buffer, contentType: string) {
    const url = await this.minio.putBuffer(fileId, buffer, contentType);
    return { fileId, url };
  }

  async stat(fileId: string) {
    return this.minio.statObject(fileId);
  }

  stream(fileId: string) {
    return this.minio.getStream(fileId);
  }

  async remove(fileId: string) {
    await this.minio.remove(fileId);
  }

  async ping() {
    return { ok: await this.minio.ping(), bucket: this.minio.bucketName() };
  }
}