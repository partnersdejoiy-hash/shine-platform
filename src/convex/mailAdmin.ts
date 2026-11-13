import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { seenAs } from "./presence";
import { SUPER_ADMIN_EMAIL, logAudit } from "./users";
import { notifyMembers } from "./messages";

/**
 * Shine as seen from Dejoiy Mail's admin console (one admin for mail and chat). Dejoiy Mail's server calls
 * these with the shared secret (http.ts /dejoiy/admin). `scope` is a company's mail domain: a company admin
 * sees and changes only people with that domain; Dejoiy's own admins pass no scope and see everyone.
 */
const inScope = (email: string | undefined | null, scope?: string) => !scope || (email ?? "").toLowerCase().endsWith("@" + scope.toLowerCase());

export const summary = internalQuery({
  args: { scope: v.optional(v.string()) },
  handler: async (ctx, { scope }) => {
    const users = (await ctx.db.query("users").collect()).filter((u) => u.email && inScope(u.email, scope));
    const mine = new Map(users.map((u) => [u._id, u]));
    const presence = new Map((await ctx.db.query("presence").collect()).map((p) => [p.userId, p]));
    const people = users.slice(0, 500).map((u) => ({
      email: u.email!, name: u.name ?? u.email!, role: u.role ?? "user", active: u.isActive !== false && !u.chatOff,
      status: seenAs(presence.get(u._id) ?? null), lastSeen: u.lastSeen ?? null, fromMail: u.source === "dejoiy-mail",
    }));

    const channels = [];
    for (const c of await ctx.db.query("conversations").withIndex("by_kind", (q) => q.eq("kind", "channel")).collect()) {
      if (c.isMeeting || !mine.has(c.createdBy)) continue;
      const members = await ctx.db.query("conversationMembers").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).collect();
      channels.push({ name: c.name, private: c.isPrivate === true, members: members.length, lastMessageAt: c.lastMessageAt ?? null, createdBy: mine.get(c.createdBy)?.email ?? "" });
    }

    const meetings = [];
    for (const m of await ctx.db.query("meetings").withIndex("by_status", (q) => q.eq("status", "live")).collect()) {
      if (!mine.has(m.hostId)) continue;
      const here = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", m._id)).filter((q) => q.eq(q.field("leftAt"), undefined)).collect();
      meetings.push({ id: m._id, title: m.title, host: mine.get(m.hostId)?.email ?? "", startedAt: m.startTime ?? null, people: here.length });
    }

    // messages in the last 7 days, from the newest 3000 (enough for a company; says so when it hits the cap)
    const week = Date.now() - 7 * 86_400_000;
    const recent = await ctx.db.query("messages").order("desc").take(3000);
    const messages = recent.filter((m) => m.createdAt >= week && mine.has(m.senderId)).length;
    const capped = recent.length === 3000 && recent[recent.length - 1].createdAt >= week;

    const audit = (await ctx.db.query("auditLogs").order("desc").take(400))
      .filter((a) => mine.has(a.actorId))
      .slice(0, 60)
      .map((a) => ({ at: a.createdAt, actor: mine.get(a.actorId)?.email ?? "", action: a.action, details: a.details ?? "" }));

    return {
      totals: { people: users.length, activeNow: people.filter((p) => p.status !== "offline").length, switchedOff: people.filter((p) => !p.active).length, channels: channels.length, liveMeetings: meetings.length, messages, messagesCapped: capped },
      people, channels: channels.slice(0, 200), meetings, audit,
    };
  },
});

async function userByEmail(ctx: { db: any }, email: string): Promise<Doc<"users"> | null> {
  return await ctx.db.query("users").withIndex("email", (q: any) => q.eq("email", email.trim().toLowerCase())).first();
}

