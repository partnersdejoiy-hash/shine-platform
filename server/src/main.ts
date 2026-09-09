import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import * as express from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers.
  app.use(helmet());

  // CORS — strict from env. Never "*" with credentials in production.
  const corsOrigins = (process.env.CORS_ORIGIN || process.env.SOCKET_CORS_ORIGIN || "https://app.shine.dejoiy.com")
    .split(",").map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins.includes("*") ? true : corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Global validation & normalization. Controllers use `@Body() any`, so we do
  // NOT whitelist-strip (that would break them); transform still coerces types.
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));

  // Larger JSON payloads (chat attachments metadata, imports).
  app.useBodyParser("json", { limit: "25mb" });

  // Direct binary uploads go to MinIO via /api/storage/upload as raw body.
  app.use(
    "/api/storage/upload",
    express.raw({ type: "*/*", limit: "200mb" }),
  );

  const port = process.env.PORT || process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`[SHINE API] Running on port ${port}`);
}
bootstrap();