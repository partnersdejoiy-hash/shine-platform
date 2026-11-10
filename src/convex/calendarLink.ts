import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Shine and Dejoiy Mail share one calendar: the Zimbra one.
 * - A meeting scheduled in Shine becomes an event in the host's Dejoiy Mail
 *   calendar, with the Shine link as its location. Zimbra sends the invites
 *   (through the same mail route as everything else), and guests' replies show there.
 * - Cancelling it in Shine cancels the event and tells the guests.
 * - Shine's "upcoming" lists read that same calendar (myCalendar).
 * Dejoiy Mail does the calendar work on the user's behalf (/api/shine/calendar),
 * checked with the shared secret.
 */

async function mail(path: string, body: unknown) {
  const base = process.env.DEJOIY_MAIL_URL;
  const secret = process.env.DEJOIY_MAIL_SSO_SECRET;
  if (!base || !secret) return null; // not connected to Dejoiy Mail
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? `Dejoiy Mail calendar: HTTP ${res.status}`));
  return data;
}

export const meetingForCalendar = internalQuery({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const m = await ctx.db.get(meetingId);
    if (!m) return null;
    const host = await ctx.db.get(m.hostId);
    return { ...m, hostEmail: host?.email ?? "" };
  },
});

export const setInvId = internalMutation({
  args: { meetingId: v.id("meetings"), invId: v.string() },
  handler: async (ctx, { meetingId, invId }) => {
    await ctx.db.patch(meetingId, { calendarInvId: invId });
  },
});

/** Put a Shine meeting on the host's Dejoiy Mail calendar. True when Dejoiy Mail took it (and sent the invites). */
export const pushMeeting = internalAction({
  args: { meetingId: v.id("meetings"), requesterId: v.id("users") },
  handler: async (ctx, { meetingId, requesterId }): Promise<boolean> => {
    const m = await ctx.runQuery(internal.calendarLink.meetingForCalendar, { meetingId });
    if (!m || m.hostId !== requesterId || !m.hostEmail) return false;
    const link = `${process.env.SITE_URL ?? "https://app.shine.dejoiy.com"}/meet/${m.slug ?? "meeting"}/${m.roomCode}`;
    const out = await mail("/api/shine/calendar", {
      op: "save",
      owner: m.hostEmail,
      event: {
        invId: m.calendarInvId,
        title: m.title,
        start: m.startTime,
        end: m.endTime && m.endTime > m.startTime ? m.endTime : m.startTime + 3600_000,
        guests: (m.inviteEmails ?? []).join(", "),
        location: link,
        notes: [m.description, `Join on Shine: ${link}`, `Room ${m.roomCode}`, m.password ? `Password: ${m.password}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        reminder: 10,
        tz: "Asia/Kolkata",
      },
    });
    if (!out) return false;
    if (typeof out.invId === "string") await ctx.runMutation(internal.calendarLink.setInvId, { meetingId, invId: out.invId });
    return true;
  },
});

export const cancelMeeting = internalAction({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const m = await ctx.runQuery(internal.calendarLink.meetingForCalendar, { meetingId });
    if (!m?.calendarInvId || !m.hostEmail) return;
    await mail("/api/shine/calendar", {
      op: "delete",
      owner: m.hostEmail,
      event: { invId: m.calendarInvId, title: m.title, guests: m.inviteEmails ?? [] },
    });
  },
});

/** My Dejoiy Mail calendar (same events as mail.dejoiy.com): the next `days`, or the range start..end. */
export const myCalendar = action({
  args: { days: v.optional(v.number()), start: v.optional(v.number()), end: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ connected: boolean; events: CalendarEvent[] }> => {
    const me = await myEmail(ctx);
    if (!me) return { connected: false, events: [] };
    const start = args.start ?? Date.now() - 3600_000;
    const end = Math.min(args.end ?? start + Math.min(Math.max(args.days ?? 14, 1), 60) * 86_400_000, start + 100 * 86_400_000);
    try {
      const out = await mail("/api/shine/calendar", { op: "list", owner: me, start, end });
      if (!out) return { connected: false, events: [] };
      return { connected: true, events: (out.events as CalendarEvent[]) ?? [] };
    } catch {
      return { connected: false, events: [] }; // e.g. a Shine-only account with no mailbox
    }
  },
});

/** Add an event to my Dejoiy Mail calendar from Shine (Zimbra sends any invites). */
export const addEvent = action({
  args: {
    title: v.string(),
    start: v.number(),
    end: v.number(),
    allDay: v.optional(v.boolean()),
    guests: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    tz: v.optional(v.string()),
  },
  handler: async (ctx, event) => {
    const me = await myEmail(ctx);
    if (!me) throw new Error("Sign in first.");
    const out = await mail("/api/shine/calendar", { op: "save", owner: me, event: { reminder: 10, ...event } });
    if (!out) throw new Error("Shine isn't connected to Dejoiy Mail yet.");
    return { ok: true };
  },
});

/** Delete an event I organise on my Dejoiy Mail calendar (guests get a cancellation). */
export const removeEvent = action({
  args: { invId: v.string(), title: v.string() },
  handler: async (ctx, { invId, title }) => {
    const me = await myEmail(ctx);
    if (!me) throw new Error("Sign in first.");
    await mail("/api/shine/calendar", { op: "delete", owner: me, event: { invId, title } });
    return { ok: true };
  },
});

async function myEmail(ctx: ActionCtx): Promise<string | null> {
  const userId: Id<"users"> | null = await getAuthUserId(ctx);
  return userId ? await ctx.runQuery(internal.calendarLink.emailOf, { userId }) : null;
}

export interface CalendarEvent {
  id: string;
  invId: string;
  title: string;
  location: string;
  start: number;
  end: number;
  allDay: boolean;
  organizer?: boolean;
  repeats?: boolean;
  booked?: boolean;
}

export const emailOf = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.email ?? null,
});
