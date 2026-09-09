import { Injectable, Inject } from "@nestjs/common";
import { eq, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { calls, callSignals, meetingSignals } from "../db/schema";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class CallsService {
  constructor(@Inject(DB) private db: any, private events: EventEmitter2) {}

  async start(userId: string, data: { conversationId: string; recipientId: string; kind: string }) {
    const now = Date.now();
    const [call] = await this.db.insert(calls).values({
      kind: data.kind as any, conversationId: data.conversationId,
      initiatorId: userId, recipientId: data.recipientId, status: "ringing", startedAt: now,
    }).returning();
    this.events.emit("call:incoming", { call, recipientId: data.recipientId });
    return call;
  }

  async answer(callId: string, userId: string) {
    await this.db.update(calls).set({ status: "active" }).where(eq(calls.id, callId));
    this.events.emit("call:updated", { callId, status: "active" });
  }

  async decline(callId: string) {
    const now = Date.now();
    await this.db.update(calls).set({ status: "declined", endedAt: now }).where(eq(calls.id, callId));
    this.events.emit("call:updated", { callId, status: "declined" });
  }

  async end(callId: string) {
    const now = Date.now();
    await this.db.update(calls).set({ status: "ended", endedAt: now }).where(eq(calls.id, callId));
    this.events.emit("call:ended", { callId });
  }

  async sendSignal(data: { callId: string; fromId: string; toId: string; kind: string; payload: string }) {
    const [sig] = await this.db.insert(callSignals).values({ ...data, kind: data.kind as any, createdAt: Date.now() }).returning();
    this.events.emit("call:signal", sig);
    return sig;
  }

  async history(userId: string, limit = 50) {
    return this.db.execute(sql`SELECT c.*, u.name as peer_name, u.image as peer_image
      FROM calls c INNER JOIN users u ON (CASE WHEN c.initiator_id = ${userId} THEN c.recipient_id ELSE c.initiator_id END) = u.id
      WHERE c.initiator_id = ${userId} OR c.recipient_id = ${userId}
      ORDER BY c.started_at DESC LIMIT ${limit}`);
  }

  async liveCalls() {
    return this.db.execute(sql`SELECT c.*, i.name as initiator_name, r.name as recipient_name
      FROM calls c
      INNER JOIN users i ON c.initiator_id = i.id
      INNER JOIN users r ON c.recipient_id = r.id
      WHERE c.status IN ('ringing', 'active')
      ORDER BY c.started_at DESC`);
  }

  async signalsFor(callId: string, userId: string) {
    return this.db.execute(sql`SELECT * FROM call_signals WHERE call_id = ${callId}
      AND (to_id = ${userId} OR from_id = ${userId}) ORDER BY created_at ASC`);
  }

  async meetingSignalsFor(meetingId: string) {
    return this.db.execute(sql`SELECT * FROM meeting_signals WHERE meeting_id = ${meetingId} ORDER BY created_at ASC`);
  }

  async sendMeetingSignal(userId: string, data: any) {
    const [sig] = await this.db.insert(meetingSignals).values({
      meetingId: data.meetingId,
      fromId: userId,
      toId: data.toId,
      kind: data.kind as any,
      payload: data.payload,
      createdAt: Date.now(),
    }).returning();
    this.events.emit("meeting:signal", { ...sig, meetingId: data.meetingId });
    return sig;
  }

  async setRecording(callId: string, userId: string, recording: boolean) {
    await this.db.update(calls).set({ recordingEnabled: recording as any }).where(eq(calls.id, callId));
    this.events.emit("call:recording", { callId, userId, recording });
    return { ok: true, recording };
  }
}
