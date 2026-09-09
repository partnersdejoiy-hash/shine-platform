import { Injectable, Inject } from "@nestjs/common";
import { eq, and, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { contacts } from "../db/schema";

@Injectable()
export class ContactsService {
  constructor(@Inject(DB) private db: any) {}
  async add(userId: string, contactId: string, isFavorite = false) {
    return this.db.insert(contacts).values({ userId, contactId, isFavorite, createdAt: Date.now() }).onConflictDoNothing().returning();
  }
  async list(userId: string) {
    return this.db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.createdAt));
  }
  async toggleFavorite(userId: string, contactId: string) {
    const [c] = await this.db.select().from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.contactId, contactId))).limit(1);
    if (c) await this.db.update(contacts).set({ isFavorite: !c.isFavorite }).where(eq(contacts.id, c.id));
    return { ok: true };
  }
  async block(userId: string, contactId: string) {
    const [c] = await this.db.select().from(contacts).where(and(eq(contacts.userId, userId), eq(contacts.contactId, contactId))).limit(1);
    if (c) await this.db.update(contacts).set({ isBlocked: true }).where(eq(contacts.id, c.id));
    return { ok: true };
  }
  async remove(userId: string, contactId: string) {
    return this.db.delete(contacts).where(and(eq(contacts.userId, userId), eq(contacts.contactId, contactId)));
  }

  async suggested(userId: string) {
    return this.db.execute(sql`
      SELECT u.id, u.name, u.email, u.image, u.department, u.designation
      FROM users u
      WHERE u.id != ${userId}
        AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = ${userId} AND c.contact_id = u.id)
        AND u.is_active = true
      ORDER BY u.name ASC LIMIT 50
    `);
  }
}
