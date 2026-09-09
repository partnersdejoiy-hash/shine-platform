import { Controller, Get } from "@nestjs/common";
import { HealthCheckService, HealthCheck, TypeOrmHealthIndicator } from "@nestjs/terminus";
import { Inject } from "@nestjs/common";
import { DB } from "../db/database.module";

@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
  ) {}

  @Get("health")
  healthCheck() {
    return this.health.check([]);
  }

  @Get("ready")
  ready() {
    return { status: "ok", timestamp: Date.now() };
  }

  @Get("live")
  live() {
    return { status: "alive", uptime: process.uptime() };
  }
}
