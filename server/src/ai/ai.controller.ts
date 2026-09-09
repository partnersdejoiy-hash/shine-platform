import { Controller, Get, Post, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AiService } from "./ai.service";

@Controller("api/ai")
@UseGuards(AuthGuard("jwt"))
export class AiController {
  constructor(private svc: AiService) {}

  @Get("status") status() { return this.svc.status(); }

  @Post("chat") chat(@Req() req: any, @Body() body: any) { return this.svc.chat(req.user.sub, body); }

  @Post("summarize") summarize(@Body() body: any) { return this.svc.summarize(body?.messages || body?.conversation || []); }

  @Post("action-items") actionItems(@Body() body: any) { return this.svc.actionItems(body?.messages || []); }

  @Post("generate-reply") generateReply(@Body() body: any) { return this.svc.generateReply(body?.message || "", body?.tone); }

  @Post("translate") translate(@Body() body: any) { return this.svc.translate(body?.text || "", body?.targetLang || "en"); }

  @Post("fix-grammar") fixGrammar(@Body() body: any) { return this.svc.fixGrammar(body?.text || ""); }
}