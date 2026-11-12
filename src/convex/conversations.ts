import { canContact } from "./reach";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUser, isSuperAdmin, logAudit, safeStorageUrl } from "./users";
import { roleHasPermission } from "./permissions";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const results = [];
    for (const membership of memberships) {
      const conversation = await ctx.db.get(membership.conversationId);
      if (!conversation) continue;
      if (conversation.isMeeting) continue; // meeting chats live in the meeting room

      const memberRows = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      const members = await Promise.all(
        memberRows.map(async (m) => {
          const u = await ctx.db.get(m.userId);
          return u ? { ...u, role: m.role, lastReadAt: m.lastReadAt } : null;
        }),
      );

      const lastMessage = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .order("desc")
        .first();

      let unread = 0;
      const lastReadAt = membership.lastReadAt ?? 0;
      if (lastMessage && lastMessage.createdAt > lastReadAt && lastMessage.senderId !== userId) {
        unread = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .filter((q) =>
            q.and(
              q.gt(q.field("createdAt"), lastReadAt),
              q.neq(q.field("senderId"), userId),
              q.neq(q.field("deleted"), true),
            ),
          )
          .collect()
          .then((msgs) => msgs.length);
      }

      // Skip archived conversations (WhatsApp-style archive).
      if (membership.isArchived) continue;

      results.push({
        conversation,
        membership,
        members: members.filter((m): m is NonNullable<typeof m> => m !== null),
        lastMessage: lastMessage ?? null,
        unread,
      });
    }

    return results.sort((a, b) => {
      // Pinned conversations float to the top (WhatsApp-style).
      const pinA = a.membership.isPinned ? 1 : 0;
      const pinB = b.membership.isPinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      const ta = a.lastMessage?.createdAt ?? a.conversation.createdAt;
      const tb = b.lastMessage?.createdAt ?? b.conversation.createdAt;
      return tb - ta;
    });
  },
});

/**
 * Sum of unread messages across all conversations for the sidebar badge.
 * Uses the same unread logic as `list` but only returns a single count.
 */
export const totalUnread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    let total = 0;
    for (const membership of memberships) {
      if (membership.isArchived) continue;
      const lastReadAt = membership.lastReadAt ?? 0;
      const lastMsg = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", membership.conversationId),
        )
        .order("desc")
        .first();
      if (lastMsg && lastMsg.createdAt > lastReadAt && lastMsg.senderId !== userId) {
        const count = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", membership.conversationId),
          )
          .filter((q) =>
            q.and(
              q.gt(q.field("createdAt"), lastReadAt),
              q.neq(q.field("senderId"), userId),
              q.neq(q.field("deleted"), true),
            ),
          )
          .collect()
          .then((msgs) => msgs.length);
        total += count;
      }
    }
    return total;
  },
});

export const detail = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", userId).eq("conversationId", conversationId))
      .unique();
    if (!membership) return null;
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;

    const memberRows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const members = await Promise.all(
      memberRows.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return u ? { ...u, role: m.role, lastReadAt: m.lastReadAt, isMuted: m.isMuted } : null;
      }),
    );

    const pinned = await ctx.db
      .query("pinnedMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(20);
    const pinnedMessages = await Promise.all(
      pinned.map(async (p) => {
        const msg = await ctx.db.get(p.messageId);
        if (!msg || msg.deleted) return null;
        const sender = await ctx.db.get(msg.senderId);
        return { ...msg, pinnedBy: p.pinnedBy, sender: sender ?? null };
      }),
    );

    const fileRows = await ctx.db
      .query("files")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .take(50);
    const files = await Promise.all(
      fileRows.map(async (f) => {
        const url = (await safeStorageUrl(ctx, f.storageId, f.url)) ?? f.url;
        return { ...f, url };
      }),
    );

    return {
      conversation,
      myRole: membership.role,
      members: members.filter((m): m is NonNullable<typeof m> => m !== null),
      pinnedMessages,
      files,
    };
  },
});

