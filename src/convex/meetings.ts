import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v, type ObjectType } from "convex/values";
import { getCurrentUser, isSuperAdmin, logAudit } from "./users";
import { roleHasPermission } from "./permissions";

const CODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_DIGITS = "0123456789";

/**
 * DJM meeting codes: `DJM-XXX-###` — e.g. DJM-ABC-123.
 * Three alphabetic characters followed by three digits, always unique per meeting.
 */
export function makeRoomCode(): string {
  let letters = "";
  for (let i = 0; i < 3; i++) {
    letters += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  }
  let digits = "";
  for (let i = 0; i < 3; i++) {
    digits += CODE_DIGITS[Math.floor(Math.random() * CODE_DIGITS.length)];
  }
  return `DJM-${letters}-${digits}`;
}

/** URL-safe slug from a meeting title — used in the shareable link. */
export function slugifyTitle(title: string): string {
  const slug = (title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "meeting";
}

/** Normalize a user-typed code: trim, uppercase, and fix separators. */
export function normalizeRoomCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 9) return code.trim().toUpperCase();
  return `DJM-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
}

/** Find a user account by email, case-insensitively. */
async function findUserByEmail(ctx: QueryCtx, email: string) {
  const needle = email.trim().toLowerCase();
  const exact = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", needle))
    .first();
  if (exact) return exact;
  const asIs = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email.trim()))
    .first();
  if (asIs) return asIs;
  // last-resort case-insensitive scan for mixed-case stored emails
  const recent = await ctx.db.query("users").take(2000);
  return recent.find((u) => (u.email ?? "").toLowerCase() === needle) ?? null;
}

/**
 * Schedule a meeting. Creates the meeting + a linked chat conversation,
 * provisions invited attendees (by email) as participants, and returns
 * everything the client needs to send invitation emails.
 */
const createArgs = {
    title: v.string(),
    description: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    password: v.optional(v.string()),
    inviteEmails: v.optional(v.array(v.string())),
    recordingEnabled: v.optional(v.boolean()),
    kind: v.optional(v.union(v.literal("meeting"), v.literal("webinar"))),
    openToEveryone: v.optional(v.boolean()),
};

async function createMeeting(
  ctx: MutationCtx,
  me: Doc<"users">,
  { title, description, orgId, startTime, endTime, password, inviteEmails, recordingEnabled, kind, openToEveryone }: ObjectType<typeof createArgs>,
) {
    if (
      !isSuperAdmin(me) &&
      !(await roleHasPermission(ctx, me.role, "start_meeting", me.approvedPermissions))
    ) {
      throw new Error(
        "Your role does not include starting meetings — request it from Settings → Security",
      );
    }
    const now = Date.now();

    // generate a unique DJM-XXX-### code
    let roomCode = makeRoomCode();
    for (let attempt = 0; attempt < 12; attempt++) {
      const taken = await ctx.db
        .query("meetings")
        .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
        .first();
      if (!taken) break;
      roomCode = makeRoomCode();
    }

    const invites = [
      ...new Set(
        (inviteEmails ?? [])
          .map((e) => e.trim().toLowerCase())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ),
    ];

    const meetingId = await ctx.db.insert("meetings", {
      title: title.trim(),
      description,
      hostId: me._id,
      orgId,
      kind: kind === "webinar" ? "webinar" : "meeting",
      roomCode,
      password,
      startTime,
      endTime,
      status: "scheduled",
      inviteEmails: invites,
      recordingEnabled: recordingEnabled === true,
      slug: slugifyTitle(title),
      // default: open to everyone; when false only host + invitees may enter
      openToEveryone: openToEveryone !== false,
      lastActiveAt: now,
      createdAt: now,
    });

    // linked conversation for meeting chat + files
    const convId = await ctx.db.insert("conversations", {
      kind: "channel",
      channelKind: "channel",
      name: `Meeting: ${title.trim()}`,
      description: `Chat for meeting ${roomCode}`,
      orgId,
      createdBy: me._id,
      isMeeting: true,
      createdAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId: me._id,
      role: "owner",
      lastReadAt: now,
      joinedAt: now,
    });
    await ctx.db.insert("meetingParticipants", {
      meetingId,
      userId: me._id,
      role: "host",
      joinedAt: now,
      isMuted: false,
      isVideoOn: true,
    });

    // provision invited attendees + notify them in-app
    const invitees: { email: string; name?: string }[] = [];
    for (const email of invites) {
      const target = await findUserByEmail(ctx, email);
      invitees.push({ email, name: target?.name ?? undefined });
      if (!target || target._id === me._id) continue;
      const existing = await ctx.db
        .query("meetingParticipants")
        .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
        .filter((q) => q.eq(q.field("userId"), target._id))
        .unique();
      if (!existing) {
        await ctx.db.insert("meetingParticipants", {
          meetingId,
          userId: target._id,
          role: "participant",
          joinedAt: now,
          isMuted: false,
          isVideoOn: true,
        });
      }
      const member = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user_conv", (q) => q.eq("userId", target._id).eq("conversationId", convId))
        .unique();
      if (!member) {
        await ctx.db.insert("conversationMembers", {
          conversationId: convId,
          userId: target._id,
          role: "member",
          joinedAt: now,
        });
      }
      await ctx.db.insert("notifications", {
        userId: target._id,
        kind: "meeting.invite",
        title: `You're invited: ${title.trim()}`,
        body: `${me.name ?? "Someone"} scheduled a meeting on ${new Date(startTime).toLocaleString()}. Room ${roomCode}`,
        conversationId: convId,
        link: `/meet/${meetingId}`,
        read: false,
        createdAt: now,
      });
    }

    await logAudit(ctx, me._id, "meeting.scheduled", "meetings", String(meetingId), title);
    return {
      meetingId,
      roomCode,
      conversationId: convId,
      invitees,
      slug: slugifyTitle(title),
    };
}

