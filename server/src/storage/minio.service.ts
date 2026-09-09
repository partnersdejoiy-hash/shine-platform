import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client!: Minio.Client;
  private bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>("minio.bucket") || "shine";
  }

  async onModuleInit() {
    this.client = new Minio.Client({
      endPoint: this.config.get<string>("minio.endpoint")!,
      port: this.config.get<number>("minio.port"),
      useSSL: this.config.get<boolean>("minio.useSSL"),
      accessKey: this.config.get<string>("minio.accessKey")!,
      secretKey: this.config.get<string>("minio.secretKey")!,
    });
    await this.ensureBucket(this.bucket);
  }

  async ensureBucket(name: string) {
    const exists = await this.client.bucketExists(name).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(name);
      this.logger.log(`Created bucket ${name}`);
    }
  }

  /** Public presigned PUT url so browsers upload straight to MinIO. */
  presignedPutUrl(objectKey: string, expirySeconds = 3600) {
    return this.client.presignedPutObject(this.bucket, objectKey, expirySeconds);
  }

  presignedGetUrl(objectKey: string, expirySeconds = 3600) {
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }

  publicUrl(objectKey: string) {
    const base = this.config.get<string>("minio.publicUrl") || "";
    return `${base.replace(/\/$/, "")}/${this.bucket}/${objectKey}`;
  }

  /** Server-side upload (used by imports and the LiveKit egress proxy). */
  async putBuffer(objectKey: string, buffer: Buffer, contentType: string) {
    await this.ensureBucket(this.bucket);
    await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
      "Content-Type": contentType,
    });
    return this.publicUrl(objectKey);
  }

  /** Metadata for a stored object (used to serve files back with correct headers). */
  async statObject(objectKey: string) {
    return this.client.statObject(this.bucket, objectKey);
  }

  /** Readable stream of a stored object. */
  async getStream(objectKey: string) {
    return this.client.getObject(this.bucket, objectKey);
  }

  async remove(objectKey: string) {
    await this.client.removeObject(this.bucket, objectKey).catch(() => undefined);
  }

  /** True when the configured bucket exists and the credentials work. */
  async ping(): Promise<boolean> {
    return await this.client.bucketExists(this.bucket);
  }

  /** The configured bucket name (for health reporting). */
  bucketName(): string {
    return this.bucket;
  }
}
