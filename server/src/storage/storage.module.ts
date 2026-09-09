import { Module } from "@nestjs/common";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";
import { MinioService } from "./minio.service";
@Module({
  controllers: [StorageController],
  providers: [StorageService, MinioService],
  exports: [StorageService, MinioService],
})
export class StorageModule {}