/** Switch someone's chat and meetings off or on. They keep their mailbox. */
export const setActive = internalMutation({
  args: { email: v.string(), active: v.boolean(), by: v.string(), scope: v.optional(v.string()) },
  handler: async (ctx, { email, active, by, scope }) => {
    const user = await userByEmail(ctx, email);
    if (!user || !inScope(user.email, scope)) throw new ConvexError("That person isn't in your company's Shine.");
    if ((user.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) throw new ConvexError("The super admin account can't be switched off.");
    if ((user.email ?? "").toLowerCase() === by.trim().toLowerCase() && !active) throw new ConvexError("You can't switch off your own account.");
    // its own switch, so the mailbox sync (which sets isActive from the mailbox) never turns chat back on
    await ctx.db.patch(user._id, { chatOff: active ? undefined : true });
    if (!active) {
      // sign them out on every device: no session can be renewed (a page already open stops working within the hour, sending stops at once)
      for (const session of await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", user._id)).collect()) {
        for (const t of await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", session._id)).collect()) await ctx.db.delete(t._id);
        await ctx.db.delete(session._id);
      }
    }
    const actor = await userByEmail(ctx, by);
    await logAudit(ctx, (actor ?? user)._id, active ? "user.activated" : "user.deactivated", "users", String(user._id), `by ${by} from Dejoiy Mail admin`);
    return { email: user.email, active };
  },
});

/** End a live meeting from the admin console (a room left open, or one that must stop). */
export const endMeeting = internalMutation({
  args: { meetingId: v.string(), by: v.string(), scope: v.optional(v.string()) },
  handler: async (ctx, { meetingId, by, scope }) => {
    const id = ctx.db.normalizeId("meetings", meetingId);
    const meeting = id ? await ctx.db.get(id) : null;
    const host = meeting ? await ctx.db.get(meeting.hostId) : null;
    if (!meeting || !host || !inScope(host.email, scope)) throw new ConvexError("That meeting isn't one of your company's.");
    if (meeting.status === "ended") return { ended: true };
    const now = Date.now();
    await ctx.db.patch(meeting._id, { status: "ended", endTime: now });
    const here = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id as Id<"meetings">)).filter((q) => q.eq(q.field("leftAt"), undefined)).collect();
    for (const p of here) await ctx.db.patch(p._id, { leftAt: now });
    for (const room of meeting.breakoutRooms ?? []) {
      if (!room.childMeetingId) continue;
      const child = await ctx.db.get(room.childMeetingId);
      if (child && child.status !== "ended") await ctx.db.patch(room.childMeetingId, { status: "ended", endTime: now });
    }
    const actor = await userByEmail(ctx, by);
    await logAudit(ctx, (actor ?? host)._id, "meeting.ended", "meetings", String(meeting._id), `by ${by} from Dejoiy Mail admin`);
    return { ended: true };
  },
});

/**
 * A company's own automation posts in one of its channels (Dejoiy Mail's API, "shine.post").
 * It posts as the admin who made the API token, and only where that person may post themselves:
 * a channel of their company that they are a member of, and not one limited to admins unless they are one.
 */
export const post = internalMutation({
  args: { channel: v.string(), text: v.string(), by: v.string(), scope: v.optional(v.string()), via: v.optional(v.string()) },
  handler: async (ctx, { channel, text, by, scope, via }) => {
    const body = text.trim().slice(0, 4000);
    if (!body) throw new ConvexError("The message is empty.");
    const me = await userByEmail(ctx, by);
    if (!me || !inScope(me.email, scope) || me.isActive === false || me.chatOff)
      throw new ConvexError("The person who made this API token has no active Shine account in your company.");
    const wanted = channel.trim().replace(/^#/, "").toLowerCase();
    const found = [];
    for (const c of await ctx.db.query("conversations").withIndex("by_kind", (q) => q.eq("kind", "channel")).collect()) {
      if (c.isMeeting || c.name.trim().toLowerCase() !== wanted) continue;
      const owner = await ctx.db.get(c.createdBy);
      if (owner && inScope(owner.email, scope)) found.push(c);
    }
    if (found.length === 0) throw new ConvexError("No Shine channel of your company has that name.");
    if (found.length > 1) throw new ConvexError("More than one channel of your company has that name; rename one.");
    const conversation = found[0];
    const membership = await ctx.db.query("conversationMembers").withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversation._id)).unique();
    if (!membership) throw new ConvexError(`${me.email} (who made this API token) is not a member of #${conversation.name}.`);
    const admin = membership.role === "owner" || membership.role === "admin";
    if (!admin && (conversation.policies?.whoCanSend === "admins" || conversation.channelKind === "announcement" || conversation.channelKind === "broadcast"))
      throw new ConvexError(`Only admins of #${conversation.name} may post there.`);
    const now = Date.now();
    const id = await ctx.db.insert("messages", { conversationId: conversation._id, senderId: me._id, kind: "text", body, createdAt: now });
    await ctx.db.patch(conversation._id, { lastMessageAt: now });
    await notifyMembers(ctx, conversation, me._id, `#${conversation.name}`, body.slice(0, 140), `/app/chats/${conversation._id}`, "message", []);
    await logAudit(ctx, me._id, "message.api", "conversations", String(conversation._id), via === "automation" ? `by ${by}'s Dejoiy Mail automation` : `by ${by} through a Dejoiy Mail API token`);
    return { ok: true, channel: conversation.name, messageId: id };
  },
});
