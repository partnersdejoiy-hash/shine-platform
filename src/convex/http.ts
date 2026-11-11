import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { verifyJoiToken } from "./joi";

const http = httpRouter();

auth.addHttpRoutes(http);

// Razorpay payment webhooks are handled by the self-hosted NestJS backend
// (server/src/billing) in production; the web app verifies payments inline
// via the signature-checked billing.verifyPayment action.

function sameSecret(given: string, secret: string) {
  if (given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Dejoiy Mail's calendar asks for a Shine room ("Add Shine meeting" on an event).
// Server to server, with the shared Dejoiy Mail secret.
http.route({
  path: "/dejoiy/meeting",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.DEJOIY_MAIL_SSO_SECRET;
    const header = req.headers.get("Authorization") ?? "";
    if (!secret || !header.startsWith("Bearer ") || !sameSecret(header.slice(7), secret)) return json(403, { error: "Not allowed" });
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const host = String(body?.host ?? "").trim().toLowerCase();
    const title = String(body?.title ?? "").trim().slice(0, 200) || "Meeting";
    const start = Number(body?.start), end = Number(body?.end);
    const guests = Array.isArray(body?.guests) ? body.guests.map(String).slice(0, 100) : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(host) || !Number.isFinite(start)) return json(400, { error: "Invalid request" });
    try {
      const res = await ctx.runMutation(internal.meetings.createFromMail, {
        hostEmail: host,
        title,
        startTime: start,
        endTime: Number.isFinite(end) && end > start ? end : start + 3600_000,
        inviteEmails: guests,
      });
      const site = process.env.SITE_URL ?? "https://app.shine.dejoiy.com";
      return json(200, { url: `${site}/meet/${res.slug}/${res.roomCode}`, roomCode: res.roomCode });
    } catch (e) {
      return json(400, { error: e instanceof Error ? e.message.replace(/^.*Uncaught Error:\s*/s, "").split("\n")[0] : "Could not create the meeting" });
    }
  }),
});

// Joi posts in her own #joi channel by herself (mail that came in, news).
// Signed by the Joi server with the Shine app secret (JOI_APP_SECRET here).
http.route({
  path: "/joi/post",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const header = req.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ") || !(await verifyJoiToken(header.slice(7)))) return json(403, { error: "Not allowed" });
    const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
    const text = String(body?.text ?? "").trim().slice(0, 4000);
    if (!text) return json(400, { error: "Nothing to post" });
    const ids = await ctx.runMutation(internal.joi.ensureJoi, {});
    if (!ids) return json(409, { error: "Shine has no organization yet" });
    await ctx.runMutation(internal.joi.post, { conversationId: ids.channelId, body: text });
    return json(200, { ok: true });
  }),
});

export default http;
