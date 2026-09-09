import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, lt, gte, desc } from "drizzle-orm";
import { DB } from "../db/database.module";
import { statuses, statusViews } from "../db/schema";

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StatusesService {
  constructor(@Inject(DB) private db: any) {}

  /** Statuses from users I share a conversation with, plus my own. */
  async feed(userId: string) {
    const now = Date.now();
    const rows = await this.db.execute({
      sql: `SELECT s.*, u.name as user_name, u.image as user_image,
              (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) as view_count,
              EXISTS (SELECT 1 FROM status_views sv2 WHERE sv2.status_id = s.id AND sv2.viewer_id = ${userId}) as viewed
           FROM statuses s
           INNER JOIN users u ON s.user_id = u.id
           WHERE s.expires_at > ${now}
             AND (
               s.user_id = ${userId}
               OR EXISTS (
                 SELECT 1 FROM conversation_members me
                 INNER JOIN conversation_members other ON me.conversation_id = other.conversation_id
                 WHERE me.user_id = ${userId} AND other.user_id = s.user_id AND other.user_id != ${userId}
                 LIMIT 1
               )
             )
           ORDER BY s.created_at DESC
           LIMIT 500`,
    });
    return rows.rows || [];
  }

  async myStatuses(userId: string) {
    const now = Date.now();
    return this.db.select().from(statuses)
      .where(and(eq(statuses.userId, userId), gte(statuses.expiresAt, now)))
      .orderBy(desc(statuses.createdAt));
  }

  async create(userId: string, data: { type?: string; text?: string; mediaUrl?: string; mediaType?: string; background?: string }) {
    const now = Date.now();
    const [status] = await this.db.insert(statuses).values({
      userId,
      type: data.type || "text",
      text: data.text,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      background: data.background,
      expiresAt: now + STATUS_TTL_MS,
      createdAt: now,
    }).returning();
    return status;
  }

  async update(userId: string, id: string, data: any) {
    const [existing] = await this.db.select().from(statuses).where(eq(statuses.id, id)).limit(1);
    if (!existing || existing.userId !== userId) throw new NotFoundException("Status not found");
    const patch: Record<string, any> = { text: data.text, mediaUrl: data.mediaUrl, mediaType: data.mediaType, background: data.background, type: data.type };
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
    return this.db.update(statuses).set(patch).where(eq(statuses.id, id)).returning();
  }

  async remove(userId: string, id: string) {
    const [existing] = await this.db.select().from(statuses).where(eq(statuses.id, id)).limit(1);
    if (!existing || existing.userId !== userId) throw new NotFoundException("Status not found");
    await this.db.delete(statuses).where(eq(statuses.id, id));
    return { ok: true };
  }

  async view(userId: string, statusId: string): Promise<void> {
    await this.db.insert(statusViews).values({
      statusId, viewerId: userId, viewedAt: Date.now(),
    }).onConflictDoNothing();
  }
}