import { Controller, Post, Get, Param, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Inject } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DB } from "../db/database.module";
import { typing } from "../db/schema";
import { RealtimeGateway } from "./realtime.gateway";

const TYPING_TTL_MS = 4000;

@Controller("api/realtime")
@UseGuards(AuthGuard("jwt"))
export class RealtimeController {
  constructor(
    @Inject(DB) private db: any,
    private gateway: RealtimeGateway,
  ) {}

  @Post("typing")
  async setTyping(@Req() req: any, @Body() body: { conversationId: string; isTyping: boolean }) {
    const now = Date.now();
    await this.db.delete(typing).where(
      and(eq(typing.conversationId, body.conversationId), eq(typing.userId, req.user.sub))
    );
    if (body.isTyping) {
      await this.db.insert(typing).values({
        conversationId: body.conversationId,
        userId: req.user.sub,
        expiresAt: now + TYPING_TTL_MS,
      });
      this.gateway.emitToRoom(`conv:${body.conversationId}`, "typing:start", {
        userId: req.user.sub, conversationId: body.conversationId,
      });
    } else {
      this.gateway.emitToRoom(`conv:${body.conversationId}`, "typing:stop", {
        userId: req.user.sub, conversationId: body.conversationId,
      });
    }
    return { ok: true };
  }

  @Get("typing/:conversationId")
  async whoIsTyping(@Param("conversationId") conversationId: string) {
    const rows = await this.db.select()
      .from(typing)
      .where(eq(typing.conversationId, conversationId));
    const now = Date.now();
    const active = rows.filter((r: any) => r.expiresAt > now);
    return active.map((r: any) => ({ userId: r.userId, expiresAt: r.expiresAt }));
  }
}