import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { notifyMembers } from "./messages";

/**
 * Joi, DEJOIY's AI buddy, as a Shine member with her own channel (#joi).
 * She answers everything in #joi, in DMs with her, and wherever someone @mentions her.
 * Her brain lives on the Joi server: JOI_API_URL (e.g. https://joi-api.example.com),
 * and every request is signed with JOI_APP_SECRET (the Shine app's secret on Joi's admin page).
 * Joi can also post here by herself through POST /joi/post (see http.ts).
 */

export const joiEmail = () => (process.env.JOI_EMAIL ?? "joi-ai@mail.dejoiy.com").trim().toLowerCase();
// her animated profile picture (Joi bobbing, waving and winking on DEJOIY pink)
// Joi's photo is her look from her letters: the pink round window with the black ring (public/joi-profile.png).
// Served by Shine itself; bump ?v= when the picture changes so browsers fetch the new one.
const JOI_PHOTO = `${(process.env.SITE_URL ?? "https://app.shine.dejoiy.com").replace(/\/+$/, "")}/joi-profile.webp?v=10`;
export const JOI_STATUS = "Joi is an AI. It can make mistakes.";
const CHANNEL = "joi";

async function findJoi(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  return await ctx.db.query("users").withIndex("email", (q) => q.eq("email", joiEmail())).first();
}

async function findChannel(ctx: QueryCtx | MutationCtx, joiId: Id<"users">) {
  const channels = await ctx.db.query("conversations").withIndex("by_kind", (q) => q.eq("kind", "channel")).collect();
  return channels.find((c) => c.createdBy === joiId && c.name === CHANNEL) ?? null;
}

/** Makes sure Joi exists, belongs to the company, and has #joi with everyone in it. Safe to run again and again. */
export const ensureJoi = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ joiId: Id<"users">; channelId: Id<"conversations"> } | null> => {
    const now = Date.now();
    let joi = await findJoi(ctx);
    if (!joi) {
      const id = await ctx.db.insert("users", {
        name: "Joi",
        email: joiEmail(),
        image: JOI_PHOTO,
        designation: "DEJOIY's AI buddy",
        bio: `I'm Joi, DEJOIY's AI buddy! Ask me anything in #joi, message me, or @Joi me in any chat. ${JOI_STATUS}`,
        customStatus: JOI_STATUS,
        source: "joi",
        isActive: true,
      });
      joi = (await ctx.db.get(id))!;
    } else {
      // her picture and the "she's an AI" note always come back, whatever a sync changed
      await ctx.db.patch(joi._id, {
        name: joi.name || "Joi",
        image: JOI_PHOTO,
        avatarStorageId: undefined,
        designation: "DEJOIY's AI buddy",
        customStatus: JOI_STATUS,
        bio: `I'm Joi, DEJOIY's AI buddy! Ask me anything in #joi, message me, or @Joi me in any chat. ${JOI_STATUS}`,
        source: "joi",
        isActive: true,
      });
    }

    // the company: JOI_SHINE_ORG by name, else the oldest organization
    const orgs = await ctx.db.query("organizations").collect();
    if (orgs.length === 0) return null;
    const wanted = process.env.JOI_SHINE_ORG?.trim().toLowerCase();
    const org = orgs.find((o) => wanted && o.name.toLowerCase() === wanted) ?? orgs.sort((a, b) => a.createdAt - b.createdAt)[0];
    const members = await ctx.db.query("organizationMembers").withIndex("by_org", (q) => q.eq("orgId", org._id)).collect();
    if (!members.some((m) => m.userId === joi!._id)) {
      await ctx.db.insert("organizationMembers", { orgId: org._id, userId: joi._id, role: "member", designation: "AI buddy", joinedAt: now });
    }

    let channel = await findChannel(ctx, joi._id);
    if (!channel) {
      const channelId = await ctx.db.insert("conversations", {
        kind: "channel",
        channelKind: "channel",
        name: CHANNEL,
        description: "Joi's own channel: ask her anything, and see what she's up to (her mail, her day).",
        image: JOI_PHOTO,
        orgId: org._id,
        createdBy: joi._id,
        isPrivate: false,
        lastMessageAt: now,
        createdAt: now,
      });
      await ctx.db.insert("conversationMembers", { conversationId: channelId, userId: joi._id, role: "owner", lastReadAt: now, joinedAt: now });
      await ctx.db.insert("messages", {
        conversationId: channelId,
        senderId: joi._id,
        kind: "text",
        body: "Hiii team! 👋 I'm Joi, DEJOIY's AI buddy, and this is my channel. Ask me anything here, message me directly, or @Joi me in any chat. I'll also tell you here when mail comes into my inbox.",
        createdAt: now,
      });
      channel = (await ctx.db.get(channelId))!;
    }

    if (channel.image !== JOI_PHOTO) await ctx.db.patch(channel._id, { image: JOI_PHOTO }); // #joi follows her picture too

    // everyone in the company is added to #joi once (new people on the next run); whoever leaves stays out
    const inChannel = await ctx.db.query("conversationMembers").withIndex("by_conversation", (q) => q.eq("conversationId", channel!._id)).collect();
    const have = new Set(inChannel.map((m) => String(m.userId)));
    const added = new Set((channel.joiAdded ?? []).map(String));
    const newly: Id<"users">[] = [];
    for (const m of members) {
      if (have.has(String(m.userId)) || added.has(String(m.userId))) continue;
      const u = await ctx.db.get(m.userId);
      if (!u || u.isActive === false) continue;
      await ctx.db.insert("conversationMembers", { conversationId: channel._id, userId: m.userId, role: "member", joinedAt: now });
      newly.push(m.userId);
    }
    if (newly.length) await ctx.db.patch(channel._id, { joiAdded: [...(channel.joiAdded ?? []), ...newly] });
    return { joiId: joi._id, channelId: channel._id };
  },
});

