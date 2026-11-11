import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getCurrentUser, isSuperAdmin, logAudit, safeStorageUrl } from "./users";
import { userHasPermission } from "./permissions";
import { maybeAskJoi } from "./joi";

const PAGE_SIZE = 50;

type NotifyPrefs = {
  mentions: boolean;
  directMessages: boolean;
  groupMessages: boolean;
  calls: boolean;
  meetings: boolean;
  announcements: boolean;
  sound: boolean;
  desktop: boolean;
};

const DEFAULT_PREFS: NotifyPrefs = {
  mentions: true,
  directMessages: true,
  groupMessages: true,
  calls: true,
  meetings: true,
  announcements: true,
  sound: true,
  desktop: true,
};

export async function notifyMembers(
  ctx: MutationCtx,
  conversation: any,
  senderId: string,
  title: string,
  body: string | undefined,
  link: string,
  kind: string,
  mentionIds: string[] = [],
) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
    .collect();
  const now = Date.now();
  for (const m of members) {
    if (m.userId === senderId) continue;
    if (m.isMuted) continue;
    const user = await ctx.db.get(m.userId);
    const prefs = { ...DEFAULT_PREFS, ...(user?.notificationPrefs ?? {}) } as NotifyPrefs;
    const isMention = mentionIds.includes(m.userId);
    if (isMention && !prefs.mentions) continue;
    if (!isMention) {
      if (conversation.kind === "channel") {
        if (conversation.channelKind === "announcement" && !prefs.announcements) continue;
        if (conversation.channelKind !== "announcement" && !prefs.groupMessages) continue;
      } else if (conversation.chatType === "direct") {
        if (!prefs.directMessages) continue;
      } else {
        if (!prefs.groupMessages) continue;
      }
    }
    await ctx.db.insert("notifications", {
      userId: m.userId,
      kind,
      title,
      body,
      conversationId: conversation._id,
      link,
      read: false,
      createdAt: now,
    });
  }
}

/** Paginated messages for a conversation with senders, reactions and read receipts. */
export const list = query({
  args: {
    conversationId: v.id("conversations"),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, cursor }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { messages: [], nextCursor: null, hasMore: false };

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", userId).eq("conversationId", conversationId))
      .unique();
    if (!membership) return { messages: [], nextCursor: null, hasMore: false };

    const page = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("desc")
      .paginate({ cursor: cursor ?? null, numItems: PAGE_SIZE });

    const memberRows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const readState = new Map(
      memberRows.map((m) => [m.userId, m.lastReadAt ?? 0]),
    );

    const messages = [];
    for (const msg of page.page) {
      if ((msg.hiddenFor ?? []).includes(userId)) continue;
      const sender = await ctx.db.get(msg.senderId);
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", msg._id))
        .collect();
      const replyCount = await ctx.db
        .query("messages")
        .withIndex("by_parent", (q) => q.eq("parentId", msg._id))
        .collect()
        .then((r) => r.length);
      const readBy = Array.from(readState.entries())
        .filter(([, t]) => t >= msg.createdAt)
        .map(([uid]) => uid);
      const isPinned = await ctx.db
        .query("pinnedMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .filter((q) => q.eq(q.field("messageId"), msg._id))
        .unique();
      // live poll: resolve voter names so the creator sees exactly who voted,
      // updated reactively the instant a vote lands
      let poll = msg.poll;
      if (poll) {
        const voterNames = new Map<string, string>();
        for (const o of poll.options ?? []) {
          for (const vid of o.votes ?? []) {
            if (voterNames.has(vid)) continue;
            const v = await ctx.db.get(vid);
            voterNames.set(vid, v?.name ?? v?.email ?? "Unknown");
          }
        }
        poll = {
          ...poll,
          options: (poll.options ?? []).map((o) => ({
            ...o,
            voterNames: (o.votes ?? []).map((vid) => voterNames.get(vid) ?? "Unknown"),
          })),
        };
      }
      messages.push({
        ...msg,
        poll,
        sender: sender ?? null,
        reactions,
        replyCount,
        readBy,
        pinnedBy: isPinned?.pinnedBy ?? null,
      });
    }

    return {
      messages: messages.reverse(),
      nextCursor: page.isDone ? null : page.continueCursor,
      hasMore: !page.isDone,
    };
  },
});

