import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, or, ilike, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { users, presence, organizations, organizationMembers } from "../db/schema";

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private db: any) {}

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async findByEmail(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  async search(query: string, limit = 50) {
    return this.db.select().from(users)
      .where(or(ilike(users.name, `%${query}%`), ilike(users.email, `%${query}%`)))
      .limit(limit);
  }

  async list(limit = 100, offset = 0) {
    return this.db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }

  async update(id: string, data: any) {
    const [updated] = await this.db.update(users).set({ ...data, updatedAt: Date.now() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getPresence(userId: string) {
    const [p] = await this.db.select().from(presence).where(eq(presence.userId, userId)).limit(1);
    return p || { status: "offline", customStatus: null, updatedAt: 0 };
  }

  async setPresence(userId: string, status: string, customStatus?: string) {
    await this.db.insert(presence).values({ userId, status: status as any, customStatus, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: presence.userId, set: { status: status as any, customStatus, updatedAt: Date.now() } });
  }

  async getOrganizations(userId: string) {
    return this.db.select({
      orgId: organizationMembers.orgId,
      role: organizationMembers.role,
      org: organizations,
    }).from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
      .where(eq(organizationMembers.userId, userId));
  }

  async count() {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return result?.count || 0;
  }
}
