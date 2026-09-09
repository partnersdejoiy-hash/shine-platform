import { Injectable, Inject } from "@nestjs/common";
import { eq, and, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { notifications } from "../db/schema";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private db: any, private events: EventEmitter2) {}

  async create(userId: string, data: { kind: string; title: string; body?: string; conversationId?: string; link?: string }) {
    const [n] = await this.db.insert(notifications).values({
      userId, ...data, conversationId: data.conversationId, read: false, createdAt: Date.now(),
    }).returning();
    this.events.emit("notification:new", n);
    return n;
  }

  async list(userId: string, limit = 50) {
    return this.db.select().from(notifications).where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt)).limit(limit);
  }

  async unreadCount(userId: string) {
    const [r] = await this.db.execute(sql`SELECT count(*)::int as count FROM notifications WHERE user_id = ${userId} AND read = false`);
    return r?.count || 0;
  }

  async markRead(notificationId: string, userId: string) {
    await this.db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllRead(userId: string) {
    await this.db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }
}
