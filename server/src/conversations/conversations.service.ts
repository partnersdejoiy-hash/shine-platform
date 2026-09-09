import { Injectable, Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { eq, and, or, desc, sql, gt } from "drizzle-orm";
import { DB } from "../db/database.module";
import { conversations, conversationMembers, messages, users } from "../db/schema";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(DB) private db: any,
    private events: EventEmitter2,
  ) {}

  async createDirect(userId: string, otherUserId: string) {
    // Check for existing direct chat
    const existing = await this.db.execute(sql`
      SELECT cm1.conversation_id FROM conversation_members cm1
      INNER JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
      INNER JOIN conversations c ON c.id = cm1.conversation_id
      WHERE cm1.user_id = ${userId} AND cm2.user_id = ${otherUserId}
      AND c.kind = 'chat' AND c.chat_type = 'direct'
      LIMIT 1
    `);
    if (existing.rows?.length > 0) {
      return this.findById(existing.rows[0].conversation_id as string);
    }

    const now = Date.now();
    const [conv] = await this.db.insert(conversations).values({
      kind: "chat", chatType: "direct", name: "Direct Chat", createdBy: userId, createdAt: now,
    }).returning();

    await this.db.insert(conversationMembers).values([
      { conversationId: conv.id, userId, role: "owner", joinedAt: now },
      { conversationId: conv.id, userId: otherUserId, role: "member", joinedAt: now },
    ]);

    return conv;
  }

  async createGroup(userId: string, data: { name: string; memberIds: string[]; orgId?: string; description?: string }) {
    const now = Date.now();
    const [conv] = await this.db.insert(conversations).values({
      kind: "chat", chatType: "group", name: data.name, description: data.description,
      orgId: data.orgId, createdBy: userId, createdAt: now,
    }).returning();

    const members = [
      { conversationId: conv.id, userId, role: "owner" as const, joinedAt: now },
      ...data.memberIds.filter(id => id !== userId).map(id => ({
        conversationId: conv.id, userId: id, role: "member" as const, joinedAt: now,
      })),
    ];
    await this.db.insert(conversationMembers).values(members);
    return conv;
  }

  async createChannel(userId: string, data: { name: string; orgId?: string; channelKind?: string; description?: string }) {
    const now = Date.now();
    const [conv] = await this.db.insert(conversations).values({
      kind: "channel", channelKind: (data.channelKind as any) || "channel",
      name: data.name, description: data.description, orgId: data.orgId,
      createdBy: userId, createdAt: now,
    }).returning();
    await this.db.insert(conversationMembers).values({
      conversationId: conv.id, userId, role: "owner", joinedAt: now,
    });
    return conv;
  }

  async findById(id: string) {
    const [conv] = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conv) throw new NotFoundException("Conversation not found");
    return conv;
  }

  async getUserConversations(userId: string) {
    const rows = await this.db.execute(sql`
      SELECT c.*, cm.role as my_role, cm.last_read_at, cm.is_muted, cm.is_archived, cm.is_pinned,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > COALESCE(cm.last_read_at, 0) AND m.sender_id != ${userId} AND m.deleted = false) as unread_count,
        (SELECT json_build_object('body', m2.body, 'sender_id', m2.sender_id, 'created_at', m2.created_at)
         FROM messages m2 WHERE m2.conversation_id = c.id AND m2.deleted = false ORDER BY m2.created_at DESC LIMIT 1) as last_message
      FROM conversations c
      INNER JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ${userId}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    `);
    return rows.rows;
  }

  async getMembers(conversationId: string) {
    return this.db.execute(sql`
      SELECT cm.*, u.name, u.email, u.image, u.role as global_role, u.is_active
      FROM conversation_members cm
      INNER JOIN users u ON cm.user_id = u.id
      WHERE cm.conversation_id = ${conversationId}
      ORDER BY cm.joined_at asc
    `);
  }

  async joinChannel(conversationId: string, userId: string) {
    const now = Date.now();
    return this.db.insert(conversationMembers).values({
      conversationId, userId, role: "member", joinedAt: now,
    }).onConflictDoNothing();
  }

  async leave(conversationId: string, userId: string) {
    return this.db.delete(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  }

  async markRead(conversationId: string, userId: string) {
    await this.db.update(conversationMembers)
      .set({ lastReadAt: Date.now() })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  }

  async countUnread(userId: string) {
    const result = await this.db.execute(sql`
      SELECT COALESCE(SUM(
        (SELECT COUNT(*) FROM messages m
         WHERE m.conversation_id = c.id AND m.created_at > COALESCE(cm.last_read_at, 0)
         AND m.sender_id != ${userId} AND m.deleted = false)
      ), 0)::int as total
      FROM conversations c
      INNER JOIN conversation_members cm ON c.id = cm.conversation_id
      WHERE cm.user_id = ${userId} AND cm.is_muted = false
    `);
    return result.rows?.[0]?.total || 0;
  }
}