/** Find or create a 1:1 direct chat with another user. */
export const openDirectChat = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    if (me._id === userId) throw new ConvexError("Cannot chat with yourself");
    const them = await ctx.db.get(userId);
    // other companies: only their supervisors, and only if your admins allow it
    if (!them || !(await canContact(ctx, me, them))) throw new ConvexError("You can't message this person from your company.");

    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    for (const m of myMemberships) {
      const conv = await ctx.db.get(m.conversationId);
      if (!conv || conv.kind !== "chat" || conv.chatType !== "direct") continue;
      const other = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .filter((q) => q.eq(q.field("userId"), userId))
        .unique();
      if (other) return conv._id;
    }

    const now = Date.now();
    const convId = await ctx.db.insert("conversations", {
      kind: "chat",
      chatType: "direct",
      name: "",
      createdBy: me._id,
      createdAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId: me._id,
      role: "owner",
      lastReadAt: now,
      joinedAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId,
      role: "member",
      joinedAt: now,
    });
    // Auto-move the person into both contact lists the moment you connect
    // (WhatsApp-style) — no manual "add contact" step needed.
    await autoContact(ctx, me._id, userId, "auto_chat");
    await autoContact(ctx, userId, me._id, "auto_chat");
    return convId;
  },
});

/** Insert a contact row if it doesn't exist yet (idempotent). */
async function autoContact(ctx: any, userId: string, contactId: string, source: string) {
  const existing = await ctx.db
    .query("contacts")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("contactId"), contactId))
    .unique();
  if (existing) return;
  await ctx.db.insert("contacts", {
    userId,
    contactId,
    createdAt: Date.now(),
    source,
  });
}

export const createGroupChat = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
    policies: v.optional(v.object({
      whoCanSend: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
      whoCanManageMembers: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
      whoCanEditInfo: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
    })),
  },
  handler: async (ctx, { name, memberIds, policies }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    if (
      !isSuperAdmin(me) &&
      !(await roleHasPermission(ctx, me.role, "group_chat", me.approvedPermissions))
    ) {
      throw new ConvexError(
        "Your role does not include group chat — request it from Settings → Security",
      );
    }
    const ids = Array.from(new Set([me._id, ...memberIds]));
    if (ids.length < 2) throw new ConvexError("A group needs at least two members");
    const now = Date.now();
    const convId = await ctx.db.insert("conversations", {
      kind: "chat",
      chatType: "group",
      name: name.trim() || "Untitled group",
      createdBy: me._id,
      policies: policies && (policies.whoCanSend || policies.whoCanManageMembers || policies.whoCanEditInfo) ? {
        whoCanSend: policies.whoCanSend ?? "everyone",
        whoCanManageMembers: policies.whoCanManageMembers ?? "everyone",
        whoCanEditInfo: policies.whoCanEditInfo ?? "everyone",
      } : undefined,
      createdAt: now,
    });
    for (const uid of ids) {
      await ctx.db.insert("conversationMembers", {
        conversationId: convId,
        userId: uid,
        role: uid === me._id ? "owner" : "member",
        lastReadAt: uid === me._id ? now : undefined,
        joinedAt: now,
      });
      // Everyone in a new group becomes a contact of the creator too.
      if (uid !== me._id) await autoContact(ctx, me._id, uid, "group");
    }
    await ctx.db.insert("messages", {
      conversationId: convId,
      senderId: me._id,
      kind: "system",
      body: `${me.name ?? "Someone"} created the group "${name.trim() || "Untitled group"}"`,
      createdAt: now,
    });
    return convId;
  },
});

