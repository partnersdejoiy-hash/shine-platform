"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { sendResend, SHINE_EMAIL_FROM } from "./emailProvider";

/**
 * Email delivery actions.
 *
 * Convex rule: mutations and queries CANNOT make outbound network requests —
 * only actions can. Every mutation that needs to send email must route through
 * one of these actions via `ctx.runAction(api.emailActions.*, …)`.
 *
 * Actions return { ok, id?, error? } and never throw (see emailProvider).
 */

/** Generic single email (used by imports, notifications, etc.). */
export const sendMail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    from: v.optional(v.string()),
  },
  handler: async (_, args) =>
    sendResend({
      to: args.to,
      from: args.from ?? SHINE_EMAIL_FROM.notifications,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
});

/** Branded temporary-password email (temp password flows). */
export const sendTempPassword = action({
  args: {
    to: v.string(),
    name: v.optional(v.string()),
    tempPassword: v.string(),
  },
  handler: async (_, { to, name, tempPassword }) =>
    sendResend({
      to,
      from: SHINE_EMAIL_FROM.auth,
      subject: `Your temporary SHINE password (${name ?? ""})`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#D4AF37">SHINE · by DEJOIY</h2>
          <p>Hi ${name ?? "there"},</p>
          <p>Your temporary SHINE sign-in password is:</p>
          <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#f5f5f0;padding:12px;border-radius:8px;text-align:center">${tempPassword}</p>
          <p>Sign in with your email and this password. For security you will be <b>required to set a new password</b> before you can use the app — the last 5 passwords can never be reused.</p>
          <p style="color:#888">If you did not expect this, contact your administrator.</p>
        </div>`,
      text: `Hi ${name ?? "there"}, your temporary SHINE password is: ${tempPassword}. You must change it on first login.`,
    }),
});

/** Branded ticket notification email (ticketing@dejoiy.com). */
export const sendTicketEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (_, { to, subject, html, text }) =>
    sendResend({
      to,
      from: SHINE_EMAIL_FROM.ticketing,
      subject,
      html,
      text,
    }),
});

/** Branded 6-digit verification-code email (auth fallback flows). */
export const sendVerificationCode = action({
  args: {
    to: v.string(),
    name: v.optional(v.string()),
    code: v.string(),
  },
  handler: async (_, { to, name, code }) =>
    sendResend({
      to,
      from: SHINE_EMAIL_FROM.auth,
      subject: "Your SHINE verification code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#D4AF37">SHINE · by DEJOIY</h2>
          <p>Hi ${name ?? "there"},</p>
          <p>Use the verification code below to set your new SHINE password. It expires in 10 minutes.</p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f5f5f0;padding:14px;border-radius:8px;text-align:center">${code}</p>
          <p style="color:#888">If you did not request this, you can safely ignore this email.</p>
        </div>`,
      text: `Your SHINE verification code is: ${code}. It expires in 10 minutes.`,
    }),
});
