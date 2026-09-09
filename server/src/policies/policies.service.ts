import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, desc, and, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { policies, policyVersions, policyAcknowledgements } from "../db/schema";

@Injectable()
export class PoliciesService {
  constructor(@Inject(DB) private db: any) {}
  async create(userId: string, data: any) {
    const now = Date.now();
    const [p] = await this.db.insert(policies).values({
      orgId: data.orgId, title: data.title, category: data.category,
      status: "draft", mandatory: data.mandatory || false, currentVersion: 1,
      createdBy: userId, createdAt: now, updatedAt: now,
    }).returning();
    await this.db.insert(policyVersions).values({
      policyId: p.id, version: 1, title: data.title, summary: data.summary,
      content: data.content, createdAt: now,
    });
    return p;
  }
  async list(orgId?: string) {
    if (orgId) return this.db.select().from(policies).where(eq(policies.orgId, orgId)).orderBy(desc(policies.createdAt));
    return this.db.select().from(policies).orderBy(desc(policies.createdAt)).limit(200);
  }
  async publish(id: string, userId: string) {
    return this.db.update(policies).set({ status: "published", updatedBy: userId, updatedAt: Date.now() }).where(eq(policies.id, id)).returning();
  }
  async acknowledge(policyId: string, userId: string, ip?: string, ua?: string) {
    const [p] = await this.db.select().from(policies).where(eq(policies.id, policyId)).limit(1);
    return this.db.insert(policyAcknowledgements).values({
      orgId: p.orgId, userId, policyId, version: p.currentVersion, ip, userAgent: ua, createdAt: Date.now(),
    }).returning();
  }
  async pendingAcks(userId: string) {
    return this.db.execute(sql`
      SELECT p.* FROM policies p WHERE p.status = 'published' AND p.mandatory = true
      AND NOT EXISTS (SELECT 1 FROM policy_acknowledgements pa WHERE pa.policy_id = p.id AND pa.user_id = ${userId} AND pa.version = p.current_version)
    `);
  }

  async published() {
    return this.db.select().from(policies).where(eq(policies.status, "published"))
      .orderBy(desc(policies.updatedAt)).limit(200);
  }

  async stats() {
    const [total] = await this.db.execute(sql`SELECT count(*)::int as count FROM policies`);
    const [published] = await this.db.execute(sql`SELECT count(*)::int as count FROM policies WHERE status = 'published'`);
    const [ackCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM policy_acknowledgements`);
    return {
      total: total?.count || 0,
      published: published?.count || 0,
      acknowledgements: ackCount?.count || 0,
    };
  }

  async seedDefaults(userId: string) {
    const seeded = await this.db.select().from(policies).limit(1);
    if (seeded.length > 0) return { seeded: false };
    const defaults = [
      { orgId: undefined, title: "Acceptable Use Policy", category: "security", mandatory: true, summary: "Defines acceptable use of SHINE systems and data.", content: "...", status: "published" as const },
      { orgId: undefined, title: "Data Protection & Privacy", category: "privacy", mandatory: true, summary: "How personal data is handled across SHINE.", content: "...", status: "published" as const },
    ];
    for (const d of defaults) {
      const now = Date.now();
      const [p] = await this.db.insert(policies).values({
        title: d.title, category: d.category, status: d.status, mandatory: d.mandatory,
        currentVersion: 1, createdBy: userId, createdAt: now, updatedAt: now,
      }).returning();
      await this.db.insert(policyVersions).values({
        policyId: p.id, version: 1, title: d.title, summary: d.summary, content: d.content, createdAt: now,
      });
    }
    return { seeded: true };
  }
}