export const createChannel = mutation({
  args: {
    orgId: v.id("organizations"),
    teamId: v.optional(v.id("teams")),
    name: v.string(),
    description: v.optional(v.string()),
    channelKind: v.optional(
      v.union(v.literal("channel"), v.literal("broadcast"), v.literal("announcement")),
    ),
    isPrivate: v.optional(v.boolean()),
    policies: v.optional(v.object({
      whoCanSend: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
      whoCanManageMembers: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
      whoCanEditInfo: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
    })),
  },
  handler: async (ctx, { orgId, teamId, name, description, channelKind = "channel", isPrivate = false, policies }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    if (!isSuperAdmin(me)) {
      const required =
        channelKind === "broadcast" || channelKind === "announcement"
          ? "company_announcement"
          : teamId
            ? "team_groups"
            : "department_groups";
      if (!(await roleHasPermission(ctx, me.role, required, me.approvedPermissions))) {
        throw new ConvexError(
          `Your role does not include ${required.replace(/_/g, " ")} — request it from Settings → Security`,
        );
      }
    }
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), me._id))
      .unique();
    if (!membership) throw new ConvexError("You are not a member of this organization");

    const now = Date.now();
    const convId = await ctx.db.insert("conversations", {
      kind: "channel",
      channelKind,
      name: name.trim(),
      description,
      orgId,
      teamId,
      createdBy: me._id,
      isPrivate,
      policies: policies && (policies.whoCanSend || policies.whoCanManageMembers || policies.whoCanEditInfo) ? {
        whoCanSend: policies.whoCanSend ?? (channelKind === "announcement" ? "admins" : "everyone"),
        whoCanManageMembers: policies.whoCanManageMembers ?? "admins",
        whoCanEditInfo: policies.whoCanEditInfo ?? "admins",
      } : undefined,
      createdAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId: me._id,
      role: "owner",
      lastReadAt: now,
      joinedAt: now,
    });
    await ctx.db.insert("messages", {
      conversationId: convId,
      senderId: me._id,
      kind: "system",
      body: `${me.name ?? "Someone"} created the channel #${name.trim()}`,
      createdAt: now,
    });
    await logAudit(ctx, me._id, "channel.created", "conversations", String(convId), name, String(orgId));
    return convId;
  },
});

export const joinChannel = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const existing = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    if (existing) return conversationId;
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: me._id,
      role: "member",
      joinedAt: Date.now(),
    });
    return conversationId;
  },
});

export const leaveConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});

/** Whether a user is an owner/admin of a conversation membership row. */
async function isGroupAdmin(ctx: any, conversationId: string, userId: string) {
  const membership = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user_conv", (q: any) => q.eq("userId", userId).eq("conversationId", conversationId))
    .unique();
  return !!membership && (membership.role === "owner" || membership.role === "admin");
}

export const addMembers = mutation({
  args: { conversationId: v.id("conversations"), memberIds: v.array(v.id("users")) },
  handler: async (ctx, { conversationId, memberIds }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new ConvexError("Conversation not found");
    if (conversation.kind === "chat" && conversation.chatType === "group") {
      // WhatsApp-style group policy: only admins may add when restricted.
      const policy = (conversation.policies as any) ?? {};
      const isAdmin = await isGroupAdmin(ctx, conversationId, me._id as string);
      if (policy.whoCanManageMembers === "admins" && !isAdmin) {
        throw new ConvexError("Group policy: only group admins can add members");
      }
    }
    for (const uid of memberIds) {
      const existing = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user_conv", (q) => q.eq("userId", uid).eq("conversationId", conversationId))
        .unique();
      if (!existing) {
        await ctx.db.insert("conversationMembers", {
          conversationId,
          userId: uid,
          role: "member",
          joinedAt: Date.now(),
        });
      }
    }
    if (conversation.kind === "chat" && conversation.chatType === "group") {
      for (const uid of memberIds) await autoContact(ctx, me._id, uid, "group");
    }
  },
});

/** Admin/owner removes a member (server-side policy enforced). */
export const removeMember = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, { conversationId, userId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    if (String(me._id) === String(userId)) {
      throw new ConvexError("Leave the group instead of removing yourself");
    }
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new ConvexError("Conversation not found");
    if (conversation.kind === "chat" && conversation.chatType === "group") {
      const policy = (conversation.policies as any) ?? {};
      const isAdmin = await isGroupAdmin(ctx, conversationId, me._id as string);
      if (!isAdmin && policy.whoCanManageMembers === "admins") {
        throw new ConvexError("Group policy: only group admins can remove members");
      }
      if (!isAdmin && policy.whoCanManageMembers !== "admins") {
        throw new ConvexError("Only group admins can remove members");
      }
    }
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", userId).eq("conversationId", conversationId))
      .unique();
    if (membership) await ctx.db.delete(membership._id);
  },
});

