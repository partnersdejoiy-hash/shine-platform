import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { getCurrentUser, isSuperAdmin } from "./users";
import { roleHasPermission } from "./permissions";

/** Start a 1:1 call in a direct conversation. */
export const start = mutation({
  args: { conversationId: v.id("conversations"), kind: v.union(v.literal("audio"), v.literal("video")) },
  handler: async (ctx, { conversationId, kind }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    if (!isSuperAdmin(me) && !(await roleHasPermission(ctx, me.role, "one_to_one_call", me.approvedPermissions))) {
      throw new ConvexError("Your role does not include 1:1 calls — request it from Settings → Security");
    }
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.kind !== "chat" || conversation.chatType !== "direct") {
      throw new ConvexError("Calls are available in direct conversations");
    }
    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const recipient = members.find((m) => m.userId !== me._id);
    if (!recipient) throw new ConvexError("No recipient for this call");

    const now = Date.now();
    const callId = await ctx.db.insert("calls", {
      kind,
      conversationId,
      initiatorId: me._id,
      recipientId: recipient.userId,
      status: "ringing",
      startedAt: now,
    });

    const target = await ctx.db.get(recipient.userId);
    await ctx.db.insert("notifications", {
      userId: recipient.userId,
      kind: "call",
      title: `${me.name ?? "Someone"} is calling you`,
      body: kind === "video" ? "📹 Video call" : "📞 Audio call",
      conversationId,
      link: `/app/chats/${conversationId}`,
      read: false,
      createdAt: now,
    });
    void target;
    return callId;
  },
});

/** The recipient accepts the call. */
export const accept = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const call = await ctx.db.get(callId);
    if (!call) throw new ConvexError("Call not found");
    if (call.recipientId !== me._id && call.initiatorId !== me._id) throw new ConvexError("Not your call");
    await ctx.db.patch(callId, { status: "active" });
  },
});

export const decline = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const call = await ctx.db.get(callId);
    if (!call) throw new ConvexError("Call not found");
    if (call.recipientId !== me._id) throw new ConvexError("Not your call");
    await ctx.db.patch(callId, { status: "declined", endedAt: Date.now() });
  },
});

export const end = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const call = await ctx.db.get(callId);
    if (!call) return;
    const now = Date.now();
    const status =
      call.status === "ringing"
        ? call.initiatorId === me._id
          ? "missed"
          : "declined"
        : "ended";
    await ctx.db.patch(callId, { status, endedAt: now });
  },
});

export const setRecording = mutation({
  args: { callId: v.id("calls"), isRecording: v.boolean() },
  handler: async (ctx, { callId, isRecording }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const call = await ctx.db.get(callId);
    if (!call) return;
    await ctx.db.patch(callId, { isRecording });
  },
});

/** Live calls involving the current user (incoming ringing + active). */
export const liveCalls = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return { incoming: [], active: [] };
    const now = Date.now();

    const asRecipient = await ctx.db
      .query("calls")
      .withIndex("by_recipient", (q) => q.eq("recipientId", me._id))
      .filter((q) => q.eq(q.field("status"), "ringing"))
      .order("desc")
      .take(5);
    const incoming = [];
    for (const call of asRecipient) {
      if (now - call.startedAt > 60_000) continue; // auto-miss after 60s
      const caller = await ctx.db.get(call.initiatorId);
      const conversation = await ctx.db.get(call.conversationId);
      incoming.push({ ...call, caller, conversation });
    }

    const asInitiator = await ctx.db
      .query("calls")
      .withIndex("by_initiator", (q) => q.eq("initiatorId", me._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .take(5);
    const asRecipientActive = await ctx.db
      .query("calls")
      .withIndex("by_recipient", (q) => q.eq("recipientId", me._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .take(5);
    const activeIds = new Set<string>([
      ...asInitiator.map((c) => c._id),
      ...asRecipientActive.map((c) => c._id),
    ]);
    const active = [];
    for (const id of activeIds) {
      const call = await ctx.db.get(id as Id<"calls">);
      if (!call) continue;
      const other = await ctx.db.get(
        call.initiatorId === me._id ? call.recipientId : call.initiatorId,
      );
      active.push({ ...call, other, me });
    }

    return { incoming, active };
  },
});

/** Call history for the dashboard. */
export const history = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const asInit = await ctx.db
      .query("calls")
      .withIndex("by_initiator", (q) => q.eq("initiatorId", me._id))
      .order("desc")
      .take(30);
    const asRecip = await ctx.db
      .query("calls")
      .withIndex("by_recipient", (q) => q.eq("recipientId", me._id))
      .order("desc")
      .take(30);
    const ids = new Map<string, any>();
    for (const c of [...asInit, ...asRecip]) ids.set(c._id, c);
    const rows = [];
    for (const [, call] of ids) {
      if (call.status === "ringing") continue;
      const other = await ctx.db.get(
        call.initiatorId === me._id ? call.recipientId : call.initiatorId,
      );
      rows.push({ ...call, other, direction: call.initiatorId === me._id ? "outgoing" : "incoming" });
    }
    return rows.sort((a, b) => b.startedAt - a.startedAt).slice(0, 30);
  },
});

/** Send a WebRTC signaling payload (offer / answer / ICE candidate). */
export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    toId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, { callId, toId, kind, payload }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    await ctx.db.insert("callSignals", {
      callId,
      fromId: me._id,
      toId,
      kind,
      payload,
      createdAt: Date.now(),
    });
    // keep the signaling table tidy
    const stale = await ctx.db
      .query("callSignals")
      .filter((q) => q.lt(q.field("createdAt"), Date.now() - 1000 * 60 * 10))
      .take(50);
    for (const s of stale) await ctx.db.delete(s._id);
  },
});

/** Poll signaling messages addressed to the current user for a call. */
export const signalsFor = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("callSignals")
      .withIndex("by_call_to", (q) => q.eq("callId", callId).eq("toId", me._id))
      .collect();
    return rows;
  },
});

// ---- Meeting room signaling (mesh WebRTC) ----------------------------------

export const sendMeetingSignal = mutation({
  args: {
    meetingId: v.id("meetings"),
    toId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, { meetingId, toId, kind, payload }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    await ctx.db.insert("meetingSignals", {
      meetingId,
      fromId: me._id,
      toId,
      kind,
      payload,
      createdAt: Date.now(),
    });
    // keep the signaling table tidy: drop stale signals older than 15 minutes
    const stale = await ctx.db
      .query("meetingSignals")
      .withIndex("by_meeting_to", (q) => q.eq("meetingId", meetingId))
      .filter((q) => q.lt(q.field("createdAt"), Date.now() - 1000 * 60 * 15))
      .take(100);
    for (const s of stale) await ctx.db.delete(s._id);
  },
});

export const meetingSignalsFor = query({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("meetingSignals")
      .withIndex("by_meeting_to", (q) => q.eq("meetingId", meetingId).eq("toId", me._id))
      .collect();
    return rows;
  },
});
