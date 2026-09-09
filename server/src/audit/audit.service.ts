import { Injectable, Inject } from "@nestjs/common";
import { eq, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { auditLogs } from "../db/schema";

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private db: any) {}
  async log(data: { orgId?: string; actorId: string; action: string; targetType?: string; targetId?: string; details?: string; ip?: string; device?: string }) {
    return this.db.insert(auditLogs).values({ ...data, createdAt: Date.now() }).returning();
  }
  async list(orgId?: string, limit = 200) {
    if (orgId) return this.db.select().from(auditLogs).where(eq(auditLogs.orgId, orgId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
    return this.db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }
}
