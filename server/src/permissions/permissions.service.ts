import { Injectable, Inject } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { DB } from "../db/database.module";
import { rolePermissions, permissionRequests } from "../db/schema";

@Injectable()
export class PermissionsService {
  constructor(@Inject(DB) private db: any) {}
  async getRolePermissions(role: string) {
    const [r] = await this.db.select().from(rolePermissions).where(eq(rolePermissions.role, role)).limit(1);
    return r?.permissions || {};
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
}