const sendArgs = {
  conversationId: v.id("conversations"),
  body: v.optional(v.string()),
  kind: v.optional(
    v.union(v.literal("text"), v.literal("file"), v.literal("voice"), v.literal("poll"), v.literal("system")),
  ),
  parentId: v.optional(v.id("messages")),
  attachments: v.optional(
    v.array(
      v.object({
        storageId: v.optional(v.string()),
        url: v.optional(v.string()),
        name: v.string(),
        mimeType: v.string(),
        size: v.number(),
        kind: v.optional(v.string()),
      }),
    ),
  ),
  mentions: v.optional(v.array(v.id("users"))),
  poll: v.optional(
    v.object({
      question: v.string(),
      options: v.array(v.object({ id: v.string(), text: v.string(), votes: v.array(v.id("users")) })),
      closed: v.optional(v.boolean()),
    }),
  ),
};

type SendArgs = {
  conversationId: Id<"conversations">;
  body?: string;
  kind?: "text" | "file" | "voice" | "poll" | "system";
  parentId?: Id<"messages">;
  attachments?: {
    storageId?: string;
    url?: string;
    name: string;
    mimeType: string;
    size: number;
    kind?: string;
  }[];
  mentions?: Id<"users">[];
  poll?: {
    question: string;
    options: { id: string; text: string; votes: Id<"users">[] }[];
    closed?: boolean;
  };
};