export const create = mutation({
  args: createArgs,
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    return createMeeting(ctx, me, args);
  },
});

/** "Add Shine meeting" from a Dejoiy Mail calendar event: a room for that event (the mail calendar sends the invites). */
export const createFromMail = internalMutation({
  args: { hostEmail: v.string(), ...createArgs },
  handler: async (ctx, { hostEmail, ...args }) => {
    const me = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", hostEmail.toLowerCase()))
      .first();
    if (!me || me.isActive === false) throw new Error("This mailbox has no Shine account yet. Open Shine once from Dejoiy Mail.");
    return createMeeting(ctx, me, args);
  },
});

export const myMeetings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { hosted: [], attending: [] };
    const now = Date.now();

    const hosted = await ctx.db
      .query("meetings")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .collect();

    const participants = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const attended = [];
    for (const p of participants) {
      const m = await ctx.db.get(p.meetingId);
      if (m && m.hostId !== userId && m.status !== "ended") attended.push(m);
    }

    const enrich = async (meetings: any[]) => {
      const rows = [];
      for (const m of meetings) {
        const host = await ctx.db.get(m.hostId);
        const conv = await ctx.db
          .query("conversations")
          .withIndex("by_org", (q) => (m.orgId ? q.eq("orgId", m.orgId) : q))
          .filter((q) =>
            q.and(
              q.eq(q.field("isMeeting"), true),
              q.eq(q.field("name"), `Meeting: ${m.title}`),
            ),
          )
          .first();
        const count = await ctx.db
          .query("meetingParticipants")
          .withIndex("by_meeting", (q) => q.eq("meetingId", m._id))
          .collect()
          .then((rows) => rows.filter((r) => !r.leftAt).length);
        rows.push({ ...m, host, conversationId: conv?._id ?? null, participantCount: count });
      }
      return rows;
    };

    const hostedEnriched = await enrich(
      hosted.filter((m) => m.status !== "ended" && m.kind !== "breakout"),
    );
    return {
      hosted: hostedEnriched.sort((a, b) => a.startTime - b.startTime),
      attending: await enrich(attended),
    };
  },
});

