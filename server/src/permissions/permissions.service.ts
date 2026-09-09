import { Injectable, Inject } from "@nestjs/common";
import { eq, desc, and } from "drizzle-orm";
import { DB } from "../db/database.module";
import { rolePermissions, permissionRequests, users } from "../db/schema";

@Injectable()
export class PermissionsService {
  constructor(@Inject(DB) private db: any) {}
  async getRolePermissions(role: string) {
    const [r] = await this.db.select().from(rolePermissions).where(eq(rolePermissions.role, role)).limit(1);
    return r?.permissions || {};
  }
  async getMyPermissionMap(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { permissions: {} };
    const permissions: Record<string, any> = {};
    const role = user.role || "user";
    const [roleMap] = await this.db.select().from(rolePermissions).where(eq(rolePermissions.role, role)).limit(1);
    if (roleMap?.permissions) Object.assign(permissions, roleMap.permissions);
    const approved = await this.db.select().from(permissionRequests)
      .where(and(eq(permissionRequests.userId, userId), eq(permissionRequests.status, "approved")))
      .limit(200);
    for (const req of approved) permissions[req.permission] = true;
    return { permissions, role };
  }
  async updateRolePermissions(role: string, permissions: any, updatedBy: string) {
    return this.db.insert(rolePermissions).values({ role, permissions, updatedBy, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: rolePermissions.role, set: { permissions, updatedBy, updatedAt: Date.now() } }).returning();
  }
  async requestPermission(userId: string, permission: string, reason?: string) {
    return this.db.insert(permissionRequests).values({ userId, permission, reason, status: "pending", createdAt: Date.now() }).returning();
  }
  async reviewRequest(id: string, reviewedBy: string, status: string) {
    return this.db.update(permissionRequests).set({ status: status as any, reviewedBy, reviewedAt: Date.now() }).where(eq(permissionRequests.id, id)).returning();
  }
  async listRequests() {
    return this.db.select().from(permissionRequests).orderBy(desc(permissionRequests.createdAt)).limit(200);
  }

  async getPermissionMatrix() {
    const all = await this.db.select().from(rolePermissions);
    const matrix: Record<string, Record<string, string | boolean>> = {};
    for (const rp of all) matrix[rp.role] = rp.permissions || {};
    return matrix;
  }

  async resetRolePermissions(role: string, updatedBy: string) {
    await this.db.delete(rolePermissions).where(eq(rolePermissions.role, role));
    return { ok: true };
  }
}