async function handleSend(ctx: MutationCtx, args: SendArgs) {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", args.conversationId))
      .unique();
    if (!membership) throw new Error("You are not a member of this conversation");

    // WhatsApp-style group policy: when the group restricts sending to admins,
    // only group admins/owners may post. Enforced server-side, never client-side.
    const convPolicy = (conversation as any).policies ?? {};
    const memberRole = (membership as any).role;
    const isGroupAdmin =
      memberRole === "admin" || memberRole === "owner" || (membership as any).isAdmin === true;
    if (
      (conversation as any).chatType === "group" &&
      convPolicy.whoCanSend === "admins" &&
      !isGroupAdmin
    ) {
      throw new Error("Group policy: only group admins can send messages here");
    }

    const kind = args.kind ?? "text";
    const now = Date.now();
    // God commands: "@allS" tags every user of the app, "@all" tags every
    // employee of the sender's organization. Resolved server-side so they work
    // in every chat, channel, task or meeting message.
    // @allS is restricted to higher management (Super Admin / DEJOIY Admin /
    // Admin — or anyone granted the "all_users_mention" permission). Anyone
    // else sees the literal text and NO app-wide expansion.
    let content = (args.body ?? "").trim();
    let mentionIds: Id<"users">[] = [...(args.mentions ?? [])];
    const hasAllS = /@allS\b/i.test(content);
    const hasAll = /@all\b/i.test(content);
    if (hasAllS || hasAll) {
      const canUseAllS = await userHasPermission(ctx, me, "all_users_mention");
      const myMemberships = await ctx.db
        .query("organizationMembers")
        .withIndex("by_user", (q) => q.eq("userId", me._id))
        .collect();
      let targets: Id<"users">[] = [];
      if (hasAllS && canUseAllS) {
        const allUsers = await ctx.db.query("users").collect();
        targets = allUsers.filter((u) => u.isActive !== false).map((u) => u._id);
      } else if (hasAllS && !canUseAllS) {
        // Denied: leave the literal text so the sender sees it did not expand.
        content = content;
      } else if (hasAll && myMemberships.length > 0) {
        const orgIds = new Set(myMemberships.map((m) => m.orgId));
        const allMemberships = await ctx.db.query("organizationMembers").collect();
        targets = allMemberships
          .filter((m) => orgIds.has(m.orgId) && String(m.userId) !== String(me._id))
          .map((m) => m.userId);
      }
      mentionIds = [...new Set([...mentionIds.map(String), ...targets.map(String)])] as Id<"users">[];
      if (canUseAllS) {
        content = content.replace(/@allS\b/gi, "@AllSHINE");
      }
      content = content.replace(/@all\b/gi, "@Everyone");
    }
    // Auto-join anyone who was mentioned but isn't a member yet, so a global /
    // cross-org mention actually reaches them (Slack-style invite-on-mention).
    if (mentionIds.length > 0) {
      const memberRows = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .collect();
      const memberIds = new Set(memberRows.map((m) => m.userId));
      for (const uid of mentionIds) {
        if (String(uid) === String(me._id) || memberIds.has(uid)) continue;
        const target = await ctx.db.get(uid);
        if (target && target.isActive !== false) {
          await ctx.db.insert("conversationMembers", {
            conversationId: args.conversationId,
            userId: uid,
            role: "member",
            joinedAt: now,
          });
          memberIds.add(uid);
        }
      }
    }
    const attachments = args.attachments
      ? await Promise.all(
          args.attachments.map(async (a) => ({
            ...a,
            // Prefer the URL supplied by the client (self-hosted MinIO uploads
            // carry a ready-to-render URL); fall back to Convex storage keys.
            url: (await safeStorageUrl(ctx, a.storageId, a.url)) ?? "",
          })),
        )
      : undefined;
    const msgId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      body: content,
      kind,
      parentId: args.parentId,
      attachments,
      mentions: mentionIds.length > 0 ? mentionIds : undefined,
      poll: args.poll,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, { lastMessageAt: now });

    // link shared files to the conversation
    if (attachments && attachments.length > 0) {
      for (const a of attachments) {
        if (a.storageId) {
          await ctx.db.insert("files", {
            ownerId: me._id,
            conversationId: args.conversationId,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            storageId: a.storageId,
            url: a.url ?? "",
            kind: a.kind,
            createdAt: now,
          });
        }
      }
    }

    // notifications
    const display = me.name ?? me.email ?? "Someone";
    let title = "";
    let body: string | undefined;
    let nkind = "message";
    if (conversation.kind === "channel") {
      title = `#${conversation.name}`;
      body = content || (kind === "file" ? "📎 Shared a file" : kind === "voice" ? "🎤 Voice message" : kind === "poll" ? "📊 New poll" : "");
    } else if (conversation.chatType === "direct") {
      title = display;
      body = content || (kind === "file" ? "📎 Shared a file" : kind === "voice" ? "🎤 Voice message" : "");
    } else {
      title = conversation.name ?? display;
      body = `${display}: ${content || (kind === "file" ? "📎 Shared a file" : "🎤 Voice message")}`;
    }
    await notifyMembers(
      ctx,
      conversation,
      me._id,
      title,
      body,
      `/app/chats/${args.conversationId}`,
      nkind,
      mentionIds,
    );

    // Joi answers in #joi, in DMs with her, and when @mentioned
    await maybeAskJoi(ctx, conversation, me._id, msgId, content, mentionIds);

    return msgId;
}

export const send = mutation({
  args: sendArgs,
  handler: async (ctx, args) => handleSend(ctx, args),
});

/** Send a system message (used by meeting rooms, channels, etc). */
export const sendSystem = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  handler: async (ctx, { conversationId, body }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const id = await ctx.db.insert("messages", {
      conversationId,
      senderId: me._id,
      kind: "system",
      body,
      createdAt: Date.now(),
    });
    await ctx.db.patch(conversationId, { lastMessageAt: Date.now() });
    return id;
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  handler: async (ctx, { messageId, body }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.senderId !== me._id) throw new Error("Cannot edit this message");
    if (!body.trim()) throw new Error("Message cannot be empty");
    await ctx.db.patch(messageId, { body: body.trim(), edited: true, updatedAt: Date.now() });
  },
});

/**
 * Delete for everyone: marks the message as deleted.
 *
 * Enterprise chat protection: only the Super Admin or an Administrator can
 * permanently remove a message for everyone. All other roles can only use
 * deleteForMe (a soft, per-user hide — the message stays on the server and
 * remains auditable/recoverable). Every admin deletion is audit logged.
 */
