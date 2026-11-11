import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
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
const JOI_PHOTO = "https://joi-ai.dejoiy.com/joi-portrait-192.jpg";
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
        bio: "I'm Joi! Ask me anything in #joi, message me, or @Joi me in any chat.",
        source: "joi",
        isActive: true,
      });
      joi = (await ctx.db.get(id))!;
    } else {
      await ctx.db.patch(joi._id, {
        name: joi.name || "Joi",
        image: joi.image || JOI_PHOTO,
        designation: joi.designation || "DEJOIY's AI buddy",
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

export async function signForJoi(secret: string): Promise<string> {
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const body = b64(new TextEncoder().encode(JSON.stringify({ app: "shine", exp: Date.now() + 5 * 60_000 })));
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

async function askJoi(turns: Array<{ role: string; content: string }>, task: string): Promise<string | null> {
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
  },
});

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
