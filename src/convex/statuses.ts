import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { getCurrentUser, logAudit, safeStorageUrl } from "./users";

/**
 * WhatsApp-style Status — text / photo / video / link / emoji posts that
 * expire 24 hours after creation. Visibility is enforced server-side.
 */
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

const STATUS_KIND = v.union(
  v.literal("text"),
  v.literal("photo"),
  v.literal("video"),
  v.literal("link"),
  v.literal("emoji"),
);

/** Everyone who can see my statuses: contacts (both directions) + same-org members. */
async function myViewerUserIds(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
): Promise<{ contacts: Set<string>; orgMembers: Set<string> }> {
  const contacts = new Set<string>();
  const myAdded = await ctx.db
    .query("contacts")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const c of myAdded) contacts.add(String(c.contactId));
  const incoming = await ctx.db
    .query("contacts")
    .filter((q) => q.eq(q.field("contactId"), userId))
    .collect();
  for (const c of incoming) contacts.add(String(c.userId));

  const orgMembers = new Set<string>();
  const myOrgs = await ctx.db
    .query("organizationMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (myOrgs.length > 0) {
    const orgIds = new Set(myOrgs.map((m) => String(m.orgId)));
    const allMemberships = await ctx.db.query("organizationMembers").collect();
    for (const m of allMemberships) {
      if (orgIds.has(String(m.orgId))) orgMembers.add(String(m.userId));
    }
  }
  return { contacts, orgMembers };
}

/** Publish a status. Expires automatically after 24 hours. */
export const create = mutation({
  args: {
    kind: STATUS_KIND,
    text: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaStorageId: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    visibility: v.union(
      v.literal("contacts"),
      v.literal("org"),
      v.literal("everyone"),
      v.literal("custom"),
    ),
  },
  handler: async (ctx, { kind, text, mediaUrl, mediaStorageId, mimeType, visibility }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");

    if (kind === "text" || kind === "link" || kind === "emoji") {
      if (!text || !text.trim()) throw new ConvexError("Status text is required");
    } else if (!mediaUrl && !mediaStorageId) {
      throw new ConvexError("Media is required for photo/video status");
    }
    if ((text ?? "").length > 500) throw new ConvexError("Status text is limited to 500 characters");

    const url =
      mediaStorageId || mediaUrl
        ? ((await safeStorageUrl(ctx, mediaStorageId ?? null, mediaUrl)) ?? "")
        : "";

    const now = Date.now();
    const id = await ctx.db.insert("statuses", {
      userId: me._id,
      kind,
      text: text?.trim(),
      mediaUrl: url,
      mediaStorageId,
      mimeType,
      visibility,
      viewCount: 0,
      viewers: [],
      createdAt: now,
      expiresAt: now + STATUS_TTL_MS,
    });
    await logAudit(ctx, me._id, "status.created", "statuses", String(id), kind);
    return id;
  },
});

/** The current user's own statuses (with viewer lists). */
export const myStatuses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("statuses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

/** Status feed: statuses I'm allowed to see, not yet expired, newest first. */
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const now = Date.now();
    const { contacts, orgMembers } = await myViewerUserIds(ctx, userId);

    const all = await ctx.db.query("statuses").take(1000);
    const mine: any[] = [];
    const others: any[] = [];
    for (const s of all) {
      if (s.expiresAt <= now) continue;
      if (String(s.userId) === String(userId)) {
        mine.push(s);
        continue;
      }
      const uid = String(s.userId);
      const canSee =
        s.visibility === "everyone"
          ? true
          : s.visibility === "contacts"
            ? contacts.has(uid)
            : s.visibility === "org" || s.visibility === "custom"
              ? orgMembers.has(uid)
              : false;
      if (canSee) others.push(s);
    }

    const userCache = new Map<string, any>();
    const getUser = async (uid: Id<"users">) => {
      let u = userCache.get(String(uid));
      if (!u) {
        u = await ctx.db.get(uid);
        userCache.set(String(uid), u);
      }
      return u;
    };

    const enrich = async (s: any) => ({ status: s, user: await getUser(s.userId) });
    const rows = [...mine, ...others].sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(rows.slice(0, 200).map(enrich));
  },
});

/** Record that the current user viewed a status (once per viewer). */
export const view = mutation({
  args: { statusId: v.id("statuses") },
  handler: async (ctx, { statusId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not authenticated");
    const status = await ctx.db.get(statusId);
    if (!status) throw new ConvexError("Status not found");
    if (status.expiresAt <= Date.now()) throw new ConvexError("Status expired");

    const viewers = (status.viewers ?? []).filter(
      (v) => String(v.userId) !== String(userId),
    );
    viewers.push({ userId, at: Date.now() });
    await ctx.db.patch(statusId, { viewers, viewCount: viewers.length });
    return true;
  },
});

/** Delete one of my own statuses (or an admin moderating it). */
export const remove = mutation({
  args: { statusId: v.id("statuses") },
  handler: async (ctx, { statusId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const status = await ctx.db.get(statusId);
    if (!status) throw new ConvexError("Status not found");
    const isOwner = String(status.userId) === String(me._id);
    const isMod =
      me.role === "super_admin" || me.role === "admin" || me.role === "dejoiy_admin";
    if (!isOwner && !isMod) throw new ConvexError("You can only delete your own statuses");
    await ctx.db.delete(statusId);
    if (!isOwner) {
      await logAudit(ctx, me._id, "status.moderated", "statuses", String(statusId));
    }
    return true;
  },
});

/** Lazily purge expired statuses (called opportunistically). */
export const sweep = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("statuses")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(50);
    for (const s of expired) await ctx.db.delete(s._id);
    return expired.length;
  },
});
