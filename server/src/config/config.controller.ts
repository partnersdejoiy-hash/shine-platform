import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Controller("api/config")
@UseGuards(AuthGuard("jwt"))
export class ConfigController {
  @Get("rtc")
  rtcConfig() {
    return {
      enabled: true,
      provider: "livekit",
      url: process.env.LIVEKIT_URL || "",
      apiKey: process.env.LIVEKIT_API_KEY || "",
      // apiSecret intentionally never sent to the browser
    };
  }
}