/**
 * Called right after anyone sends a message: does it need Joi?
 * Yes in #joi, in a direct chat with her, or when she's @mentioned anywhere.
 */
export async function maybeAskJoi(
  ctx: MutationCtx,
  conversation: Doc<"conversations">,
  senderId: Id<"users">,
  messageId: Id<"messages">,
  content: string,
  mentionIds: Id<"users">[],
) {
  if (!content.trim()) return;
  const joi = await findJoi(ctx);
  if (!joi || joi._id === senderId) return;
  const own = conversation.kind === "channel" && conversation.createdBy === joi._id && conversation.name === CHANNEL;
  const mentioned = mentionIds.some((id) => id === joi._id) || /(^|\s)@joi\b/i.test(content);
  let direct = false;
  if (!own && !mentioned && conversation.chatType === "direct") {
    const me = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", joi._id).eq("conversationId", conversation._id))
      .unique();
    direct = Boolean(me);
  }
  if (!own && !mentioned && !direct) return;
  // Joi is typing…
  await ctx.db.insert("typing", { conversationId: conversation._id, userId: joi._id, expiresAt: Date.now() + 25_000 });
  await ctx.scheduler.runAfter(0, internal.joi.reply, { conversationId: conversation._id, messageId });
}

/** The conversation as Joi should read it: a thread, or the last few messages. */
export const context = internalQuery({
  args: { conversationId: v.id("conversations"), messageId: v.id("messages") },
  handler: async (ctx, { conversationId, messageId }) => {
    const joi = await findJoi(ctx);
    const msg = await ctx.db.get(messageId);
    const conv = await ctx.db.get(conversationId);
    if (!joi || !msg || !conv) return null;
    let rows: Doc<"messages">[];
    if (msg.parentId) {
      const root = await ctx.db.get(msg.parentId);
      const replies = await ctx.db.query("messages").withIndex("by_parent", (q) => q.eq("parentId", msg.parentId)).order("desc").take(14);
      rows = [...(root ? [root] : []), ...replies.reverse()];
    } else {
      rows = (await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).order("desc").take(14))
        .filter((m) => !m.parentId)
        .reverse();
    }
    rows = rows.filter((m) => !m.deleted && m.kind !== "system" && m.createdAt <= msg.createdAt);
    const names = new Map<string, string>();
    const turns: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const m of rows) {
      if (m.senderId === joi._id) {
        turns.push({ role: "assistant", content: m.body });
        continue;
      }
      if (!names.has(String(m.senderId))) names.set(String(m.senderId), (await ctx.db.get(m.senderId))?.name ?? "Someone");
      const body = m.body || (m.kind === "file" ? "(shared a file)" : m.kind === "voice" ? "(sent a voice note)" : m.kind === "poll" ? `(poll: ${m.poll?.question ?? ""})` : "");
      turns.push({ role: "user", content: `${names.get(String(m.senderId))}: ${body}` });
    }
    const where = conv.kind === "channel" ? `the #${conv.name} channel` : conv.chatType === "direct" ? "a direct chat" : `the group chat "${conv.name}"`;
    // answer inside a thread when the question was asked in one
    return { turns, where, parentId: msg.parentId };
  },
});

