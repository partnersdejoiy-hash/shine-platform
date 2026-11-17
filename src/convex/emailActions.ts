"use node";

import { internalAction } from "./_generated/server";
import { esc, shineEmail } from "./lib/emailLayout";
import { v } from "convex/values";
import { sendResend, SHINE_EMAIL_FROM } from "./emailProvider";

/**
 * Email delivery actions.
 *
 * Convex rule: mutations and queries CANNOT make outbound network requests —
 * only actions can. Every mutation that needs to send email must route through
 * one of these actions via `ctx.scheduler.runAfter(0, internal.emailActions.*, …)`.
 * They are internal: the browser cannot call them, so nobody can send mail from Shine's domain.
 *
 * Actions return { ok, id?, error? } and never throw (see emailProvider).
 */

/** Generic single email (used by imports, notifications, etc.). */
export const sendMail = internalAction({
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
export const sendTempPassword = internalAction({
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
      html: shineEmail({
        preheader: "Your temporary Shine password is inside. You set a new one when you sign in.",
        tag: "Sign-in",
        title: "Your temporary",
        highlight: "password",
        body: `<p style="margin:0">Hi ${esc(name ?? "there")}, sign in to Shine with your email and this password. Shine then asks you to set a new password of your own; your last 5 passwords can't be used again.</p>`,
        code: tempPassword,
        note: "Didn't expect this? Tell your administrator.",
      }),
      text: `Hi ${name ?? "there"}, your temporary SHINE password is: ${tempPassword}. You must change it on first login.`,
    }),
});

/** Branded ticket notification email (ticketing@dejoiy.com). */
export const sendTicketEmail = internalAction({
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
export const sendVerificationCode = internalAction({
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
      html: shineEmail({
        preheader: "Your Shine code. It works for 10 minutes.",
        tag: "Verification code",
        title: "Here's your",
        highlight: "code",
        body: `<p style="margin:0">Hi ${esc(name ?? "there")}, use this code to set your new Shine password. It works for 10 minutes.</p>`,
        code,
        note: "Didn't ask for this? You can ignore this mail; your password stays the same.",
      }),
      text: `Your SHINE verification code is: ${code}. It expires in 10 minutes.`,
    }),
});
