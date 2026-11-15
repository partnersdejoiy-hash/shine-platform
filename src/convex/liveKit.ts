import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { liveKitToken } from "./lib/liveKitToken";

/**
 * Calls and meetings through a LiveKit media server (open source, self-hosted next to Shine):
 * everyone sends their camera once to the server, which forwards it to the others at the quality
 * each network can take. Without LIVEKIT_* settings Shine falls back to direct (mesh) WebRTC.
 *
 *   LIVEKIT_URL         wss://app.shine.dejoiy.com/livekit
 *   LIVEKIT_API_KEY     LIVEKIT_API_SECRET   (made by deploy/contabo/setup-calls.sh)
 */
const settings = () => {
  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  return url && key && secret ? { url, key, secret } : null;
};

/** Whether calls go through the media server; the page needs nothing more to decide. */
export const enabled = query({
  args: {},
  handler: async () => settings() !== null,
});

/** Who may be in the room: the two people of an active or ringing call; admitted people of a running meeting. */
export const access = internalQuery({
  args: { userId: v.id("users"), kind: v.union(v.literal("call"), v.literal("meeting")), id: v.string() },
  handler: async (ctx, { userId, kind, id }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const name = user.name ?? user.email ?? "Someone";
    if (kind === "call") {
      const callId = ctx.db.normalizeId("calls", id);
      const call = callId ? await ctx.db.get(callId) : null;
      if (!call || (call.status !== "active" && call.status !== "ringing")) return null;
      if (call.initiatorId !== userId && call.recipientId !== userId) return null;
      return { room: `call:${call._id}`, name, canPublish: true };
    }
    const meetingId = ctx.db.normalizeId("meetings", id);
    const meeting = meetingId ? await ctx.db.get(meetingId) : null;
    if (!meeting || meeting.status === "ended" || meeting.status === "cancelled") return null;
    const me = (
      await ctx.db
        .query("meetingParticipants")
        .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
        .collect()
    ).find((p) => p.userId === userId && !p.leftAt);
    // waiting in the lobby or turned away: not in the room yet
    if (!me || me.status === "waiting" || me.status === "denied") return null;
    // a webinar's audience watches and listens; only the host is on camera
    const canPublish = meeting.kind !== "webinar" || meeting.hostId === userId;
    return { room: `meeting:${meeting._id}`, name, canPublish };
  },
});

/** A pass into one call or meeting room, for the signed-in person only. */
export const token = action({
  args: { kind: v.union(v.literal("call"), v.literal("meeting")), id: v.string() },
  handler: async (ctx, { kind, id }): Promise<{ url: string; token: string } | null> => {
    const config = settings();
    const userId = await getAuthUserId(ctx);
    if (!config || !userId) return null;
    const room = await ctx.runQuery(internal.liveKit.access, { userId, kind, id });
    if (!room) return null;
    return { url: config.url, token: await liveKitToken(config.key, config.secret, { ...room, identity: userId }) };
  },
});
