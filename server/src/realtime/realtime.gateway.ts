import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { OnEvent } from "@nestjs/event-emitter";
import { Inject } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { DB } from "../db/database.module";
import { conversationMembers } from "../db/schema";
import { eq } from "drizzle-orm";

interface AuthSocket extends Socket {
  userId?: string;
  email?: string;
  role?: string;
}

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || process.env.SOCKET_CORS_ORIGIN || "*", credentials: true },
  transports: ["websocket", "polling"],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(@Inject(DB) private db: any) {}

  // userId → Set of socket IDs
  private userSockets = new Map<string, Set<string>>();

  handleConnection(client: AuthSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        // Security: reject unauthenticated connections instead of accepting
        // them silently. The client must pass a valid JWT as handshake auth.
        client.disconnect(true);
        console.warn("[WS] Rejected connection without token:", client.id);
        return;
      }
      const payload = jwt.verify(token as string, process.env.JWT_SECRET || "shine_jwt_secret_2024") as any;
      client.userId = payload.sub;
      client.email = payload.email;
      client.role = payload.role;
      if (!this.userSockets.has(payload.sub)) this.userSockets.set(payload.sub, new Set());
      this.userSockets.get(payload.sub)!.add(client.id);

      // Join personal room for targeted events
      client.join(`user:${payload.sub}`);

      console.log(`[WS] ${payload.email} connected (${client.id})`);
    } catch (err) {
      console.warn("[WS] Auth failed for connection:", client.id);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
          // Broadcast offline presence
          this.server.emit("presence:update", { userId: client.userId, status: "offline" });
        }
      }
      console.log(`[WS] ${client.userId} disconnected (${client.id})`);
    }
  }

  // ── Message events ─────────────────────────────────────────────────
  @OnEvent("message:new")
  onNewMessage(payload: { message: any; conversationId: string }) {
    this.server.to(`conv:${payload.conversationId}`).emit("message:new", payload);
  }

  @OnEvent("message:updated")
  onMessageUpdated(payload: { message: any }) {
    this.server.to(`conv:${payload.message.conversationId}`).emit("message:updated", payload);
  }

  @OnEvent("message:deleted")
  onMessageDeleted(payload: { messageId: string; conversationId: string }) {
    this.server.to(`conv:${payload.conversationId}`).emit("message:deleted", payload);
  }

  @OnEvent("message:reaction")
  onMessageReaction(payload: { messageId: string; conversationId?: string; userId: string; emoji: string }) {
    const room = payload.conversationId ? `conv:${payload.conversationId}` : `conv:${payload.messageId}`;
    this.server.to(room).emit("message:reaction", payload);
  }

  // ── Typing ─────────────────────────────────────────────────────────
  @SubscribeMessage("typing:start")
  onTypingStart(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { conversationId: string }) {
    if (client.userId) {
      client.to(`conv:${data.conversationId}`).emit("typing:start", {
        userId: client.userId, conversationId: data.conversationId,
      });
    }
  }

  @SubscribeMessage("typing:stop")
  onTypingStop(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { conversationId: string }) {
    if (client.userId) {
      client.to(`conv:${data.conversationId}`).emit("typing:stop", {
        userId: client.userId, conversationId: data.conversationId,
      });
    }
  }

  // ── Presence ───────────────────────────────────────────────────────
  @SubscribeMessage("presence:heartbeat")
  onPresenceHeartbeat(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { status: string }) {
    if (client.userId) {
      this.server.emit("presence:update", {
        userId: client.userId, status: data.status, updatedAt: Date.now(),
      });
    }
  }

  // ── Call events ────────────────────────────────────────────────────
  @OnEvent("call:incoming")
  onCallIncoming(payload: { call: any; recipientId: string }) {
    this.server.to(`user:${payload.recipientId}`).emit("call:incoming", payload);
  }

  @OnEvent("call:updated")
  onCallUpdated(payload: { callId: string; status: string }) {
    this.server.emit("call:updated", payload);
  }

  @OnEvent("call:ended")
  onCallEnded(payload: { callId: string }) {
    this.server.emit("call:ended", payload);
  }

  @OnEvent("call:signal")
  onCallSignal(payload: { toId: string; [key: string]: any }) {
    this.server.to(`user:${payload.toId}`).emit("call:signal", payload);
  }

  // ── Meeting events ─────────────────────────────────────────────────
  @OnEvent("meeting:participantUpdate")
  onMeetingParticipantUpdate(payload: { meetingId: string; userId: string; status: string }) {
    this.server.to(`meeting:${payload.meetingId}`).emit("meeting:participantUpdate", payload);
  }

  @OnEvent("meeting:ended")
  onMeetingEnded(payload: { meetingId: string }) {
    this.server.to(`meeting:${payload.meetingId}`).emit("meeting:ended", payload);
  }

  // ── Notifications ──────────────────────────────────────────────────
  @OnEvent("notification:new")
  onNewNotification(payload: { userId: string; [key: string]: any }) {
    this.server.to(`user:${payload.userId}`).emit("notification:new", payload);
  }

  // ── Conversation join/leave ────────────────────────────────────────
  @SubscribeMessage("conv:join")
  onConvJoin(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { conversationId: string }) {
    client.join(`conv:${data.conversationId}`);
  }

  @SubscribeMessage("conv:leave")
  onConvLeave(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { conversationId: string }) {
    client.leave(`conv:${data.conversationId}`);
  }

  /** Auto-join every conversation the user is a member of (on connect). */
  @SubscribeMessage("rooms:subscribe")
  async onRoomsSubscribe(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { conversationIds?: string[] }) {
    if (!client.userId) return;
    if (Array.isArray(data?.conversationIds)) {
      for (const id of data.conversationIds) client.join(`conv:${id}`);
      return;
    }
    const members = await this.db.select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, client.userId));
    for (const m of members) client.join(`conv:${m.conversationId}`);
  }

  // ── Meeting room join/leave ────────────────────────────────────────
  @SubscribeMessage("meeting:join")
  onMeetingJoin(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { meetingId: string }) {
    client.join(`meeting:${data.meetingId}`);
  }

  @SubscribeMessage("meeting:leave")
  onMeetingLeave(@ConnectedSocket() client: AuthSocket, @MessageBody() data: { meetingId: string }) {
    client.leave(`meeting:${data.meetingId}`);
  }

  // ── Utility ────────────────────────────────────────────────────────
  @SubscribeMessage("ping")
  onPing(@ConnectedSocket() client: AuthSocket) {
    return { event: "pong", data: { timestamp: Date.now() } };
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }
}