/** WhatsApp-style group policies (who can send / manage members / edit info). */
export const updateGroupPolicy = mutation({
  args: {
    conversationId: v.id("conversations"),
    policies: v.object({
      whoCanSend: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
      whoCanManageMembers: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
      whoCanEditInfo: v.optional(v.union(v.literal("everyone"), v.literal("admins"))),
    }),
  },
  handler: async (ctx, { conversationId, policies }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new ConvexError("Conversation not found");
    if (conversation.kind !== "chat" || conversation.chatType !== "group") {
      throw new ConvexError("Group policies only apply to group chats");
    }
    const isAdmin = await isGroupAdmin(ctx, conversationId, me._id as string);
    if (!isAdmin) throw new ConvexError("Only group admins can change group policies");
    const current = (conversation.policies as any) ?? {};
    await ctx.db.patch(conversationId, {
      policies: { ...current, ...policies },
    });
  },
});

/** Set (or clear) the group/channel display picture. */
export const setConversationAvatar = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.optional(v.string()),
    url: v.optional(v.string()),
    clear: v.optional(v.boolean()),
  },
  handler: async (ctx, { conversationId, storageId, url, clear }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new ConvexError("Conversation not found");
    const isAdmin = await isGroupAdmin(ctx, conversationId, me._id as string);
    // WhatsApp-style "who can edit info" policy gates photo changes too.
    const policy = (conversation.policies as any) ?? {};
    if (policy.whoCanEditInfo === "everyone" && conversation.kind === "chat") {
      // anyone in the group may edit info
      const member = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
        .unique();
      if (!member) throw new ConvexError("You are not a member of this conversation");
    } else if (!isAdmin) {
      throw new ConvexError("Only the group creator or a group admin can change the photo");
    }

    if (clear) {
      await ctx.db.patch(conversationId, { image: undefined, avatarStorageId: undefined });
    } else {
      const resolved = (await safeStorageUrl(ctx, storageId ?? "", url ?? undefined)) ?? url ?? "";
      if (!resolved) throw new ConvexError("Could not resolve uploaded image");
      await ctx.db.patch(conversationId, {
        image: resolved,
        avatarStorageId: storageId ?? undefined,
      });
    }
    await ctx.db.insert("messages", {
      conversationId,
      senderId: me._id,
      kind: "system",
      body: `${me.name ?? "Someone"} ${clear ? "removed the group photo" : "changed the group photo"}`,
      createdAt: Date.now(),
    });
    await logAudit(ctx, me._id, "conversation.avatar_updated", "conversations", String(conversationId), conversation.name);
  },
});

/** Promote a member to admin, or demote an admin back to member. */
export const setMemberRole = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, { conversationId, userId, role }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new ConvexError("Conversation not found");
    const target = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", userId).eq("conversationId", conversationId))
      .unique();
    if (!target) throw new ConvexError("User is not a member of this group");
    if (target.role === "owner") throw new ConvexError("Cannot change the creator's role");
    const meMember = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    const isOwner = meMember?.role === "owner";
    const isAdmin = meMember?.role === "admin" || isOwner;
    if (!isAdmin) throw new ConvexError("Only group admins can manage roles");
    // WhatsApp-style: only the creator can demote an existing admin.
    if (!isOwner && target.role === "admin" && role === "member") {
      throw new ConvexError("Only the group creator can remove an admin");
    }
    if (!isOwner && role === "admin" && (conversation.policies as any)?.whoCanManageMembers === "admins") {
      // admins may still add admins unless the creator locked it — keep permissive,
      // but the creator always retains sole demote rights.
    }
    await ctx.db.patch(target._id, { role });
    await ctx.db.insert("messages", {
      conversationId,
      senderId: me._id,
      kind: "system",
      body:
        role === "admin"
          ? `${me.name ?? "Someone"} promoted a member to group admin`
          : `${me.name ?? "Someone"} removed a group admin`,
      createdAt: Date.now(),
    });
    await logAudit(ctx, me._id, "conversation.member_role", "conversations", String(conversationId), `${userId}:${role}`);
  },
});

