import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { sql, eq } from "drizzle-orm";
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

  // ── User management ─────────────────────────────────────────────────
  async setUserRole(userId: string, role: string) {
    const [updated] = await this.db.update(users).set({ role: role as any, updatedAt: Date.now() })
      .where(eq(users.id, userId)).returning();
    if (!updated) throw new NotFoundException("User not found");
    await this.db.execute(sql`INSERT INTO audit_logs (actor_id, action, target_type, target_id, details, created_at)
      VALUES (${userId}, 'admin.set_role', 'user', ${userId}, ${JSON.stringify({ role })}, ${Date.now()})`);
    return updated;
  }

  async setUserActive(userId: string, isActive: boolean) {
    const [updated] = await this.db.update(users).set({ isActive, updatedAt: Date.now() })
      .where(eq(users.id, userId)).returning();
    if (!updated) throw new NotFoundException("User not found");
    return updated;
  }

  async setUserOrg(userId: string, orgId: string, role = "member") {
    const now = Date.now();
    const existing = await this.db.execute(sql`SELECT 1 FROM organization_members WHERE org_id = ${orgId} AND user_id = ${userId} LIMIT 1`);
    if (existing.rows?.length) {
      await this.db.execute(sql`UPDATE organization_members SET role = ${role} WHERE org_id = ${orgId} AND user_id = ${userId}`);
    } else {
      await this.db.execute(sql`INSERT INTO organization_members (org_id, user_id, role, joined_at) VALUES (${orgId}, ${userId}, ${role}, ${now})`);
    }
    return { ok: true };
  }

  async setUserPermission(userId: string, permission: string, granted: boolean) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException("User not found");
    const perms: string[] = user.approvedPermissions || [];
    if (granted && !perms.includes(permission)) perms.push(permission);
    if (!granted) { const i = perms.indexOf(permission); if (i >= 0) perms.splice(i, 1); }
    const [updated] = await this.db.update(users).set({ approvedPermissions: perms, updatedAt: Date.now() })
      .where(eq(users.id, userId)).returning();
    return updated;
  }

  async adminUpdateUserField(userId: string, data: any) {
    const allowed = new Set(["name", "email", "phone", "department", "designation", "company", "employeeId", "role", "isActive"]);
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const k of Object.keys(data || {})) if (allowed.has(k)) patch[k] = data[k];
    const [updated] = await this.db.update(users).set(patch).where(eq(users.id, userId)).returning();
    if (!updated) throw new NotFoundException("User not found");
    return updated;
  }

  /** Assign stable employee ids (DEM/DSU...) where missing. */
  async ensureAllEmployeeIds() {
    const rows = await this.db.execute(sql`SELECT id, employee_id FROM users WHERE employee_id IS NULL OR employee_id = ''`);
    let assigned = 0;
    const prefixes: Record<string, string> = {
      super_admin: "DSU", dejoiy_admin: "DDA", admin: "DAD", super_it: "DSI", it: "DIT",
      president: "DPR", director: "DDI", om: "DOM", tl: "DTL", user: "DEM", member: "DMB",
    };
    for (const row of rows.rows || []) {
      const prefix = prefixes[row.role] || "DEM";
      const employeeId = `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      await this.db.execute(sql`UPDATE users SET employee_id = ${employeeId}, updated_at = ${Date.now()} WHERE id = ${row.id}`);
      assigned++;
    }
    return { assigned };
  }

  async roleHierarchy() {
    return this.db.execute(sql`SELECT "role", count(*)::int as count FROM users GROUP BY "role" ORDER BY count DESC`);
  }

  async deleteOrg(id: string) {
    await this.db.delete(organizations).where(eq(organizations.id, id));
    return { ok: true };
  }

  async breakdown() {
    const [roles] = await this.db.execute(sql`SELECT "role", count(*)::int as count FROM users GROUP BY "role"`);
    const [depts] = await this.db.execute(sql`SELECT department, count(*)::int as count FROM users WHERE department IS NOT NULL AND department != '' GROUP BY department ORDER BY count DESC`);
    const [active] = await this.db.execute(sql`SELECT count(*)::int as count FROM users WHERE is_active = true`);
    const [total] = await this.db.execute(sql`SELECT count(*)::int as count FROM users`);
    return {
      byRole: roles.rows || [],
      byDepartment: depts.rows || [],
      active: active?.count || 0,
      total: total?.count || 0,
    };
  }
}
