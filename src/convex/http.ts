import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { verifyJoiToken } from "./joi";
import { personFromGrant } from "./joiRead";
import { readFreshJoiToken } from "./lib/joiGrant";

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

// Dejoiy Mail keeps presence and written status in step with Shine (same people, same dot).
// Server to server, with the shared Dejoiy Mail secret.
const mailAllowed = (req: Request) => {
  const secret = process.env.DEJOIY_MAIL_SSO_SECRET;
  const header = req.headers.get("Authorization") ?? "";
  return Boolean(secret && header.startsWith("Bearer ") && sameSecret(header.slice(7), secret));
};
const CHOICES = ["auto", "away", "busy", "invisible"] as const;

http.route({
  path: "/dejoiy/presence",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!mailAllowed(req)) return json(403, { error: "Not allowed" });
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = String(b?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Invalid email" });
    const choice = CHOICES.find((c) => c === b?.choice);
    const out = await ctx.runMutation(internal.presence.fromMail, {
      email,
      idle: typeof b?.idle === "boolean" ? b.idle : undefined,
      choice,
      text: typeof b?.text === "string" ? b.text : undefined,
    });
    return out ? json(200, out) : json(404, { error: "No Shine account for this mailbox yet" });
  }),
});

http.route({
  path: "/dejoiy/people",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!mailAllowed(req)) return json(403, { error: "Not allowed" });
    const b = (await req.json().catch(() => null)) as { emails?: unknown } | null;
    const emails = Array.isArray(b?.emails) ? b.emails.map(String).slice(0, 200) : [];
    return json(200, { people: await ctx.runQuery(internal.presence.forMail, { emails }) });
  }),
});

// Dejoiy Mail's admin console manages Shine too: numbers, people, channels, live meetings, and two actions.
// The mail server has already checked the admin and passes their company domain as scope (none = Dejoiy's own admins).
http.route({
  path: "/dejoiy/admin",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!mailAllowed(req)) return json(403, { error: "Not allowed" });
    const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const scope = typeof b.scope === "string" && /^[a-z0-9.-]{3,253}$/.test(b.scope) ? b.scope : undefined;
    const by = String(b.actor ?? "");
    try {
      if (b.op === "summary") return json(200, await ctx.runQuery(internal.mailAdmin.summary, { scope }));
      if (b.op === "set_active") return json(200, await ctx.runMutation(internal.mailAdmin.setActive, { email: String(b.email ?? ""), active: b.active === true, by, scope }));
      if (b.op === "end_meeting") return json(200, await ctx.runMutation(internal.mailAdmin.endMeeting, { meetingId: String(b.meetingId ?? ""), by, scope }));
    } catch (e) {
      const data = (e as { data?: unknown })?.data;
      return json(400, { error: typeof data === "string" ? data : "Shine couldn't do that." });
    }
    return json(400, { error: "Unknown request" });
  }),
});

// Dejoiy Mail: supervisors at other companies this mailbox may write to (contacts, address suggestions).
http.route({
  path: "/dejoiy/supervisors",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!mailAllowed(req)) return json(403, { error: "Not allowed" });
    const b = (await req.json().catch(() => null)) as { email?: unknown } | null;
    const people = await ctx.runQuery(internal.reach.supervisorsForMail, { email: String(b?.email ?? "") });
    return people ? json(200, { people }) : json(404, { error: "No Shine account for this mailbox yet" });
  }),
});

// Dejoiy Mail: photos people uploaded in Shine, so the mail app shows them too (one photo in both apps).
http.route({
  path: "/dejoiy/photos",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!mailAllowed(req)) return json(403, { error: "Not allowed" });
    return json(200, { photos: await ctx.runQuery(internal.dejoiyMail.shinePhotos, {}) });
  }),
});

// Dejoiy Mail: someone changed their profile photo there, so Shine shows the same one.
http.route({
  path: "/dejoiy/photo",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!mailAllowed(req)) return json(403, { error: "Not allowed" });
    const b = (await req.json().catch(() => null)) as { email?: unknown; photo?: unknown } | null;
    const email = String(b?.email ?? "").trim().toLowerCase();
    const photo = String(b?.photo ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (photo && !photo.startsWith("https://"))) return json(400, { error: "Invalid request" });
    return json(200, { ok: await ctx.runMutation(internal.dejoiyMail.photoFromMail, { email, photo }) });
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

// Joi starts a direct chat with anyone on Shine, on any domain: { email, text }.
http.route({
  path: "/joi/dm",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const header = req.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ") || !(await verifyJoiToken(header.slice(7)))) return json(403, { error: "Not allowed" });
    const body = (await req.json().catch(() => null)) as { email?: unknown; text?: unknown } | null;
    const text = String(body?.text ?? "").trim().slice(0, 4000);
    if (!text) return json(400, { error: "Nothing to post" });
    await ctx.runMutation(internal.joi.ensureJoi, {});
    const id = await ctx.runMutation(internal.joi.dm, { email: String(body?.email ?? ""), body: text });
    return id ? json(200, { ok: true }) : json(404, { error: "No one on Shine with that email" });
  }),
});

// Joi reads the chats of the person talking to her (read-only; see joiRead.ts):
// Bearer = Joi's fresh signature (JOI_APP_SECRET, at most 2 minutes), body = { grant, conversationId? }.
http.route({
  path: "/joi/chats",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const header = req.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ") || !(await readFreshJoiToken(process.env.JOI_APP_SECRET, header.slice(7)))) return json(403, { error: "Not allowed" });
    const body = (await req.json().catch(() => null)) as { grant?: unknown; conversationId?: unknown } | null;
    const userId = await personFromGrant(ctx, body?.grant);
    if (!userId) return json(403, { error: "Ask the person to open Joi in Shine again." });
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.slice(0, 64) : undefined;
    return json(200, await ctx.runQuery(internal.joiRead.chats, { userId, conversationId }));
  }),
});

export default http;