/** Rename a group or channel. Owner/admin only, or anyone if whoCanEditInfo === "everyone". */
export const renameConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    name: v.string(),
  },
  handler: async (ctx, { conversationId, name }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new ConvexError("Conversation not found");
    if (conversation.kind !== "chat" && conversation.kind !== "channel") {
      throw new ConvexError("Only groups and channels can be renamed");
    }
    const trimmed = name.trim();
    if (!trimmed) throw new ConvexError("Name cannot be empty");
    if (trimmed.length > 100) throw new ConvexError("Name must be 100 characters or fewer");
    const isAdmin = await isGroupAdmin(ctx, conversationId, me._id as string);
    const policy = (conversation.policies as any) ?? {};
    if (policy.whoCanEditInfo === "everyone" && conversation.kind === "chat") {
      const member = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
        .unique();
      if (!member) throw new ConvexError("You are not a member of this conversation");
    } else if (!isAdmin) {
      throw new ConvexError("Only the group creator or a group admin can rename");
    }
    const oldName = conversation.name;
    await ctx.db.patch(conversationId, { name: trimmed });
    await ctx.db.insert("messages", {
      conversationId,
      senderId: me._id,
      kind: "system",
      body: `${me.name ?? "Someone"} renamed the ${conversation.kind === "channel" ? "channel" : "group"} from \"${oldName}\" to \"${trimmed}\"`,
      createdAt: Date.now(),
    });
    await logAudit(ctx, me._id, "conversation.renamed", "conversations", String(conversationId), `${oldName} -> ${trimmed}`);
  },
});

export const markRead = mutation({  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }
  },
});

/** Archive a conversation (hidden from list but not deleted). */
export const archiveConversation = mutation({
  args: { conversationId: v.id("conversations"), archived: v.boolean() },
  handler: async (ctx, { conversationId, archived }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    if (!membership) throw new ConvexError("Not a member");
    await ctx.db.patch(membership._id, { isArchived: archived });
  },
});

/** Pin a conversation to the top of the list. */
export const togglePin = mutation({
  args: { conversationId: v.id("conversations"), pinned: v.boolean() },
  handler: async (ctx, { conversationId, pinned }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    if (!membership) throw new ConvexError("Not a member");
    await ctx.db.patch(membership._id, { isPinned: pinned });
  },
});

export const setMuted = mutation({
  args: { conversationId: v.id("conversations"), muted: v.boolean() },
  handler: async (ctx, { conversationId, muted }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", conversationId))
      .unique();
    if (membership) await ctx.db.patch(membership._id, { isMuted: muted });
  },
});

// ---- Typing -----------------------------------------------------------------

export const setTyping = mutation({
  args: { conversationId: v.id("conversations"), isTyping: v.boolean() },
  handler: async (ctx, { conversationId, isTyping }) => {
    const me = await getCurrentUser(ctx);
    if (!me) return;
    const now = Date.now();
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .filter((q) => q.eq(q.field("userId"), me._id))
      .unique();
    if (isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { expiresAt: now + 4000 });
      } else {
        await ctx.db.insert("typing", { conversationId, userId: me._id, expiresAt: now + 4000 });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
    // purge expired rows for this conversation
    const expired = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .filter((q) => q.lt(q.field("expiresAt"), now - 5000))
      .take(10);
    for (const t of expired) await ctx.db.delete(t._id);
  },
});

export const typingIn = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();
    const users = await Promise.all(
      rows.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return u ? { ...u, expiresAt: r.expiresAt } : null;
      }),
    );
    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
