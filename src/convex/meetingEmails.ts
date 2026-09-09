"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { sendResendBatch, SHINE_EMAIL_FROM } from "./emailProvider";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
      const base = (args.siteUrl || "https://meet.dejoiy.com").replace(/\/$/, "");
      const joinUrl = `${base}/meet/${args.slug || "meeting"}/${args.roomCode}`;
      const when = formatWhen(args.startTime);
      const duration =
        args.endTime && args.endTime > args.startTime
          ? ` · ${Math.max(1, Math.round((args.endTime - args.startTime) / 60000))} min`
          : "";

      const attendeeHtml = attendeeNames
        .map((n) => `<li style="margin:6px 0;font-size:15px;color:#E8E8E8;">${esc(n)}</li>`)
        .join("");

      const subject = `📅 You're invited: ${args.title}`;
      const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0B0B0B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0B;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid rgba(212,175,55,0.35);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-size:22px;font-weight:700;color:#D4AF37;letter-spacing:0.5px;">SHINE</div>
              <div style="font-size:11px;color:#8A8F98;margin-top:2px;">Powered by DEJOIY</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <div style="font-size:24px;font-weight:600;color:#FFFFFF;line-height:1.3;">${esc(args.title)}</div>
              <div style="margin-top:10px;font-size:15px;color:#D4AF37;">You've been invited to join this meeting</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0F;border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#8A8F98;padding-bottom:6px;">ROOM CODE</td>
                        <td align="right" style="font-size:12px;color:#8A8F98;padding-bottom:6px;">${when}${esc(duration)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="font-family:Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:2px;color:#D4AF37;">${esc(args.roomCode)}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:14px;font-size:14px;color:#E8E8E8;">
                          Hosted by <span style="color:#FFFFFF;font-weight:600;">${esc(hostName)}</span>
                          ${args.password ? `<br/><span style="color:#8A8F98;font-size:12px;">🔒 Password: ${esc(args.password)}</span>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <div style="font-size:12px;color:#8A8F98;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Attendees</div>
              <ul style="margin:0;padding-left:18px;">${attendeeHtml}</ul>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px;">
              <a href="${joinUrl}" style="display:inline-block;background:#D4AF37;color:#0B0B0B;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;">Join the meeting →</a>
              <div style="margin-top:14px;font-size:12px;color:#8A8F98;">Or open SHINE and join with room code <span style="color:#D4AF37;font-weight:600;">${esc(args.roomCode)}</span></div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px;background:#0F0F0F;border-top:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;color:#8A8F98;">Sent by SHINE · Powered by DEJOIY. You received this because you were invited to this meeting.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
