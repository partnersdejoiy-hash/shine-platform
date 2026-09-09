import { Injectable, Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { eq, and, or, desc, sql, ilike } from "drizzle-orm";
import { DB } from "../db/database.module";
import { messages, reactions, pinnedMessages, bookmarks, conversationMembers, conversations } from "../db/schema";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DB) private db: any,
    private events: EventEmitter2,
  ) {}

  async send(userId: string, data: { conversationId: string; body: string; kind?: string; parentId?: string; mentions?: string[]; attachments?: any[]; poll?: any }) {
    const now = Date.now();
    const [msg] = await this.db.insert(messages).values({
      conversationId: data.conversationId, senderId: userId, body: data.body,
      kind: (data.kind as any) || "text", parentId: data.parentId,
      mentions: data.mentions || [], attachments: data.attachments || [], poll: data.poll,
      createdAt: now,
    }).returning();

    await this.db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, data.conversationId));

    this.events.emit("message:new", { message: msg, conversationId: data.conversationId });
    return msg;
  }

  async list(conversationId: string, limit = 50, before?: number) {
    let query = sql`SELECT m.*, u.name as sender_name, u.image as sender_image
      FROM messages m LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ${conversationId} AND (m.hidden_for IS NULL OR m.hidden_for = '[]'::jsonb)
      AND m.deleted = false`;
    if (before) query = sql`${query} AND m.created_at < ${before}`;
    query = sql`${query} ORDER BY m.created_at DESC LIMIT ${limit}`;
    const result = await this.db.execute(query);
    return result.rows?.reverse() || [];
  }

  async getThread(parentId: string, limit = 50) {
    return this.db.execute(sql`
      SELECT m.*, u.name as sender_name, u.image as sender_image
      FROM messages m LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.parent_id = ${parentId} AND m.deleted = false
      ORDER BY m.created_at asc LIMIT ${limit}
    `);
  }

  async edit(messageId: string, userId: string, body: string) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");
    if (msg.senderId !== userId) throw new ForbiddenException("Cannot edit others messages");

    const [updated] = await this.db.update(messages)
      .set({ body, edited: true, updatedAt: Date.now() })
      .where(eq(messages.id, messageId)).returning();
    this.events.emit("message:updated", { message: updated });
    return updated;
  }

  async delete(messageId: string, userId: string) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");

    await this.db.update(messages).set({ deleted: true }).where(eq(messages.id, messageId));
    this.events.emit("message:deleted", { messageId, conversationId: msg.conversationId });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const now = Date.now();
    await this.db.insert(reactions).values({ messageId, userId, emoji, createdAt: now })
      .onConflictDoNothing();
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    this.events.emit("message:reaction", {
      messageId, userId, emoji, conversationId: msg?.conversationId,
    });
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    await this.db.delete(reactions).where(
      and(eq(reactions.messageId, messageId), eq(reactions.userId, userId), eq(reactions.emoji, emoji))
    );
  }

  async getReactions(messageId: string) {
    return this.db.select().from(reactions).where(eq(reactions.messageId, messageId));
  }

  async pin(messageId: string, userId: string, conversationId: string) {
    const now = Date.now();
    return this.db.insert(pinnedMessages).values({ conversationId, messageId, pinnedBy: userId, createdAt: now }).returning();
  }

  async unpin(messageId: string, conversationId: string) {
    await this.db.delete(pinnedMessages).where(
      and(eq(pinnedMessages.messageId, messageId), eq(pinnedMessages.conversationId, conversationId))
    );
    return { ok: true };
  }

  /** Soft-delete for the current user only (hidden_for[]). */
  async deleteForMe(messageId: string, userId: string) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");
    const hidden = (msg.hiddenFor as string[]) || [];
    if (!hidden.includes(userId)) hidden.push(userId);
    await this.db.update(messages).set({ hiddenFor: hidden }).where(eq(messages.id, messageId));
    return { ok: true };
  }

  async toggleBookmark(messageId: string, userId: string) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");
    const [existing] = await this.db.select().from(bookmarks)
      .where(and(eq(bookmarks.messageId, messageId), eq(bookmarks.userId, userId)))
      .limit(1);
    if (existing) {
      await this.db.delete(bookmarks).where(and(eq(bookmarks.messageId, messageId), eq(bookmarks.userId, userId)));
      return { bookmarked: false };
    }
    await this.db.insert(bookmarks).values({ messageId, userId, conversationId: msg.conversationId, createdAt: Date.now() });
    return { bookmarked: true };
  }

  async myBookmarks(userId: string) {
    return this.db.execute(sql`
      SELECT m.*, u.name as sender_name, u.image as sender_image, c.name as conv_name
      FROM bookmarks b
      INNER JOIN messages m ON b.message_id = m.id
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE b.user_id = ${userId} AND m.deleted = false
      ORDER BY b.created_at DESC LIMIT 200
    `);
  }

  async search(query: string, userId: string, conversationId?: string) {
    let q = sql`SELECT m.*, u.name as sender_name, c.name as conv_name
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN conversations c ON m.conversation_id = c.id
      INNER JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ${userId}
      WHERE m.body ILIKE ${`%${query}%`} AND m.deleted = false`;
    if (conversationId) q = sql`${q} AND m.conversation_id = ${conversationId}`;
    q = sql`${q} ORDER BY m.created_at DESC LIMIT 100`;
    return this.db.execute(q);
  }

  async forward(messageId: string, toConversationId: string, userId: string) {
    const [original] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!original) throw new NotFoundException("Message not found");
    return this.send(userId, {
      conversationId: toConversationId, body: original.body, kind: original.kind,
      mentions: original.mentions as string[], attachments: original.attachments as any[],
    });
  }

  // ── Polls ───────────────────────────────────────────────────────────────
  async createPoll(messageId: string, userId: string, poll: { question: string; options: { text: string }[] }) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");
    if (msg.senderId !== userId) throw new ForbiddenException("Only the author can add a poll");
    if (msg.poll) throw new ForbiddenException("Message already has a poll");

    const options = (poll.options || []).map((o, i) => ({
      id: `opt_${i}`,
      text: o.text,
      votes: [],
    }));
    const pollObj = { question: poll.question, options, closed: false };
    const [updated] = await this.db.update(messages).set({ poll: pollObj, updatedAt: Date.now() })
      .where(eq(messages.id, messageId)).returning();
    this.events.emit("message:updated", { message: updated });
    return updated;
  }

  async closePoll(messageId: string, userId: string) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");
    if (msg.senderId !== userId) throw new ForbiddenException("Only the author can close the poll");
    if (!msg.poll) throw new ForbiddenException("Message has no poll");

    const pollObj = { ...msg.poll, closed: true };
    const [updated] = await this.db.update(messages).set({ poll: pollObj, updatedAt: Date.now() })
      .where(eq(messages.id, messageId)).returning();
    this.events.emit("message:updated", { message: updated });
    return updated;
  }

  async votePoll(messageId: string, userId: string, optionId: string) {
    const [msg] = await this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg) throw new NotFoundException("Message not found");
    if (!msg.poll) throw new ForbiddenException("Message has no poll");
    if (msg.poll.closed) throw new ForbiddenException("Poll is closed");

    const options = [...msg.poll.options];
    const opt = options.find((o: any) => o.id === optionId);
    if (!opt) throw new NotFoundException("Poll option not found");
    const votes = opt.votes || [];
    if (votes.includes(userId)) {
      opt.votes = votes.filter((v: string) => v !== userId);
    } else {
      votes.push(userId);
      opt.votes = votes;
    }
    const pollObj = { ...msg.poll, options };
    const [updated] = await this.db.update(messages).set({ poll: pollObj, updatedAt: Date.now() })
      .where(eq(messages.id, messageId)).returning();
    this.events.emit("message:updated", { message: updated });
    return updated;
  }
}