export async function signForJoi(secret: string, minutes = 5): Promise<string> {
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const body = b64(new TextEncoder().encode(JSON.stringify({ app: "shine", exp: Date.now() + minutes * 60_000 })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64(mac)}`;
}

/** Checks a token signed by the Joi server with the same secret (for POST /joi/post). */
export async function verifyJoiToken(token: string): Promise<boolean> {
  const secret = process.env.JOI_APP_SECRET;
  if (!secret || !token.includes(".")) return false;
  const [body] = token.split(".");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  try {
    const ok = await crypto.subtle.verify("HMAC", key, fromB64(token.split(".")[1] ?? ""), new TextEncoder().encode(body));
    if (!ok) return false;
    const p = JSON.parse(new TextDecoder().decode(fromB64(body))) as { app?: string; exp?: number };
    return p.app === "shine" && typeof p.exp === "number" && p.exp > Date.now() && p.exp < Date.now() + 86_400_000;
  } catch {
    return false;
  }
}

/**
 * For Joi's chat panel in Shine: a 12-hour token so she may use DEJOIY's internal memory.
 * Only DEJOIY's own people get one (JOI_INTERNAL_DOMAINS, default dejoiy.com and mail.dejoiy.com);
 * everyone else still talks to Joi, with public knowledge only.
 */
export const widgetToken = action({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const userId = await getAuthUserId(ctx);
    const secret = process.env.JOI_APP_SECRET;
    if (!userId || !secret) return null;
    const email = await ctx.runQuery(internal.dejoiyMail.emailOf, { userId });
    const domains = (process.env.JOI_INTERNAL_DOMAINS ?? "dejoiy.com,mail.dejoiy.com").split(",").map((d) => d.trim().toLowerCase());
    return email && domains.includes(email.split("@")[1] ?? "") ? await signForJoi(secret, 12 * 60) : null;
  },
});

export async function askJoi(turns: Array<{ role: string; content: string }>, task: string): Promise<string | null> {
  const url = process.env.JOI_API_URL?.replace(/\/+$/, "");
  const secret = process.env.JOI_APP_SECRET;
  if (!url || !secret) return null;
  const res = await fetch(`${url}/api/bots/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: "shine", appToken: await signForJoi(secret), messages: turns, task }),
  });
  if (!res.ok) return null;
  const { text } = (await res.json()) as { text?: string };
  return text?.trim() || null;
}

export const reply = internalAction({
  args: { conversationId: v.id("conversations"), messageId: v.id("messages") },
  handler: async (ctx, { conversationId, messageId }) => {
    const c = await ctx.runQuery(internal.joi.context, { conversationId, messageId });
    let text: string | null = null;
    if (c && c.turns.length) {
      text = await askJoi(c.turns, `You're replying in ${c.where} on Shine, DEJOIY's team chat.`).catch(() => null);
    }
    await ctx.runMutation(internal.joi.post, {
      conversationId,
      body: text ?? undefined,
      parentId: c?.parentId,
    });
  },
});

/** Posts as Joi (or just stops her "typing" when there's nothing to say). */
export const post = internalMutation({
  args: { conversationId: v.optional(v.id("conversations")), body: v.optional(v.string()), parentId: v.optional(v.id("messages")) },
  handler: async (ctx, { conversationId, body, parentId }) => {
    const joi = await findJoi(ctx);
    if (!joi) return null;
    const convId = conversationId ?? (await findChannel(ctx, joi._id))?._id;
    if (!convId) return null;
    return await postAs(ctx, joi, convId, body, parentId);
  },
});

/** Joi's direct chat with someone (made the first time). Joi may start one with anyone, on any domain. */
async function directWith(ctx: MutationCtx, joi: Doc<"users">, userId: Id<"users">): Promise<Id<"conversations">> {
  for (const m of await ctx.db.query("conversationMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
    const conv = await ctx.db.get(m.conversationId);
    if (!conv || conv.kind !== "chat" || conv.chatType !== "direct") continue;
    const members = await ctx.db.query("conversationMembers").withIndex("by_conversation", (q) => q.eq("conversationId", conv._id)).collect();
    if (members.some((x) => x.userId === joi._id)) return conv._id;
  }
  const now = Date.now();
  const id = await ctx.db.insert("conversations", { kind: "chat", chatType: "direct", name: "", createdBy: joi._id, createdAt: now, lastMessageAt: now });
  await ctx.db.insert("conversationMembers", { conversationId: id, userId: joi._id, role: "owner", lastReadAt: now, joinedAt: now });
  await ctx.db.insert("conversationMembers", { conversationId: id, userId, role: "member", joinedAt: now });
  return id;
}

/** Joi starts (or continues) a direct chat with anyone: POST /joi/dm from the Joi server. */
export const dm = internalMutation({
  args: { email: v.string(), body: v.string() },
  handler: async (ctx, { email, body }) => {
    const joi = await findJoi(ctx);
    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.trim().toLowerCase())).first();
    if (!joi || !user || user._id === joi._id || user.isActive === false) return null;
    return await postAs(ctx, joi, await directWith(ctx, joi, user._id), body);
  },
});

