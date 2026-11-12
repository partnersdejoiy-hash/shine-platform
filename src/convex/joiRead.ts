import { v } from "convex/values";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { action, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { GRANT_HOURS, deriveGrantKey, readGrant, signGrant } from "./lib/joiGrant";

/**
 * Joi reading the chats of the person who is talking to her, and nobody else's.
 *
 * 1. In Shine, that person's Joi panel asks for a grant (`grant` below). Shine signs it with a key
 *    only this server has, naming that person and their current sign-in.
 * 2. Joi's server calls POST /joi/chats (http.ts) with the grant and its own fresh signature.
 * 3. Shine checks both, checks the sign-in is still live and chat is not switched off, and returns
 *    that person's latest chats as text. Nothing is ever sent, changed or deleted.
 */

async function grantKey(): Promise<ArrayBuffer | null> {
  const secret = process.env.JWT_PRIVATE_KEY; // already required for Shine sign-in; never leaves this server
  return secret ? await deriveGrantKey(secret) : null;
}

export const grant = action({
  args: {},
  handler: async (ctx): Promise<{ app: "shine"; grant: string; url: string } | null> => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    const key = await grantKey();
    if (!userId || !sessionId || !key) return null;
    const email = await ctx.runQuery(internal.dejoiyMail.emailOf, { userId });
    if (!email) return null;
    const site = (process.env.CONVEX_SITE_URL ?? "").replace(/\/+$/, "");
    return {
      app: "shine",
      grant: await signGrant(key, { u: userId, s: sessionId, e: email.toLowerCase(), exp: Date.now() + GRANT_HOURS * 3_600_000 }),
      url: `${site}/joi/chats`,
    };
  },
});

/** Checks a grant; the person's id if it is good and their sign-in is still live. */
export async function personFromGrant(ctx: ActionCtx, token: unknown): Promise<Id<"users"> | null> {
  const key = await grantKey();
  if (!key) return null;
  const g = await readGrant(key, token);
  if (!g) return null;
  const live: boolean = await ctx.runQuery(internal.joiRead.sessionLive, { userId: g.u, sessionId: g.s, email: g.e });
  return live ? (g.u as Id<"users">) : null;
}

export const sessionLive = internalQuery({
  args: { userId: v.string(), sessionId: v.string(), email: v.string() },
  handler: async (ctx, { userId, sessionId, email }): Promise<boolean> => {
    const uid = ctx.db.normalizeId("users", userId);
    const sid = ctx.db.normalizeId("authSessions", sessionId);
    if (!uid || !sid) return false;
    const [user, session] = await Promise.all([ctx.db.get(uid), ctx.db.get(sid)]);
    if (!user || !session || session.userId !== uid || session.expirationTime <= Date.now()) return false;
    if (user.chatOff || (user.email ?? "").toLowerCase() !== email) return false;
    return true;
  },
});

const CHATS = 20;
const PER_CHAT = 30;

/** Read-only: this person's latest chats with their newest messages, as plain text. */
export const chats = internalQuery({
  args: { userId: v.id("users"), conversationId: v.optional(v.string()) },
  handler: async (ctx, { userId, conversationId }) => {
    const memberships = await ctx.db.query("conversationMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const wanted = conversationId ? ctx.db.normalizeId("conversations", conversationId) : null;
    if (conversationId && !wanted) return { chats: [] };
    const mine = (await Promise.all(memberships.filter((m) => !wanted || m.conversationId === wanted).map(async (m) => ({ m, c: await ctx.db.get(m.conversationId) }))))
      .filter((x): x is { m: typeof x.m; c: NonNullable<typeof x.c> } => x.c !== null)
      .sort((a, b) => (b.c.lastMessageAt ?? b.c.createdAt) - (a.c.lastMessageAt ?? a.c.createdAt))
      .slice(0, wanted ? 1 : CHATS);
    const names = new Map<string, string>();
    const nameOf = async (id: Id<"users">) => {
      if (!names.has(id)) {
        const u = await ctx.db.get(id);
        names.set(id, u?.name || u?.email || "Someone");
      }
      return names.get(id)!;
    };
    const out = [];
    for (const { m, c } of mine) {
      const recent = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).order("desc").take(PER_CHAT * 2);
      const visible = recent.filter((x) => !x.deleted && !(x.hiddenFor ?? []).includes(userId)).slice(0, PER_CHAT).reverse();
      let title = c.kind === "channel" ? `#${c.name}` : c.name;
      if (c.kind === "chat" && c.chatType === "direct") {
        const others = (await ctx.db.query("conversationMembers").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).take(3)).filter((x) => x.userId !== userId);
        title = others.length ? await nameOf(others[0].userId) : "Notes to self";
      }
      out.push({
        id: c._id,
        title,
        type: c.kind === "channel" ? "channel" : c.chatType === "direct" ? "direct" : "group",
        lastMessageAt: c.lastMessageAt ?? null,
        unread: visible.filter((x) => x.senderId !== userId && x.createdAt > (m.lastReadAt ?? 0)).length,
        messages: await Promise.all(
          visible.map(async (x) => ({
            from: x.senderId === userId ? "me" : await nameOf(x.senderId),
            at: x.createdAt,
            kind: x.kind,
            text: x.kind === "poll" && x.poll ? `Poll: ${x.poll.question}` : x.body.slice(0, 1000),
            files: (x.attachments ?? []).map((a) => a.name).slice(0, 10),
            inThread: x.parentId ? true : undefined,
          })),
        ),
      });
    }
    return { chats: out };
  },
});
