import { Controller, Get } from "@nestjs/common";

@Controller("api/health")
export class HealthController {
  @Get()
  healthCheck() {
    return { status: "ok", timestamp: Date.now() };
  }

  @Get("ping")
  ping() {
    return { status: "ok", timestamp: Date.now() };
  }
}