export const deleteForEveryone = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const isAdminRole = isSuperAdmin(me) || me.role === "admin";
    if (!isAdminRole) {
      throw new Error("Only Super Admins and Administrators can delete messages for everyone");
    }
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    const conversation = await ctx.db.get(msg.conversationId);
    await ctx.db.patch(messageId, { deleted: true, body: "", updatedAt: Date.now() });
    if (conversation) {
      await ctx.db.patch(conversation._id, { lastMessageAt: Date.now() });
    }
    await logAudit(
      ctx,
      me._id,
      "message.deleted_for_everyone",
      "messages",
      String(messageId),
      `sender=${msg.senderId}`,
      conversation?.orgId ? String(conversation.orgId) : undefined,
    );
  },
});

/** Delete for me: hides the message for this user only. */
export const deleteForMe = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    const hiddenFor = msg.hiddenFor ?? [];
    await ctx.db.patch(messageId, { hiddenFor: [...hiddenFor, me._id] });
  },
});

export const react = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .filter((q) => q.and(q.eq(q.field("userId"), me._id), q.eq(q.field("emoji"), emoji)))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("reactions", { messageId, userId: me._id, emoji, createdAt: Date.now() });
    }
  },
});

export const pin = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    const existing = await ctx.db
      .query("pinnedMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", msg.conversationId))
      .filter((q) => q.eq(q.field("messageId"), messageId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(messageId, { pinned: false });
      return false;
    }
    await ctx.db.insert("pinnedMessages", {
      conversationId: msg.conversationId,
      messageId,
      pinnedBy: me._id,
      createdAt: Date.now(),
    });
    await ctx.db.patch(messageId, { pinned: true });
    return true;
  },
});

export const forward = mutation({
  args: { messageId: v.id("messages"), toConversationId: v.id("conversations") },
  handler: async (ctx, { messageId, toConversationId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    const target = await ctx.db.get(toConversationId);
    if (!target) throw new Error("Target conversation not found");
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", me._id).eq("conversationId", toConversationId))
      .unique();
    if (!membership) throw new Error("You are not in the target conversation");
    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId: toConversationId,
      senderId: me._id,
      body: msg.body,
      kind: msg.kind === "poll" ? "text" : msg.kind,
      forwarded: true,
      attachments: msg.attachments,
      createdAt: now,
    });
    await ctx.db.patch(toConversationId, { lastMessageAt: now });
    return toConversationId;
  },
});

export const votePoll = mutation({
  args: { messageId: v.id("messages"), optionId: v.string() },
  handler: async (ctx, { messageId, optionId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg || !msg.poll) throw new Error("Poll not found");
    if (msg.poll.closed) throw new Error("This poll has closed");
    const options = msg.poll.options.map((o) => {
      const votes = o.votes.filter((uid) => uid !== me._id);
      return o.id === optionId ? { ...o, votes: [...votes, me._id] } : { ...o, votes };
    });
    await ctx.db.patch(messageId, {
      poll: { question: msg.poll.question, options, closed: msg.poll.closed },
    });
  },
});

/** Hosts (or the poll author) can close a poll — results become final. */
export const closePoll = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg || !msg.poll) throw new Error("Poll not found");
    const conv = await ctx.db.get(msg.conversationId);
    if (!conv) throw new Error("Conversation not found");
    const isAuthor = msg.senderId === me._id;
    // meeting rooms: host/co-host can close any poll; otherwise the author can
    let isManager = isAuthor;
    if (conv.isMeeting) {
      const title = conv.name.replace(/^(Meeting|Breakout):\s*/, "");
      const meeting = await ctx.db
        .query("meetings")
        .filter((q) => q.eq(q.field("title"), title))
        .first();
      if (meeting) {
        const p = await ctx.db
          .query("meetingParticipants")
          .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
          .filter((q) => q.eq(q.field("userId"), me._id))
          .unique();
        if (p && (p.role === "host" || p.role === "moderator")) isManager = true;
      }
    }
    if (!isManager) throw new Error("Only the host or the poll author can close this poll");
    await ctx.db.patch(messageId, {
      poll: { ...msg.poll, closed: true },
    });
  },
});

