import { Injectable, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { users, organizations, messages, meetings, files, tickets, auditLogs, notifications } from "../db/schema";

@Injectable()
export class AdminService {
  constructor(@Inject(DB) private db: any) {}

  async getStats() {
    const [userCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM users`);
    const [orgCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM organizations`);
    const [msgCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM messages`);
    const [meetCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM meetings`);
    const [fileCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM files`);
    const [ticketCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM tickets`);
    const [auditCount] = await this.db.execute(sql`SELECT count(*)::int as count FROM audit_logs`);

    const [activeUsers] = await this.db.execute(sql`SELECT count(*)::int as count FROM users WHERE is_active = true`);

    const recentAudit = await this.db.execute(sql`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20`);

    return {
      users: userCount?.count || 0,
      organizations: orgCount?.count || 0,
      messages: msgCount?.count || 0,
      meetings: meetCount?.count || 0,
      files: fileCount?.count || 0,
      tickets: ticketCount?.count || 0,
      auditLogs: auditCount?.count || 0,
      activeUsers: activeUsers?.count || 0,
      recentAudit: recentAudit.rows || [],
    };
  }

  async listUsers(limit = 100, offset = 0, search?: string) {
    if (search) {
      return this.db.execute(sql`SELECT * FROM users WHERE name ILIKE ${`%${search}%`} OR email ILIKE ${`%${search}%`} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    }
    return this.db.execute(sql`SELECT * FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
  }

  async listOrgs() {
    return this.db.execute(sql`SELECT o.*, (SELECT count(*)::int FROM organization_members om WHERE om.org_id = o.id) as member_count FROM organizations o ORDER BY o.created_at DESC`);
  }
}
