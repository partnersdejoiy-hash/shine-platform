import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { organizations, organizationMembers, teams, teamMembers } from "../db/schema";

@Injectable()
export class OrgsService {
  constructor(@Inject(DB) private db: any) {}

  async create(data: { name: string; description?: string; ownerId: string; slug?: string }) {
    const now = Date.now();
    const [org] = await this.db.insert(organizations).values({
      name: data.name, description: data.description, ownerId: data.ownerId, slug: data.slug, createdAt: now,
    }).returning();
    await this.db.insert(organizationMembers).values({
      orgId: org.id, userId: data.ownerId, role: "owner", joinedAt: now,
    });
    return org;
  }

  async findById(id: string) {
    const [org] = await this.db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async list() {
    return this.db.select().from(organizations).orderBy(sql`${organizations.name} asc`);
  }

  async getMembers(orgId: string) {
    return this.db.select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      department: organizationMembers.department,
      designation: organizationMembers.designation,
      joinedAt: organizationMembers.joinedAt,
      user: { id: sql`users.id`, name: sql`users.name`, email: sql`users.email`, image: sql`users.image`, role: sql`users.role` },
    }).from(organizationMembers)
      .innerJoin(sql`users`, eq(organizationMembers.userId, sql`users.id`))
      .where(eq(organizationMembers.orgId, orgId));
  }

  async addMember(orgId: string, userId: string, role = "member") {
    const now = Date.now();
    return this.db.insert(organizationMembers).values({ orgId, userId, role: role as any, joinedAt: now })
      .onConflictDoNothing();
  }

  async removeMember(orgId: string, userId: string) {
    return this.db.delete(organizationMembers).where(eq(organizationMembers.orgId, orgId) as any);
  }

  async getUserOrgs(userId: string) {
    return this.db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
  }

  async count() {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    return result?.count || 0;
  }
}
