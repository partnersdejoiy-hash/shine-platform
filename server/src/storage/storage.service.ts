import { Injectable } from "@nestjs/common";
@Injectable()
export class StorageService {
  async getUploadUrl(filename: string, mimeType: string) {
    // TODO: Integrate with MinIO
    return { url: `/api/storage/upload/${filename}`, method: "PUT", headers: { "Content-Type": mimeType } };
  }
  async getDownloadUrl(fileId: string) {
    return { url: `/api/storage/download/${fileId}` };
  }
}