async function loadDetail(ctx: QueryCtx, meetingId: Id<"meetings">) {
  const meeting = await ctx.db.get(meetingId);
  if (!meeting) return null;
  const host = await ctx.db.get(meeting.hostId);
  const participants = await ctx.db
    .query("meetingParticipants")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .collect();
  const participantUsers = await Promise.all(
    participants.map(async (p) => {
      const u = await ctx.db.get(p.userId);
      return u ? { ...p, user: u } : null;
    }),
  );
  const conv = await ctx.db
    .query("conversations")
    .filter((q) =>
      q.and(
        q.eq(q.field("isMeeting"), true),
        q.eq(q.field("name"), `Meeting: ${meeting.title}`),
      ),
    )
    .first();
  return {
    meeting,
    host,
    participants: participantUsers.filter((p): p is NonNullable<typeof p> => p !== null),
    conversationId: conv?._id ?? null,
  };
}

export const detail = query({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => loadDetail(ctx, meetingId),
});

export const detailByCode = query({
  args: { roomCode: v.string() },
  handler: async (ctx, { roomCode }) => {
    const normalized = normalizeRoomCode(roomCode);
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", normalized))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();
    if (!meeting) return null;
    return await loadDetail(ctx, meeting._id);
  },
});

export const join = mutation({
  args: { meetingId: v.id("meetings"), isMuted: v.optional(v.boolean()), isVideoOn: v.optional(v.boolean()) },
  handler: async (ctx, { meetingId, isMuted = false, isVideoOn = true }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.status === "ended" || meeting.status === "cancelled") {
      throw new Error("This meeting has ended");
    }
    // Locked meetings reject new joiners (the host and admitted members pass).
    if (meeting.locked && meeting.hostId !== me._id) {
      throw new Error("This meeting is locked by the host");
    }
    const now = Date.now();
    const isHost = meeting.hostId === me._id;

    const existing = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), me._id))
      .unique();

    // Private meetings: only the host and invited participants (rows provisioned
    // at creation, or the host's inviteEmails) may enter. This also blocks
    // admins from joining a meeting that isn't open to everyone.
    if (meeting.openToEveryone === false && !isHost) {
      const isInvited =
        !!existing ||
        (meeting.inviteEmails ?? []).some(
          (e) => e.toLowerCase() === (me.email ?? "").toLowerCase(),
        );
      if (!isInvited) {
        throw new Error(
          "This meeting is private — only invited participants can join. Ask the host to add you.",
        );
      }
    }
    // Waiting-room (lobby admission): non-host joiners wait until the host
    // admits them — unless they are already admitted (invitees are active).
    let status: "active" | "waiting" = "active";
    if (!isHost && meeting.lobbyEnabled && !(existing && existing.status === "active")) {
      status = "waiting";
    }
    if (existing) {
      const keep = existing.status === "active" ? "active" : status;
      await ctx.db.patch(existing._id, {
        joinedAt: now,
        leftAt: undefined,
        isMuted,
        isVideoOn,
        status: keep,
      });
    } else {
      await ctx.db.insert("meetingParticipants", {
        meetingId,
        userId: me._id,
        role: isHost ? "host" : "participant",
        status,
        joinedAt: now,
        isMuted,
        isVideoOn,
      });
    }

    // link the meeting conversation
    const conv = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.and(
          q.eq(q.field("isMeeting"), true),
          q.eq(q.field("name"), `Meeting: ${meeting.title}`),
        ),
      )
      .first();
    if (conv) {
      const mem = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conv._id))
        .unique();
      if (!mem) {
        await ctx.db.insert("conversationMembers", {
          conversationId: conv._id,
          userId: me._id,
          role: "member",
          joinedAt: now,
        });
      }
    }

    // Only an admitted participant (or the host) actually starts the meeting.
    if (meeting.status === "scheduled" && status !== "waiting") {
      await ctx.db.patch(meetingId, { status: "live", startTime: now, lastActiveAt: now });
    } else {
      await ctx.db.patch(meetingId, { lastActiveAt: now });
    }
    return meetingId;
  },
});

