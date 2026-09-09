import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { meetings, meetingParticipants, meetingActivityLog } from "../db/schema";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { nanoid } from "nanoid";

@Injectable()
export class MeetingsService {
  constructor(@Inject(DB) private db: any, private events: EventEmitter2) {}

  async create(userId: string, data: any) {
    const now = Date.now();
    const roomCode = nanoid(10);
    const slug = data.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meeting";
    const [meeting] = await this.db.insert(meetings).values({
      title: data.title, description: data.description, hostId: userId, orgId: data.orgId,
      roomCode, slug, startTime: data.startTime || now, status: "scheduled",
      inviteEmails: data.inviteEmails || [], lobbyEnabled: data.lobbyEnabled || false,
      openToEveryone: data.openToEveryone !== false, createdAt: now,
    }).returning();
    await this.db.insert(meetingParticipants).values({
      meetingId: meeting.id, userId, role: "host", status: "active", joinedAt: now,
    });
    return meeting;
  }

  async list(userId: string) {
    return this.db.execute(sql`
      SELECT m.*, u.name as host_name, u.image as host_image,
        (SELECT count(*)::int FROM meeting_participants mp WHERE mp.meeting_id = m.id) as participant_count
      FROM meetings m LEFT JOIN users u ON m.host_id = u.id
      WHERE m.host_id = ${userId} OR m.open_to_everyone = true
        OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = ${userId})
      ORDER BY m.start_time DESC LIMIT 100
    `);
  }

  async findById(id: string) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
    if (!meeting) throw new NotFoundException("Meeting not found");
    return meeting;
  }

  async join(meetingId: string, userId: string) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    if (!meeting) throw new NotFoundException("Meeting not found");
    if (meeting.locked) throw new NotFoundException("Meeting is locked");
    const now = Date.now();
    const status = meeting.lobbyEnabled && meeting.hostId !== userId ? "waiting" : "active";
    await this.db.insert(meetingParticipants).values({
      meetingId, userId, role: meeting.hostId === userId ? "host" : "participant", status, joinedAt: now,
    }).onConflictDoUpdate({ target: [meetingParticipants.meetingId, meetingParticipants.userId], set: { status, joinedAt: now } });
    if (status === "active" && meeting.status === "scheduled") {
      await this.db.update(meetings).set({ status: "live", lastActiveAt: now }).where(eq(meetings.id, meetingId));
    }
    this.events.emit("meeting:participantUpdate", { meetingId, userId, status });
    return { meetingId, status };
  }

  async leave(meetingId: string, userId: string) {
    const now = Date.now();
    await this.db.update(meetingParticipants).set({ leftAt: now }).where(
      and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId))
    );
    this.events.emit("meeting:participantUpdate", { meetingId, userId, status: "left" });
  }

  async end(meetingId: string, userId: string) {
    const now = Date.now();
    await this.db.update(meetings).set({ status: "ended", endTime: now }).where(eq(meetings.id, meetingId));
    this.events.emit("meeting:ended", { meetingId });
  }

  async getParticipants(meetingId: string) {
    return this.db.execute(sql`
      SELECT mp.*, u.name, u.email, u.image FROM meeting_participants mp
      INNER JOIN users u ON mp.user_id = u.id WHERE mp.meeting_id = ${meetingId}
    `);
  }

  async getByRoomCode(roomCode: string) {
    const [m] = await this.db.select().from(meetings).where(eq(meetings.roomCode, roomCode)).limit(1);
    return m || null;
  }
}
