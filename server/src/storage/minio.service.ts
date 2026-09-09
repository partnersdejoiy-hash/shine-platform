import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as Minio from "minio";

const env = process.env;

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client!: Minio.Client;
  private bucket: string;

  constructor() {
    this.bucket = env.MINIO_BUCKET || env.minio_bucket || "shine";
  }

  async onModuleInit() {
    const endPoint = env.MINIO_ENDPOINT || env.minio_endpoint || "localhost";
    this.client = new Minio.Client({
      endPoint,
      port: parseInt(env.MINIO_PORT || env.minio_port || "9000", 10),
      useSSL: (env.MINIO_USE_SSL || env.minio_useSSL || "false") === "true",
      accessKey: env.MINIO_ACCESS_KEY || env.minio_accessKey || env.MINIO_ROOT_USER || "minioadmin",
      secretKey: env.MINIO_SECRET_KEY || env.minio_secretKey || env.MINIO_ROOT_PASSWORD || "minioadmin",
    });
    await this.ensureBucket(this.bucket);
    this.logger.log(`MinIO connected (endpoint=${endPoint}, bucket=${this.bucket})`);
  }

  private objectKeyFor(fileId: string, folder = "") {
    return folder ? `${folder}/${fileId}` : fileId;
  }

  async ensureBucket(name: string) {
    const exists = await this.client.bucketExists(name).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(name);
      this.logger.log(`Created bucket ${name}`);
    }
  }

  /** Path-suffix style key (chat/, avatars/, recordings/...). */
  objectKeyForPrefix(prefix: string, filename: string): string {
    const clean = filename.replace(/[/\\]/g, "-").replace(/\s+/g, "_");
    const stamp = Date.now().toString(36);
    return `${prefix.replace(/^\/+|\/+$/g, "")}/${stamp}-${clean}`;
  }

  /** Public presigned PUT url so browsers upload straight to MinIO. */
  presignedPutUrl(objectKey: string, expirySeconds = 3600) {
    return this.client.presignedPutObject(this.bucket, objectKey, expirySeconds);
  }

  presignedGetUrl(objectKey: string, expirySeconds = 3600) {
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }

  publicUrl(objectKey: string) {
    const base = env.MINIO_PUBLIC_URL || "";
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