// ---- Host controls -----------------------------------------------------------

/** True when the caller is the host or a co-host (moderator) of the meeting. */
async function isManager(
  ctx: MutationCtx,
  meetingId: Id<"meetings">,
  userId: Id<"users">,
): Promise<boolean> {
  const p = await ctx.db
    .query("meetingParticipants")
    .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
    .filter((q) => q.eq(q.field("userId"), userId))
    .unique();
  return !!p && (p.role === "host" || p.role === "moderator");
}

export const admitParticipant = mutation({
  args: { meetingId: v.id("meetings"), userId: v.id("users"), admit: v.boolean() },
  handler: async (ctx, { meetingId, userId, admit }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can admit people");
    }
    const p = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!p) throw new Error("Not in this meeting");
    await ctx.db.patch(p._id, {
      status: admit ? "active" : "denied",
      leftAt: undefined,
    });
    await logAudit(ctx, me._id, "meeting.admit", "meetings", String(meetingId), `${userId}:${admit ? "admit" : "deny"}`);
  },
});

export const setLobbyEnabled = mutation({
  args: { meetingId: v.id("meetings"), enabled: v.boolean() },
  handler: async (ctx, { meetingId, enabled }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can change this");
    }
    await ctx.db.patch(meetingId, { lobbyEnabled: enabled });
  },
});

export const setLocked = mutation({
  args: { meetingId: v.id("meetings"), locked: v.boolean() },
  handler: async (ctx, { meetingId, locked }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can change this");
    }
    await ctx.db.patch(meetingId, { locked });
  },
});

/** Host promotes/demotes a co-host (role moderator). */
export const setParticipantRole = mutation({
  args: {
    meetingId: v.id("meetings"),
    userId: v.id("users"),
    role: v.union(v.literal("moderator"), v.literal("participant")),
  },
  handler: async (ctx, { meetingId, userId, role }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const meeting = await ctx.db.get(meetingId);
    if (!meeting || meeting.hostId !== me._id) {
      throw new Error("Only the host can assign co-hosts");
    }
    if (userId === me._id) throw new Error("You are the host already");
    const p = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!p) throw new Error("Not in this meeting");
    await ctx.db.patch(p._id, { role });
    await logAudit(ctx, me._id, "meeting.cohost", "meetings", String(meetingId), `${userId}:${role}`);
  },
});

/** Host/co-host removes a participant from the meeting. */
export const removeParticipant = mutation({
  args: { meetingId: v.id("meetings"), userId: v.id("users") },
  handler: async (ctx, { meetingId, userId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can remove people");
    }
    const meeting = await ctx.db.get(meetingId);
    if (meeting && meeting.hostId === userId) throw new Error("Cannot remove the host");
    const p = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!p) return;
    // no leftAt: the removed user stays listed with status "denied" so their
    // client can show the "you were removed" screen before they leave
    await ctx.db.patch(p._id, { status: "denied" });
    await logAudit(ctx, me._id, "meeting.remove", "meetings", String(meetingId), String(userId));
  },
});

/** Mute everyone except the host. Clients enforce it by muting the audio. */
export const muteAll = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can mute everyone");
    }
    const meeting = await ctx.db.get(meetingId);
    const parts = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();
    for (const p of parts) {
      if (meeting && p.userId !== meeting.hostId && p.role !== "moderator") {
        await ctx.db.patch(p._id, { isMuted: true });
      }
    }
  },
});

// ---- Breakout rooms -----------------------------------------------------------

