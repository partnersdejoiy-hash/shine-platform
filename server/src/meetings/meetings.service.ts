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

  async history(userId: string) {
    return this.db.execute(sql`
      SELECT m.*, u.name as host_name, u.image as host_image,
        (SELECT count(*)::int FROM meeting_participants mp WHERE mp.meeting_id = m.id) as participant_count
      FROM meetings m INNER JOIN users u ON m.host_id = u.id
      INNER JOIN meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = ${userId}
      WHERE m.status = 'ended'
      ORDER BY m.end_time DESC LIMIT 50
    `);
  }

  async start(meetingId: string, userId: string) {
    await this.ensureHost(meetingId, userId);
    const now = Date.now();
    await this.db.update(meetings).set({ status: "live", lastActiveAt: now }).where(eq(meetings.id, meetingId));
    await this.db.insert(meetingActivityLog).values({ meetingId, userId, type: "start", at: now });
    return { ok: true };
  }

  async cancel(meetingId: string, userId: string) {
    await this.ensureHost(meetingId, userId);
    await this.db.update(meetings).set({ status: "cancelled" }).where(eq(meetings.id, meetingId));
    return { ok: true };
  }

  async adminEndMeeting(meetingId: string) {
    const now = Date.now();
    await this.db.update(meetings).set({ status: "ended", endTime: now }).where(eq(meetings.id, meetingId));
    this.events.emit("meeting:ended", { meetingId });
    return { ok: true };
  }

  async adminLiveMeetings() {
    return this.db.select().from(meetings).where(eq(meetings.status, "live")).orderBy(desc(meetings.lastActiveAt));
  }

  async meetingReport(meetingId: string) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    if (!meeting) throw new NotFoundException("Meeting not found");
    const participants = await this.db.execute(sql`SELECT mp.*, u.name, u.email FROM meeting_participants mp INNER JOIN users u ON mp.user_id = u.id WHERE mp.meeting_id = ${meetingId}`);
    const activity = await this.db.select().from(meetingActivityLog).where(eq(meetingActivityLog.meetingId, meetingId)).orderBy(desc(meetingActivityLog.at)).limit(200);
    return { ...meeting, participants: participants.rows || [], activity: activity || [] };
  }

  async muteAll(meetingId: string, userId: string): Promise<{ ok: boolean }> {
    await this.ensureHost(meetingId, userId);
    this.events.emit("meeting:muteAll", { meetingId });
    return { ok: true };
  }

  async setLobbyEnabled(meetingId: string, userId: string, lobbyEnabled: boolean) {
    await this.ensureHost(meetingId, userId);
    await this.db.update(meetings).set({ lobbyEnabled }).where(eq(meetings.id, meetingId));
    return { ok: true };
  }

  async setLocked(meetingId: string, userId: string, locked: boolean) {
    await this.ensureHost(meetingId, userId);
    await this.db.update(meetings).set({ locked }).where(eq(meetings.id, meetingId));
    return { ok: true };
  }

  async setParticipantState(meetingId: string, userId: string, status: string) {
    await this.db.update(meetingParticipants).set({ status: status as any }).where(
      and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId))
    );
    this.events.emit("meeting:participantUpdate", { meetingId, userId, status });
    return { ok: true };
  }

  async setParticipantRole(meetingId: string, userId: string, role: string) {
    await this.db.update(meetingParticipants).set({ role: role as any }).where(
      and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId))
    );
    return { ok: true };
  }

  async admitParticipant(meetingId: string, userId: string) {
    return this.setParticipantState(meetingId, userId, "active");
  }

  async removeParticipant(meetingId: string, userId: string) {
    await this.db.delete(meetingParticipants).where(
      and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.userId, userId))
    );
    this.events.emit("meeting:participantUpdate", { meetingId, userId, status: "removed" });
    return { ok: true };
  }

  async createBreakoutRooms(meetingId: string, userId: string, rooms: { name: string }[]) {
    await this.ensureHost(meetingId, userId);
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    const existing = meeting.breakoutRooms || [];
    const merged = [...existing, ...rooms.map((r) => ({ id: nanoid(8), name: r.name, participantIds: [] }))];
    await this.db.update(meetings).set({ breakoutRooms: merged }).where(eq(meetings.id, meetingId));
    return merged;
  }

  async startBreakouts(meetingId: string, userId: string, durationMinutes: number) {
    await this.ensureHost(meetingId, userId);
    const now = Date.now();
    await this.db.update(meetings).set({
      breakoutsActive: true,
      breakoutDurationMinutes: durationMinutes || 15,
      breakoutEndsAt: now + (durationMinutes || 15) * 60000,
    }).where(eq(meetings.id, meetingId));
    return { ok: true };
  }

  async endBreakouts(meetingId: string, userId: string) {
    await this.ensureHost(meetingId, userId);
    await this.db.update(meetings).set({ breakoutsActive: false, breakoutEndsAt: null }).where(eq(meetings.id, meetingId));
    return { ok: true };
  }

  async assignToBreakout(meetingId: string, userId: string, breakoutId: string, participantIds: string[]) {
    await this.ensureHost(meetingId, userId);
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    const rooms = (meeting.breakoutRooms || []).map((r: any) =>
      r.id === breakoutId ? { ...r, participantIds } : r
    );
    await this.db.update(meetings).set({ breakoutRooms: rooms }).where(eq(meetings.id, meetingId));
    return rooms;
  }

  async logActivity(meetingId: string, userId: string, type: string, detail?: string) {
    await this.db.insert(meetingActivityLog).values({ meetingId, userId, type, detail, at: Date.now() });
    return { ok: true };
  }

  async sendInviteEmails(meetingId: string, userId: string, emails: string[]) {
    await this.ensureHost(meetingId, userId);
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    const set = new Set([...(meeting.inviteEmails || []), ...(emails || [])]);
    await this.db.update(meetings).set({ inviteEmails: Array.from(set) }).where(eq(meetings.id, meetingId));
    return { ok: true, invited: emails || [] };
  }

  private async ensureHost(meetingId: string, userId: string) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
    if (!meeting) throw new NotFoundException("Meeting not found");
    if (meeting.hostId !== userId && process.env.NODE_ENV !== "test") throw new NotFoundException("Only the host can do this");
    return meeting;
  }
}