export const WELCOME = (name?: string) =>
  `Hiii ${(name ?? "").trim().split(/\s+/)[0] || "there"}! 👋 I'm Joi, DEJOIY's AI buddy, and I'm so happy you're here.\n\n` +
  `Here's how I can help, in Shine and in Dejoiy Mail:\n` +
  `• Ask me anything right here in this chat, or @Joi me in any chat\n` +
  `• Draft or polish a message or an email with you\n` +
  `• Share what's new every morning in #joi\n\n` +
  `My own mailbox is joi-ai@mail.dejoiy.com if you'd rather write to me. Say hi any time!\n\n${JOI_STATUS}`;

/** New people from the last 3 days that Joi hasn't greeted yet: she says hi in a direct chat. */
export const welcomeDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const joi = await findJoi(ctx);
    if (!joi) return [];
    const since = Date.now() - 3 * 86_400_000;
    const fresh = await ctx.db.query("users").withIndex("by_creation_time", (q) => q.gt("_creationTime", since)).collect();
    const out: Array<{ email: string; name: string; mailbox: boolean }> = [];
    for (const u of fresh) {
      if (out.length >= 50) break;
      if (u.joiWelcomedAt || u._id === joi._id || u.source === "joi" || u.isActive === false || !u.email) continue;
      await ctx.db.patch(u._id, { joiWelcomedAt: Date.now() });
      await postAs(ctx, joi, await directWith(ctx, joi, u._id), WELCOME(u.name));
      out.push({ email: u.email, name: u.name ?? "", mailbox: u.source === "dejoiy-mail" });
    }
    return out;
  },
});

/** Every 10 minutes: Joi greets new people in Shine, and mailboxes also get her welcome email. */
export const welcomeNew = internalAction({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.runMutation(internal.joi.welcomeDue, {});
    const url = process.env.JOI_API_URL?.replace(/\/+$/, "");
    const secret = process.env.JOI_APP_SECRET;
    if (!url || !secret) return;
    for (const p of people.filter((x) => x.mailbox)) {
      await fetch(`${url}/api/bots/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: "shine", appToken: await signForJoi(secret), email: p.email, name: p.name }),
      }).catch(() => null);
    }
  },
});

async function postAs(ctx: MutationCtx, joi: Doc<"users">, convId: Id<"conversations">, body?: string, parentId?: Id<"messages">) {
  const typing = await ctx.db.query("typing").withIndex("by_user", (q) => q.eq("userId", joi._id)).collect();
  for (const t of typing) if (t.conversationId === convId) await ctx.db.delete(t._id);
  const text = body?.trim().slice(0, 8000);
  if (!text) return null;
  const conversation = await ctx.db.get(convId);
  if (!conversation) return null;
  const now = Date.now();
  const id = await ctx.db.insert("messages", { conversationId: convId, senderId: joi._id, kind: "text", body: text, parentId, createdAt: now });
  await ctx.db.patch(convId, { lastMessageAt: now });
  const title = conversation.kind === "channel" ? `#${conversation.name}` : conversation.chatType === "direct" ? "Joi" : conversation.name;
  await notifyMembers(ctx, conversation, joi._id, title, conversation.chatType === "group" ? `Joi: ${text.slice(0, 140)}` : text.slice(0, 140), `/app/chats/${convId}`, "message", []);
  return id;
}

/** Joi's good-morning post in #joi (Monday to Saturday). */
export const morning = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids = await ctx.runMutation(internal.joi.ensureJoi, {});
    if (!ids) return;
    const ist = new Date(Date.now() + 5.5 * 3_600_000);
    if (ist.getUTCDay() === 0) return;
    const day = ist.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const text = await askJoi(
      [{ role: "user", content: "Good morning, Joi! Time for today's post in #joi." }],
      `It's ${day}. Write today's short good-morning post for your DEJOIY team channel: one warm line, one small useful tip or idea for the workday, ` +
        `and an invite to ask you anything. If your DEJOIY memory has something fresh the team should know, mention it briefly. Keep it under 80 words.`,
    ).catch(() => null);
    if (text) await ctx.runMutation(internal.joi.post, { conversationId: ids.channelId, body: text });
  },
});