export const createBreakoutRooms = mutation({
  args: {
    meetingId: v.id("meetings"),
    names: v.array(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, { meetingId, names, durationMinutes }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can manage breakout rooms");
    }
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    const cleaned = names.map((n) => n.trim()).filter(Boolean).slice(0, 8);
    if (cleaned.length === 0) {
      // Duration-only update (host toggled the timer after creating rooms).
      const existingRooms = meeting.breakoutRooms as any[] | undefined;
      if (existingRooms && existingRooms.length > 0) {
        const duration =
          durationMinutes && durationMinutes > 0 ? Math.min(600, Math.round(durationMinutes)) : undefined;
        await ctx.db.patch(meetingId, {
          breakoutDurationMinutes: duration,
          breakoutEndsAt: duration ? meeting.breakoutEndsAt : undefined,
        });
        return;
      }
      throw new Error("Add at least one breakout room");
    }
    const rooms = cleaned.map((name) => ({
      id: `br-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      participantIds: [] as Id<"users">[],
    }));
    const duration =
      durationMinutes && durationMinutes > 0 ? Math.min(600, Math.round(durationMinutes)) : undefined;
    await ctx.db.patch(meetingId, {
      breakoutRooms: rooms,
      breakoutsActive: false,
      breakoutDurationMinutes: duration,
      breakoutEndsAt: undefined,
    });
  },
});

export const assignToBreakout = mutation({
  args: { meetingId: v.id("meetings"), userId: v.id("users"), roomId: v.optional(v.string()) },
  handler: async (ctx, { meetingId, userId, roomId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can assign breakout rooms");
    }
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    const rooms = meeting.breakoutRooms ?? [];
    const next = rooms.map((r) => ({
      ...r,
      participantIds: r.participantIds.filter((id) => String(id) !== String(userId)),
    }));
    if (roomId) {
      const target = next.find((r) => r.id === roomId);
      if (target && !target.participantIds.includes(userId)) {
        target.participantIds.push(userId);
      }
    }
    await ctx.db.patch(meetingId, { breakoutRooms: next });
  },
});

/** Start every configured breakout room as a child meeting (mesh moves with them). */
export const startBreakouts = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can start breakout rooms");
    }
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    const rooms = meeting.breakoutRooms ?? [];
    if (rooms.length === 0) throw new Error("No breakout rooms configured");
    if (meeting.breakoutsActive) throw new Error("Breakout rooms are already running");

    const now = Date.now();
    const started: typeof rooms = [];
    for (const room of rooms) {
      let code = makeRoomCode();
      for (let i = 0; i < 12; i++) {
        const taken = await ctx.db
          .query("meetings")
          .withIndex("by_roomCode", (q) => q.eq("roomCode", code))
          .first();
        if (!taken) break;
        code = makeRoomCode();
      }
      const childId = await ctx.db.insert("meetings", {
        title: room.name,
        hostId: meeting.hostId,
        orgId: meeting.orgId,
        kind: "breakout",
        roomCode: code,
        startTime: now,
        status: "live",
        parentMeetingId: meetingId,
        createdAt: now,
      });
      const convId = await ctx.db.insert("conversations", {
        kind: "channel",
        channelKind: "channel",
        name: `Breakout: ${room.name}`,
        description: `Chat for breakout room ${room.name}`,
        orgId: meeting.orgId,
        createdBy: meeting.hostId,
        isMeeting: true,
        createdAt: now,
      });
      await ctx.db.insert("conversationMembers", {
        conversationId: convId,
        userId: meeting.hostId,
        role: "owner",
        joinedAt: now,
      });
      const memberIds = [...room.participantIds];
      if (!memberIds.includes(meeting.hostId)) memberIds.push(meeting.hostId);
      for (const uid of memberIds) {
        await ctx.db.insert("meetingParticipants", {
          meetingId: childId,
          userId: uid,
          role: meeting.hostId === uid ? "host" : "participant",
          status: "active",
          joinedAt: now,
        });
        const mem = await ctx.db
          .query("conversationMembers")
          .withIndex("by_user_conv", (q) => q.eq("userId", uid).eq("conversationId", convId))
          .unique();
        if (!mem) {
          await ctx.db.insert("conversationMembers", {
            conversationId: convId,
            userId: uid,
            role: "member",
            joinedAt: now,
          });
        }
      }
      started.push({ ...room, childMeetingId: childId });
    }
    const duration = meeting.breakoutDurationMinutes ?? undefined;
    await ctx.db.patch(meetingId, {
      breakoutRooms: started,
      breakoutsActive: true,
      breakoutEndsAt: duration ? now + duration * 60_000 : undefined,
    });
    await ctx.db.insert("notifications", {
      userId: meeting.hostId,
      kind: "meeting.breakout",
      title: "Breakout rooms started",
      body: `${started.length} breakout room${started.length > 1 ? "s" : ""} running — assign participants to move them.`,
      link: `/meet/${meetingId}`,
      read: false,
      createdAt: now,
    });
    await logAudit(ctx, me._id, "meeting.breakouts_start", "meetings", String(meetingId));
  },
});

/** End all breakout rooms — everyone is sent back to the main meeting. */
export const endBreakouts = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(await isManager(ctx, meetingId, me._id))) {
      throw new Error("Only the host or a co-host can end breakout rooms");
    }
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    const now = Date.now();
    for (const room of meeting.breakoutRooms ?? []) {
      if (!room.childMeetingId) continue;
      const child = await ctx.db.get(room.childMeetingId);
      if (child && child.status !== "ended") {
        await ctx.db.patch(room.childMeetingId, { status: "ended", endTime: now });
        const parts = await ctx.db
          .query("meetingParticipants")
          .withIndex("by_meeting", (q) => q.eq("meetingId", room.childMeetingId as Id<"meetings">))
          .filter((q) => q.eq(q.field("leftAt"), undefined))
          .collect();
        for (const p of parts) await ctx.db.patch(p._id, { leftAt: now });
      }
    }
    await ctx.db.patch(meetingId, {
      breakoutsActive: false,
      breakoutRooms: [],
      breakoutEndsAt: undefined,
      breakoutDurationMinutes: undefined,
    });
    await logAudit(ctx, me._id, "meeting.breakouts_end", "meetings", String(meetingId));
  },
});

export const leave = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const participant = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), me._id))
      .unique();
    if (participant) {
      const now = Date.now();
      await ctx.db.patch(participant._id, { leftAt: now });
      await ctx.db.patch(meetingId, { lastActiveAt: now });
    }
  },
});

export const setParticipantState = mutation({
  args: {
    meetingId: v.id("meetings"),
    isMuted: v.optional(v.boolean()),
    isVideoOn: v.optional(v.boolean()),
    hasRaisedHand: v.optional(v.boolean()),
  },
  handler: async (ctx, { meetingId, ...state }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const participant = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), me._id))
      .unique();
    if (!participant) return;
    const patch: Record<string, unknown> = {};
    if (state.isMuted !== undefined) patch.isMuted = state.isMuted;
    if (state.isVideoOn !== undefined) patch.isVideoOn = state.isVideoOn;
    if (state.hasRaisedHand !== undefined) patch.hasRaisedHand = state.hasRaisedHand;
    await ctx.db.patch(participant._id, patch);
    await ctx.db.patch(meetingId, { lastActiveAt: Date.now() });
  },
});

export const end = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.hostId !== me._id) throw new Error("Only the host can end the meeting");
    const now = Date.now();
    await ctx.db.patch(meetingId, { status: "ended", endTime: now });
    const participants = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();
    for (const p of participants) {
      await ctx.db.patch(p._id, { leftAt: now });
    }
    // end any running breakout rooms with the main meeting
    for (const room of meeting.breakoutRooms ?? []) {
      if (!room.childMeetingId) continue;
      const child = await ctx.db.get(room.childMeetingId);
      if (child && child.status !== "ended") {
        await ctx.db.patch(room.childMeetingId, { status: "ended", endTime: now });
      }
    }
  },
});

export const cancel = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const meeting = await ctx.db.get(meetingId);
    if (!meeting || meeting.hostId !== me._id) throw new Error("Only the host can cancel");
    await ctx.db.patch(meetingId, { status: "cancelled" });
    // cancel it on the Dejoiy Mail calendar too; guests get the cancellation from there
    if (meeting.calendarInvId) await ctx.scheduler.runAfter(0, internal.calendarLink.cancelMeeting, { meetingId });
  },
});

export const history = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const hosted = await ctx.db
      .query("meetings")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .collect();
    const participants = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ids = new Set<string>();
    for (const h of hosted) ids.add(h._id);
    for (const p of participants) ids.add(p.meetingId);
    const rows = [];
    for (const id of ids) {
      const m = await ctx.db.get(id as Id<"meetings">);
      if (m && m.status === "ended" && m.kind !== "breakout") rows.push(m);
    }
    return rows.sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0)).slice(0, 20);
  },
});

/**
 * Log a meeting event for the report timeline. Fire-and-forget from the
 * client: joins, leaves, mute/camera toggles, hand raises, screen shares,
 * chat messages, reactions and poll votes. Only participants may log.
 */
export const logActivity = mutation({
  args: {
    meetingId: v.id("meetings"),
    type: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { meetingId, type, detail }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const participant = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!participant) return;
    const at = Date.now();
    await ctx.db.insert("meetingActivityLog", {
      meetingId,
      userId,
      type,
      detail: detail ?? undefined,
      at,
    });
    await ctx.db.patch(meetingId, { lastActiveAt: at });
    // bump the matching counter on the participant row (drives the report)
    const field = ({
      chat: "chatMessages",
      reaction: "reactionsSent",
      screen_share: "screenShares",
      mute: "muteToggles",
      unmute: "muteToggles",
      camera_on: "cameraToggles",
      camera_off: "cameraToggles",
      hand_raise: "handRaises",
      poll_vote: "pollVotes",
    } as Record<string, string>)[type];
    if (field) {
      const current = (participant as any)[field] ?? 0;
      await ctx.db.patch(participant._id, { [field]: current + 1 });
    }
  },
});

/**
 * Everything the host needs for the meeting report (Excel export): the
 * meeting summary, attendance with join/leave times, per-participant activity
 * counters, the event timeline and the meeting chat.
 */
export const meetingReport = query({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return null;
    const meeting = await ctx.db.get(meetingId);
    if (!meeting) return null;
    const isHost = meeting.hostId === me._id;
    const isModerator = !isHost && (await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.and(q.eq(q.field("userId"), me._id), q.eq(q.field("role"), "moderator")))
      .unique()) !== null;
    if (!isHost && !isModerator) {
      throw new Error("Only the host or a co-host can download the report");
    }

    const host = await ctx.db.get(meeting.hostId);
    const participants = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .collect();
    const withUsers = [];
    for (const p of participants) {
      const u = await ctx.db.get(p.userId);
      if (u) withUsers.push({ ...p, user: u });
    }

    const events = await ctx.db
      .query("meetingActivityLog")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .order("asc")
      .collect();
    const eventsWithUsers = [];
    for (const e of events) {
      const u = await ctx.db.get(e.userId);
      if (u) eventsWithUsers.push({ ...e, user: u });
    }

    const conv = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.and(
          q.eq(q.field("isMeeting"), true),
          q.eq(q.field("name"), `Meeting: ${meeting.title}`),
        ),
      )
      .first();

    let chat: any[] = [];
    if (conv) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("asc")
        .collect();
      for (const m of msgs) {
        const s = await ctx.db.get(m.senderId);
        chat.push({ ...m, sender: s ?? null });
      }
    }

    return {
      meeting: { ...meeting, slug: meeting.slug ?? slugifyTitle(meeting.title) },
      host,
      participants: withUsers,
      events: eventsWithUsers,
      chat,
      durationSeconds: meeting.startTime ? Math.max(0, ((meeting.endTime ?? Date.now()) - meeting.startTime) / 1000) : 0,
    };
  },
});

// ---- Admin controls & idle sweep ----------------------------------------------

/**
 * Admins / super admins can end any ongoing meeting (not just their own).
 * The host's in-room "End" stays for the host; this is the admin override.
 */
export const adminEndMeeting = mutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("_id"), me._id))
      .first();
    const isAdminUser =
      (admin?.role === "super_admin" || admin?.role === "admin") ||
      me.role === "super_admin" ||
      me.role === "admin";
    if (!isAdminUser) throw new Error("Admins only");

    const meeting = await ctx.db.get(meetingId);
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.status === "ended") return;
    const now = Date.now();
    await ctx.db.patch(meetingId, { status: "ended", endTime: now, lastActiveAt: now });
    const participants = await ctx.db
      .query("meetingParticipants")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.eq(q.field("leftAt"), undefined))
      .collect();
    for (const p of participants) await ctx.db.patch(p._id, { leftAt: now });
    // end any breakout child rooms too
    for (const room of meeting.breakoutRooms ?? []) {
      if (!room.childMeetingId) continue;
      await ctx.db.patch(room.childMeetingId as Id<"meetings">, { status: "ended", endTime: now });
    }
    await logAudit(ctx, me._id, "admin.meeting_ended", "meetings", String(meetingId), meeting.title);
  },
});

/** Live meetings list for the admin dashboard (admins can end any of these). */
export const adminLiveMeetings = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const isAdminUser = me.role === "super_admin" || me.role === "admin";
    if (!isAdminUser) return [];
    const live = await ctx.db
      .query("meetings")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .order("desc")
      .take(50);
    const rows = [];
    for (const m of live) {
      if (m.kind === "breakout") continue;
      const host = await ctx.db.get(m.hostId);
      const parts = await ctx.db
        .query("meetingParticipants")
        .withIndex("by_meeting", (q) => q.eq("meetingId", m._id))
        .filter((q) => q.eq(q.field("leftAt"), undefined))
        .collect();
      rows.push({
        _id: m._id,
        title: m.title,
        roomCode: m.roomCode,
        slug: m.slug ?? slugifyTitle(m.title),
        openToEveryone: m.openToEveryone !== false,
        startTime: m.startTime,
        hostName: host?.name ?? host?.email ?? "Unknown",
        participantCount: parts.length,
      });
    }
    return rows;
  },
});

/**
 * Cron target: end any meeting that has had nobody present for 30 minutes.
 * Runs every 5 minutes via src/convex/crons.ts. Internal (cron-only).
 */
export const sweepIdleMeetings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - 30 * 60 * 1000;
    const live = await ctx.db
      .query("meetings")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .collect();
    for (const m of live) {
      // timed breakouts: auto-end when their deadline passes (host set a duration)
      if (m.breakoutsActive && m.breakoutEndsAt && m.breakoutEndsAt <= now) {
        const rooms = m.breakoutRooms ?? [];
        for (const room of rooms) {
          if (!room.childMeetingId) continue;
          const child = await ctx.db.get(room.childMeetingId);
          if (child && child.status !== "ended") {
            await ctx.db.patch(room.childMeetingId, { status: "ended", endTime: now });
            const parts = await ctx.db
              .query("meetingParticipants")
              .withIndex("by_meeting", (q) => q.eq("meetingId", room.childMeetingId as Id<"meetings">))
              .filter((q) => q.eq(q.field("leftAt"), undefined))
              .collect();
            for (const p of parts) await ctx.db.patch(p._id, { leftAt: now });
          }
        }
        await ctx.db.patch(m._id, {
          breakoutsActive: false,
          breakoutRooms: [],
          breakoutEndsAt: undefined,
          breakoutDurationMinutes: undefined,
        });
        continue;
      }
      if (m.kind === "breakout") continue;
      const lastActive = m.lastActiveAt ?? m.startTime;
      if (lastActive > cutoff) continue;
      const active = await ctx.db
        .query("meetingParticipants")
        .withIndex("by_meeting", (q) => q.eq("meetingId", m._id))
        .filter((q) => q.eq(q.field("leftAt"), undefined))
        .collect();
      if (active.length > 0) continue;
      await ctx.db.patch(m._id, { status: "ended", endTime: now });
    }
  },
});
