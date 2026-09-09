import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and, sql, ilike, or } from "drizzle-orm";
import { DB } from "../db/database.module";
import { organizations, organizationMembers, teams, teamMembers, users } from "../db/schema";

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

  async update(id: string, data: any) {
    const patch: Record<string, any> = {};
    for (const k of ["name", "description", "slug", "logo", "plan"]) if (data?.[k] !== undefined) patch[k] = data[k];
    if (Object.keys(patch).length === 0) return this.findById(id);
    const [org] = await this.db.update(organizations).set(patch).where(eq(organizations.id, id)).returning();
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

  async setMemberRole(orgId: string, userId: string, role: string) {
    return this.db.update(organizationMembers)
      .set({ role: role as any })
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
  }

  async removeMember(orgId: string, userId: string) {
    return this.db.delete(organizationMembers)
      .where(and(eq(organizationMembers.orgId, orgId), eq(organizationMembers.userId, userId)));
  }

  async getUserOrgs(userId: string) {
    return this.db.select({
      orgId: organizationMembers.orgId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      org: organizations,
    }).from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
      .where(eq(organizationMembers.userId, userId));
  }

  async deleteOrg(id: string) {
    await this.db.delete(organizations).where(eq(organizations.id, id));
    return { ok: true };
  }

  async autoJoinByEmailDomain(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.email || !user.email.includes("@")) return { joined: 0 };
    const domain = user.email.split("@")[1].toLowerCase();
    const matches = await this.db.select().from(organizations)
      .where(or(eq(organizations.slug, domain), ilike(organizations.slug, `%${domain}%`)))
      .limit(10);
    let joined = 0;
    for (const org of matches) {
      const [existing] = await this.db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.orgId, org.id), eq(organizationMembers.userId, userId)))
        .limit(1);
      if (!existing) {
        await this.db.insert(organizationMembers).values({ orgId: org.id, userId, role: "member", joinedAt: Date.now() });
        joined++;
      }
    }
    return { joined };
  }

  // ── Teams ───────────────────────────────────────────────────────────
  async createTeam(orgId: string, data: { name: string; description?: string; memberIds?: string[] }, createdBy: string) {
    const now = Date.now();
    const [team] = await this.db.insert(teams).values({
      orgId, name: data.name, description: data.description, createdBy, createdAt: now,
    }).returning();
    const members = [
      { teamId: team.id, userId: createdBy, role: "lead" as const, joinedAt: now },
      ...(data.memberIds || []).filter((id) => id !== createdBy).map((id) => ({
        teamId: team.id, userId: id, role: "member" as const, joinedAt: now,
      })),
    ];
    await this.db.insert(teamMembers).values(members);
    return team;
  }

  async teamDetail(orgId: string, teamId: string) {
    const [team] = await this.db.select().from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
      .limit(1);
    if (!team) throw new NotFoundException("Team not found");
    const members = await this.db.select({
      userId: teamMembers.userId, role: teamMembers.role, joinedAt: teamMembers.joinedAt,
      user: { name: sql`users.name`, email: sql`users.email`, image: sql`users.image` },
    }).from(teamMembers)
      .innerJoin(sql`users`, eq(teamMembers.userId, sql`users.id`))
      .where(eq(teamMembers.teamId, teamId));
    return { ...team, members };
  }

  async addTeamMember(orgId: string, teamId: string, userId: string, role = "member") {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team || team.orgId !== orgId) throw new NotFoundException("Team not found");
    return this.db.insert(teamMembers).values({ teamId, userId, role: role as any, joinedAt: Date.now() }).onConflictDoNothing();
  }

  async removeTeamMember(orgId: string, teamId: string, userId: string) {
    await this.db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    return { ok: true };
  }

  async count() {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    return result?.count || 0;
  }
}