export const createPoll = mutation({
  args: {
    conversationId: v.id("conversations"),
    question: v.string(),
    options: v.array(v.string()),
  },
  handler: async (ctx, { conversationId, question, options }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (options.length < 2) throw new Error("A poll needs at least two options");
    return await handleSend(ctx, {
      conversationId,
      body: question,
      kind: "poll",
      poll: {
        question,
        options: options.slice(0, 6).map((text, i) => ({
          id: `opt-${Date.now()}-${i}`,
          text,
          votes: [] as Id<"users">[],
        })),
      },
    });
  },
});

export const toggleBookmark = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const msg = await ctx.db.get(messageId);
    if (!msg) throw new Error("Message not found");
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .filter((q) => q.eq(q.field("messageId"), messageId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("bookmarks", {
      userId: me._id,
      messageId,
      conversationId: msg.conversationId,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const myBookmarks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const items = [];
    for (const b of bookmarks) {
      const msg = await ctx.db.get(b.messageId);
      if (!msg || msg.deleted) continue;
      const sender = await ctx.db.get(msg.senderId);
      const conversation = await ctx.db.get(b.conversationId);
      items.push({ bookmark: b, message: msg, sender, conversation });
    }
    return items;
  },
});

/** Search within a conversation. */
export const searchInConversation = query({
  args: { conversationId: v.id("conversations"), query: v.string() },
  handler: async (ctx, { conversationId, query }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_conv", (q) => q.eq("userId", userId).eq("conversationId", conversationId))
      .unique();
    if (!membership || !query.trim()) return [];
    const hits = await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) => q.search("body", query.trim()))
      .filter((q) => q.eq(q.field("conversationId"), conversationId))
      .take(30);
    const results = [];
    for (const msg of hits) {
      if (msg.deleted) continue;
      const sender = await ctx.db.get(msg.senderId);
      results.push({ ...msg, sender });
    }
    return results;
  },
});

/** Global search across the whole platform. */
export const globalSearch = query({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const q = query.trim();
    if (!q) return null;

    const [allUsers, messageHits, fileHits, meetingHits, conversationHits, orgHits] =
      await Promise.all([
        ctx.db.query("users").take(200),
        ctx.db.query("messages").withSearchIndex("search_body", (idx) => idx.search("body", q)).take(8),
        ctx.db.query("files").withSearchIndex("search_name", (idx) => idx.search("name", q)).take(8),
        ctx.db.query("meetings").withSearchIndex("search_title", (idx) => idx.search("title", q)).take(8),
        ctx.db.query("conversations").withSearchIndex("search_name", (idx) => idx.search("name", q)).take(8),
        ctx.db.query("organizations").withSearchIndex("search_name", (idx) => idx.search("name", q)).take(8),
      ]);
    const userHits = allUsers
      .filter((u: any) => (u.name ?? "").toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);

    // only messages from conversations the user is a member of
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const convIds = new Set(memberships.map((m) => m.conversationId));
    const allowedMessages = [];
    for (const msg of messageHits) {
      if (!convIds.has(msg.conversationId) || msg.deleted) continue;
      const sender = await ctx.db.get(msg.senderId);
      const conversation = await ctx.db.get(msg.conversationId);
      allowedMessages.push({ ...msg, sender, conversation });
    }

    const users = await Promise.all(
      userHits.map(async (u) => ({ ...u, presence: await presenceOf(ctx, u._id) })),
    );
    const meetings = await Promise.all(
      meetingHits.map(async (m) => {
        const host = await ctx.db.get(m.hostId);
        return { ...m, host };
      }),
    );
    const conversations = await Promise.all(
      conversationHits.map(async (c) => {
        const memberRows = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .collect();
        return { ...c, memberCount: memberRows.length, isMember: memberRows.some((m) => m.userId === userId) };
      }),
    );

    return {
      users,
      messages: allowedMessages,
      files: fileHits,
      meetings,
      conversations,
      organizations: orgHits,
    };
  },
});

async function presenceOf(ctx: QueryCtx, userId: Id<"users">) {
  const row = await ctx.db
    .query("presence")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row ?? null;
}
