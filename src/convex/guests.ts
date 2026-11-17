import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { normalizeRoomCode } from "./meetings";

/**
 * Meeting guests: someone opens a Shine meeting link, types a name, an email and a phone number, and joins.
 * No account and no password: this makes a guest pass (an anonymous user) for that one
 * meeting. Signed in as a guest, getCurrentUser treats them as signed out everywhere except
 * the meeting room, and meetings.join only lets them into this meeting.
 */
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[a-z]{2,}$/i;
const MAX_GUESTS_PER_MEETING = 500;

export const createGuest = internalMutation({
  args: { meeting: v.string(), name: v.string(), email: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    const name = [...args.name].filter((c) => c >= " " && c !== "\u007f").join("").trim().slice(0, 60);
    const email = args.email.trim().toLowerCase();
    if (!name) throw new ConvexError("Type your name.");
    if (!EMAIL.test(email) || email.length > 254) throw new ConvexError("Type a valid email address.");
    const phone = args.phone.replace(/[\s().-]/g, "");
    if (!/^\+?\d{7,15}$/.test(phone)) throw new ConvexError("Type a valid phone number.");

    // the link carries either the meeting's id or its room code
    const id = ctx.db.normalizeId("meetings", args.meeting);
    const meeting = id
      ? await ctx.db.get(id)
      : await ctx.db.query("meetings").withIndex("by_roomCode", (q) => q.eq("roomCode", normalizeRoomCode(args.meeting))).first();
    if (!meeting || meeting.status === "ended" || meeting.status === "cancelled") {
      throw new ConvexError("This meeting has ended or the link is wrong.");
    }
    if (meeting.locked) throw new ConvexError("This meeting is locked by the host.");
    if (meeting.openToEveryone === false && !(meeting.inviteEmails ?? []).some((e) => e.toLowerCase() === email)) {
      throw new ConvexError("This meeting is private. Use the email address the host invited.");
    }
    const guests = await ctx.db.query("users").withIndex("by_guest_meeting", (q) => q.eq("guestMeetingId", meeting._id)).take(MAX_GUESTS_PER_MEETING);
    if (guests.length >= MAX_GUESTS_PER_MEETING) throw new ConvexError("This meeting has too many guests already.");

    return await ctx.db.insert("users", {
      name: `${name} (Guest)`,
      isAnonymous: true,
      guestEmail: email,
      guestPhone: phone,
      guestMeetingId: meeting._id,
      isActive: true,
    });
  },
});
