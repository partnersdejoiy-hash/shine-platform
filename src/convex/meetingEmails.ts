"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { detailRows, esc, shineEmail } from "./lib/emailLayout";
import { sendResendBatch, SHINE_EMAIL_FROM } from "./emailProvider";


function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ts).toString();
  }
}

interface InviteResult {
  sent: number;
  error: string | null;
  reason: string | null;
}

/**
 * Email every invited attendee the moment a meeting is scheduled.
 * Includes the host, attendee names, room code, time and a join link.
 * Safe to fire-and-forget: returns a summary and never throws.
 */
export const sendInviteEmails = action({
  args: {
    meetingId: v.id("meetings"),
    title: v.string(),
    slug: v.optional(v.string()),
    roomCode: v.string(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    password: v.optional(v.string()),
    hostName: v.string(),
    invitees: v.array(
      v.object({
        email: v.string(),
        name: v.optional(v.string()),
      }),
    ),
    siteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<InviteResult> => {
    // Connected to Dejoiy Mail: the meeting goes on the host's mail calendar and
    // the invites go out from there. Falls back to the email service below if that fails.
    // Only the signed-in host of this meeting may send its invites, so nobody can use Shine's address to mail strangers.
    const userId = await getAuthUserId(ctx);
    if (!userId) return { sent: 0, error: "Sign in to send invites.", reason: null };
    if ((await ctx.runQuery(internal.meetings.hostIdOf, { meetingId: args.meetingId })) !== userId) {
      return { sent: 0, error: "Only the meeting's host can send its invites.", reason: null };
    }
    if (args.invitees.length > 200) return { sent: 0, error: "Too many invitees in one go.", reason: null };
    if (process.env.DEJOIY_MAIL_URL) {
      try {
        if (await ctx.runAction(internal.calendarLink.pushMeeting, { meetingId: args.meetingId, requesterId: userId })) {
          return { sent: args.invitees.length, error: null, reason: "Added to your Dejoiy Mail calendar" };
        }
      } catch (e) {
        console.warn("Dejoiy Mail calendar:", e instanceof Error ? e.message : e);
      }
    }
    try {
      const emails = [...new Set(args.invitees.map((i) => i.email.trim().toLowerCase()))].filter(
        (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
      );
      if (emails.length === 0) return { sent: 0, error: null, reason: "no invitees" };

      const hostName = args.hostName || "Meeting host";
      const attendeeNames = args.invitees
        .map((i) => i.name || i.email.split("@")[0] || i.email)
        .filter(Boolean);
      // Production invites always point at the standalone meet.dejoiy.com site.
      // In dev/preview the client passes its own origin.
      // Join links only ever point at Dejoiy's own sites (or a local dev server), never an address the caller chose.
      const own = /^https:\/\/([a-z0-9-]+\.)*dejoiy\.com\/?$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;
      const base = (args.siteUrl && own.test(args.siteUrl) ? args.siteUrl : "https://meet.dejoiy.com").replace(/\/$/, "");
      const joinUrl = `${base}/meet/${args.slug || "meeting"}/${args.roomCode}`;
      const when = formatWhen(args.startTime);
      const duration =
        args.endTime && args.endTime > args.startTime
          ? ` · ${Math.max(1, Math.round((args.endTime - args.startTime) / 60000))} min`
          : "";

      const subject = `📅 You're invited: ${args.title}`;
      const rows: [string, string][] = [
        ["When", `${when}${duration}`],
        ["Host", hostName],
        ["Room code", args.roomCode],
      ];
      if (args.password) rows.push(["Password", args.password]);
      if (attendeeNames.length) rows.push(["Invited", attendeeNames.join(", ")]);
      const html = shineEmail({
        preheader: `${hostName} invited you to ${args.title}, ${when}.`,
        tag: "Meeting invite",
        title: "You're invited to",
        highlight: args.title,
        body: `<p style="margin:0 0 12px">${esc(hostName)} wants you in this meeting on Shine. It opens in your browser, nothing to install.</p>${detailRows(rows)}`,
        cta: { label: "Join the meeting", url: joinUrl },
        note: `No Shine account? Open the link and join with your name, email and phone number.<br>Or join on meet.dejoiy.com with room code <b>${esc(args.roomCode)}</b>.`,
      });

      const text = [
        `You're invited: ${args.title}`,
        "",
        `Room code: ${args.roomCode}`,
        `When: ${when}${duration}`,
        `Host: ${hostName}`,
        args.password ? `Password: ${args.password}` : "",
        "",
        "Attendees:",
        ...attendeeNames.map((n) => `  • ${n}`),
        "",
        `Join: ${joinUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await sendResendBatch(
        emails.map((to) => ({
          from: SHINE_EMAIL_FROM.meetings,
          to,
          subject,
          html,
          text,
        })),
      );
      return {
        sent: res.success ? emails.length : 0,
        error: res.error ?? null,
        reason: null,
      };
    } catch (e) {
      return {
        sent: 0,
        error: e instanceof Error ? e.message : String(e),
        reason: "exception",
      };
    }
  },
});
