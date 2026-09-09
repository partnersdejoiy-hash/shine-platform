import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, or, ilike, desc, sql } from "drizzle-orm";
import { DB } from "../db/database.module";
import { users, presence, devices, organizations, organizationMembers, passwords } from "../db/schema";
import * as bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const SELF_UPDATABLE = new Set([
  "name", "phone", "image", "bio", "accentColor", "soundPrefs", "customSoundUrl",
  "notificationPrefs", "department", "designation", "company", "location", "timezone",
  "skills", "socialLinks", "availability", "customStatus",
]);

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

  /** Update own profile — only whitelisted fields (never role/email/password). */
  async updateMe(id: string, data: any) {
    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const key of Object.keys(data || {})) {
      // `avatarUrl` is the frontend name for the profile picture URL.
      if (key === "avatarUrl" && data[key] !== undefined && data[key] !== null && data[key] !== "") {
        patch.image = data[key];
        continue;
      }
      if (key === "avatarStorageId" && data[key]) patch.avatarStorageId = data[key];
      if (SELF_UPDATABLE.has(key)) patch[key] = data[key];
    }
    const [updated] = await this.db.update(users).set(patch).where(eq(users.id, id)).returning();
    return updated;
  }

  async getPresence(userId: string) {
    const [p] = await this.db.select().from(presence).where(eq(presence.userId, userId)).limit(1);
    return p || { status: "offline", customStatus: null, updatedAt: 0 };
  }

  async listPresence() {
    return this.db.select().from(presence).orderBy(desc(presence.updatedAt));
  }

  async setPresence(userId: string, status: string, customStatus?: string) {
    await this.db.insert(presence).values({ userId, status: status as any, customStatus, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: presence.userId, set: { status: status as any, customStatus, updatedAt: Date.now() } });
  }

  // ── Devices ──────────────────────────────────────────────────────────
  async listDevices(userId: string) {
    return this.db.select().from(devices).where(eq(devices.userId, userId)).orderBy(desc(devices.lastActiveAt));
  }

  async registerDevice(userId: string, data: { name?: string; platform?: string; isCurrent?: boolean }) {
    const [device] = await this.db.insert(devices).values({
      userId,
      name: data.name || "Unknown device",
      platform: data.platform,
      isTrusted: false,
      isCurrent: !!data.isCurrent,
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
    }).returning();
    return device;
  }

  async setDeviceTrusted(userId: string, deviceId: string, trusted: boolean) {
    const [device] = await this.db.update(devices)
      .set({ isTrusted: trusted, lastActiveAt: Date.now() })
      .where(eq(devices.id, deviceId))
      .returning();
    return device;
  }

  async removeDevice(userId: string, deviceId: string) {
    await this.db.delete(devices).where(eq(devices.id, deviceId));
    return { ok: true };
  }

  // ── Bootstrap helpers (replace the old Convex bootstrap mutations) ────
  /** First user who logs in without a role gets promoted to `admin`. */
  async ensureAdmin(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { ok: false };
    if (!user.role) {
      await this.db.update(users).set({ role: "admin", updatedAt: Date.now() }).where(eq(users.id, userId));
    }
    return { ok: true };
  }

  /** Promote to super_admin on an empty system (first boot). No-op otherwise. */
  async bootstrapSuperAdmin(userId: string) {
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [{ supers }] = await this.db.select({ supers: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "super_admin"));
    if (supers > 0) return { ok: true, promoted: false };
    if (Number(count) > 0) return { ok: true, promoted: false };
    await this.db.update(users).set({ role: "super_admin", updatedAt: Date.now() }).where(eq(users.id, userId));
    return { ok: true, promoted: true };
  }

  /** Ensure the user is a member of the primary ("dejoiy") org. */
  async bootstrapDejoiyMembership(userId: string) {
    let [org] = await this.db.select().from(organizations).where(eq(organizations.slug, "dejoiy")).limit(1);
    if (!org) [org] = await this.db.select().from(organizations).limit(1);
    if (!org) return { ok: true, joined: false };
    const [existing] = await this.db.select()
      .from(organizationMembers)
      .where(eq(organizationMembers.orgId, org.id))
      .limit(1);
    if (existing) return { ok: true, joined: false };
    await this.db.insert(organizationMembers).values({ orgId: org.id, userId, role: "member" }).returning();
    return { ok: true, joined: true };
  }

  /** Auto-join orgs whose slug matches the user's email domain. */
  async autoJoinByEmailDomain(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.email || !user.email.includes("@")) return { joined: 0 };
    const domain = user.email.split("@")[1].toLowerCase();
    const joins = await this.db.select().from(organizations).where(eq(organizations.slug, domain)).limit(10);
    let joined = 0;
    for (const org of joins) {
      const [existing] = await this.db.select()
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, org.id))
        .limit(1);
      if (!existing) {
        await this.db.insert(organizationMembers).values({ orgId: org.id, userId, role: "member" });
        joined++;
      }
    }
    return { joined };
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

  // ── Import / Export / Bulk ───────────────────────────────────────────
  async importUsers(rows: any[]) {
    const now = Date.now();
    let created = 0;
    let skipped = 0;
    for (const row of rows || []) {
      const email = String(row.email || "").toLowerCase().trim();
      if (!email) continue;
      const [existing] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) { skipped++; continue; }
      const tempPass = row.tempPassword || `Temp@${nanoid(6)}`;
      const hash = await bcrypt.hash(tempPass, 12);
      const [user] = await this.db.insert(users).values({
        email,
        name: row.name || email.split("@")[0],
        phone: row.phone,
        department: row.department,
        designation: row.designation,
        company: row.company,
        employeeId: row.employeeId,
        role: "member",
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      }).returning();
      await this.db.insert(passwords).values({ userId: user.id, hash, history: [], updatedAt: now });
      await this.db.insert(presence).values({ userId: user.id, status: "offline", updatedAt: now });
      if (row.orgId || row.organizationId) {
        await this.db.insert(organizationMembers).values({
          orgId: row.orgId || row.organizationId, userId: user.id, role: "member", joinedAt: now,
        });
      }
      created++;
    }
    return { created, skipped };
  }

  async exportUsers() {
    return this.db.execute(sql`SELECT id, name, email, phone, department, designation, company, employee_id, role, is_active, created_at
      FROM users ORDER BY created_at ASC`);
  }

  async bulkUserAction(body: { userIds?: string[]; action: string; value?: any }) {
    const ids = body.userIds || [];
    if (!ids.length) return { ok: false, message: "No users selected" };
    const now = Date.now();
    switch (body.action) {
      case "activate":
        await this.db.update(users).set({ isActive: true, updatedAt: now }).where(sql`id = ANY(${ids})`);
        break;
      case "deactivate":
        await this.db.update(users).set({ isActive: false, updatedAt: now }).where(sql`id = ANY(${ids})`);
        break;
      case "delete": {
        for (const id of ids) await this.db.delete(users).where(eq(users.id, id));
        break;
      }
      case "set-role": {
        const role = body.value?.role;
        if (role) await this.db.update(users).set({ role: role as any, updatedAt: now }).where(sql`id = ANY(${ids})`);
        break;
      }
      default:
        return { ok: false, message: `Unknown action: ${body.action}` };
    }
    return { ok: true, affected: ids.length };
  }
}