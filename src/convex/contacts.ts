import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./users";

export const myContacts = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const items = [];
    for (const c of rows) {
      const user = await ctx.db.get(c.contactId);
      if (!user) continue;
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user", (q) => q.eq("userId", c.contactId))
        .unique();
      const recentChat = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", me._id))
        .filter((q) => q.eq(q.field("userId"), me._id))
        .collect();
      let lastActive = 0;
      for (const m of recentChat) {
        const conv = await ctx.db.get(m.conversationId);
        if (!conv || conv.kind !== "chat" || conv.chatType !== "direct") continue;
        const other = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .filter((q) => q.eq(q.field("userId"), c.contactId))
          .unique();
        if (other) lastActive = Math.max(lastActive, conv.lastMessageAt ?? 0);
      }
      items.push({ contact: c, user, presence, lastActive });
    }
    return items.sort((a, b) => b.lastActive - a.lastActive);
  },
});

export const add = mutation({
  args: { contactId: v.id("users") },
  handler: async (ctx, { contactId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (me._id === contactId) throw new Error("Cannot add yourself");
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .filter((q) => q.eq(q.field("contactId"), contactId))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("contacts", {
      userId: me._id,
      contactId,
      createdAt: Date.now(),
      source: "manual",
    });
  },
});

export const remove = mutation({
  args: { contactId: v.id("users") },
  handler: async (ctx, { contactId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .filter((q) => q.eq(q.field("contactId"), contactId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const toggleFavorite = mutation({
  args: { contactId: v.id("users") },
  handler: async (ctx, { contactId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .filter((q) => q.eq(q.field("contactId"), contactId))
      .unique();
    if (!existing) throw new Error("Not a contact");
    await ctx.db.patch(existing._id, { isFavorite: !existing.isFavorite });
  },
});

export const toggleBlock = mutation({
  args: { contactId: v.id("users") },
  handler: async (ctx, { contactId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .filter((q) => q.eq(q.field("contactId"), contactId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { isBlocked: !existing.isBlocked });
    } else {
      await ctx.db.insert("contacts", {
        userId: me._id,
        contactId,
        isBlocked: true,
        createdAt: Date.now(),
        source: "manual",
      });
    }
  },
});

/** Suggested contacts: active users you don't already know. */
export const suggested = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const all = await ctx.db.query("users").take(200);
    const myRows = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const known = new Set<string>(myRows.map((r) => r.contactId));
    const results = [];
    for (const u of all) {
      if (u._id === me._id || known.has(u._id)) continue;
      if (u.isAnonymous || u.isActive === false) continue;
      const presence = await ctx.db
        .query("presence")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .unique();
      results.push({ ...u, presence });
      if (results.length >= 12) break;
    }
    return results;
  },
});
