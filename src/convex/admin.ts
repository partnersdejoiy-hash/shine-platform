import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  ensureEmployeeId,
  getCurrentUser,
  isSuperAdmin,
  isSuperAdminEmail,
  logAudit,
} from "./users";
import { MAIL_MANAGED_MESSAGE, MAIL_MANAGED_ROLES, assertNotMailManaged } from "./lib/adminRoles";

/** Platform hierarchy — higher number = higher rank (final authority: super admin). */
export const ROLE_RANK: Record<string, number> = {
  member: 0,
  user: 1,
  tl: 2,
  om: 3,
  director: 4,
  president: 5,
  it: 6,
  super_it: 7,
  admin: 8,
  dejoiy_admin: 9,
  super_admin: 10,
};

async function isAdmin(ctx: any) {
  const user = await getCurrentUser(ctx);
  if (!user) return false;
  return (
    isSuperAdmin(user) ||
    user.role === "dejoiy_admin" ||
    user.role === "admin" ||
    user.email === "admin@shine.app"
  );
}

export const stats = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    const now = Date.now();

    const [users, orgs, meetings, tasks, files] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("organizations").collect(),
      ctx.db.query("meetings").collect(),
      ctx.db.query("tasks").collect(),
      ctx.db.query("files").collect(),
    ]);

    const messageRows = await ctx.db.query("messages").take(5000);
    const callRows = await ctx.db.query("calls").take(5000);

    const daUsers = await ctx.db
      .query("presence")
      .filter((q) => q.gt(q.field("updatedAt"), now - 24 * 60 * 60 * 1000))
      .collect();
    const mauUsers = users.filter((u: any) => (u.lastSeen ?? 0) > now - 30 * 24 * 60 * 60 * 1000);

    // messages per day, last 14 days
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000;
      days.push({
        date: dayStart.toISOString().slice(0, 10),
        count: messageRows.filter((m: any) => m.createdAt >= dayStart.getTime() && m.createdAt < dayEnd).length,
      });
    }

    const completedCalls = callRows.filter((c: any) => c.status === "ended" || c.status === "active");
    const totalCallSeconds = completedCalls.reduce(
      (sum: number, c: any) => sum + ((c.endedAt ?? now) - c.startedAt) / 1000,
      0,
    );

    return {
      users: users.length,
      activeUsers: users.filter((u: any) => u.isActive !== false).length,
      orgs: orgs.length,
      messages: messageRows.length,
      calls: callRows.length,
      meetings: meetings.length,
      tasks: tasks.length,
      files: files.length,
      storageBytes: files.reduce((sum: number, f: any) => sum + f.size, 0),
      dau: daUsers.length,
      mau: mauUsers.length,
      messagesPerDay: days,
      callSeconds: Math.round(totalCallSeconds),
      totalCallMinutes: Math.round(totalCallSeconds / 60),
    };
  },
});

export const manageUsers = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    const users = await ctx.db.query("users").collect();
    const withPresence = await Promise.all(
      users.map(async (u: any) => {
        const presence = await ctx.db
          .query("presence")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .unique();
        const deviceCount = await ctx.db
          .query("devices")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect()
          .then((r) => r.length);
        return { ...u, presence, deviceCount };
      }),
    );
    return withPresence;
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("dejoiy_admin"),
      v.literal("admin"),
      v.literal("super_it"),
      v.literal("it"),
      v.literal("president"),
      v.literal("director"),
      v.literal("om"),
      v.literal("tl"),
      v.literal("client_admin"),
      v.literal("user"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, { userId, role }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !(isSuperAdmin(actor) || actor.role === "dejoiy_admin" || actor.role === "admin")) {
      throw new ConvexError("Admin only");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    // Admin rights are managed in Dejoiy Mail, in both directions.
    assertNotMailManaged(role);
    if (MAIL_MANAGED_ROLES.has(target.role ?? "")) throw new ConvexError(MAIL_MANAGED_MESSAGE);
    // The permanent super admin can never be demoted.
    if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
      throw new ConvexError("The super admin account cannot be modified");
    }
    // Only the super admin can grant (or take) the super admin role.
    if (role === "super_admin" && !isSuperAdmin(actor)) {
      throw new ConvexError("Only the super admin can grant the super admin role");
    }
    // Hierarchy enforcement: nobody can grant a role equal to or above their
    // own. The super admin (rank 10) may grant everything.
    const actorRank = isSuperAdmin(actor) ? 10 : ROLE_RANK[actor.role ?? "user"] ?? 0;
    const targetRank = ROLE_RANK[role] ?? 0;
    if (actorRank <= targetRank) {
      throw new ConvexError(
        `Hierarchy rule: ${actor.role} cannot assign the ${role} role — it must come from a higher role`,
      );
    }
    await ctx.db.patch(userId, { role });
    // A role change swaps the employee ID prefix (DAD → DIT etc.).
    await ensureEmployeeId(ctx, userId);
    await logAudit(ctx, actor._id, "user.role_changed", "users", String(userId), role);
  },
});

// ---- Permission request workflow -------------------------------------------
// Client Admins (and any restricted user) can request a permission that their
// role doesn't grant by default. Super Admin, Administrator and the IT team
// review and approve/reject requests from the Admin console.

const PERMISSION_APPROVERS = ["super_admin", "dejoiy_admin", "admin", "super_it", "it"];

async function canReviewPermissionRequests(user: any): Promise<boolean> {
  if (!user) return false;
  return (
    isSuperAdmin(user) ||
    user.role === "dejoiy_admin" ||
    user.role === "admin" ||
    user.role === "super_it" ||
    user.role === "it"
  );
}

/** Any signed-in user can request a permission they don't have. */
export const requestPermission = mutation({
  args: {
    permission: v.string(),
    reason: v.optional(v.string()),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, { permission, reason, durationDays }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const permissionName = permission.trim();
    if (!permissionName) throw new ConvexError("Permission is required");
    if (permissionName.length > 64) throw new ConvexError("Permission name is too long");

    const pending = await ctx.db
      .query("permissionRequests")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    if (pending.length >= 5) {
      throw new ConvexError("You already have 5 pending requests — wait for them to be reviewed");
    }
    const dup = pending.find((p) => p.permission.toLowerCase() === permissionName.toLowerCase());
    if (dup) throw new ConvexError("You already have a pending request for this permission");

    const now = Date.now();
    await ctx.db.insert("permissionRequests", {
      userId: me._id,
      permission: permissionName,
      reason: reason?.trim() || undefined,
      status: "pending",
      expiresAt: durationDays && durationDays > 0 ? now + durationDays * 24 * 60 * 60 * 1000 : undefined,
      createdAt: now,
    });
    await logAudit(ctx, me._id, "permission.requested", "permissionRequests", permissionName, reason?.trim());
  },
});

/** The current user's own permission requests. */
export const myPermissionRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("permissionRequests")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(50);
    return Promise.all(
      rows.map(async (r) => {
        const reviewer = r.reviewedBy ? await ctx.db.get(r.reviewedBy) : null;
        return { ...r, reviewer };
      }),
    );
  },
});

/** All permission requests (pending first) for Super Admin / Admin / IT. */
export const allPermissionRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me || !(await canReviewPermissionRequests(me))) throw new ConvexError("Admin, IT or Super Admin only");
    const rows = await ctx.db.query("permissionRequests").order("desc").take(200);
    return Promise.all(
      rows.map(async (r) => {
        const requester = await ctx.db.get(r.userId);
        const reviewer = r.reviewedBy ? await ctx.db.get(r.reviewedBy) : null;
        return { ...r, requester, reviewer };
      }),
    );
  },
});

/** Approve or reject a permission request. Super Admin / Admin / IT only. */
export const reviewPermissionRequest = mutation({
  args: {
    requestId: v.id("permissionRequests"),
    approve: v.boolean(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, approve, comment }) => {
    const me = await getCurrentUser(ctx);
    if (!me || !(await canReviewPermissionRequests(me))) throw new ConvexError("Admin, IT or Super Admin only");
    const req = await ctx.db.get(requestId);
    if (!req) throw new ConvexError("Request not found");
    if (req.status !== "pending") throw new ConvexError("Request already reviewed");

    const now = Date.now();
    const detail = `${approve ? "approved" : "rejected"}${comment ? ` — ${comment}` : ""}`;
    if (approve) {
      // Persist an approved-permission record on the user so app code can
      // consult it (e.g. granting "create group chats" or "schedule meetings").
      const user = await ctx.db.get(req.userId);
      const current = (user?.approvedPermissions ?? []) as string[];
      const next = current.includes(req.permission) ? current : [...current, req.permission];
      await ctx.db.patch(req.userId, { approvedPermissions: next });
    }
    await ctx.db.patch(requestId, {
      status: approve ? "approved" : "rejected",
      reviewedBy: me._id,
      reviewedAt: now,
    });
    await logAudit(ctx, me._id, "permission.reviewed", "permissionRequests", String(requestId), detail);
  },
});

/**
 * Grant or revoke a specific permission for an individual user (per-user
 * overrides on top of the role matrix). Super Admin / Administrator only.
 * These grants are enforced server-side by `userHasPermission` and
 * `roleHasPermission(..., approvedPermissions)` everywhere in the app.
 */
export const setUserPermission = mutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    grant: v.boolean(),
  },
  handler: async (ctx, { userId, permission, grant }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !(isSuperAdmin(actor) || actor.role === "admin")) {
      throw new ConvexError("Admin only");
    }
    const permissionName = permission.trim();
    if (!permissionName) throw new ConvexError("Permission is required");
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
      throw new ConvexError("The super admin account cannot be modified");
    }

    const current = (target.approvedPermissions ?? []) as string[];
    const next = grant
      ? current.includes(permissionName)
        ? current
        : [...current, permissionName]
      : current.filter((p) => p !== permissionName);
    await ctx.db.patch(userId, { approvedPermissions: next });
    await logAudit(
      ctx,
      actor._id,
      grant ? "permission.granted" : "permission.revoked",
      "users",
      String(userId),
      `${permissionName}${grant ? " (granted)" : " (revoked)"}`,
    );
    return next;
  },
});

export const toggleUserActive = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !(isSuperAdmin(actor) || actor.role === "admin")) throw new ConvexError("Admin only");
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");
    // The permanent super admin account can never be deactivated.
    if (isSuperAdmin(user) && !isSuperAdmin(actor)) {
      throw new ConvexError("The super admin account cannot be deactivated");
    }
    const next = user.isActive === false;
    await ctx.db.patch(userId, { isActive: next });
    await logAudit(ctx, actor._id, next ? "user.activated" : "user.deactivated", "users", String(userId));
  },
});

/** Every organization (for the admin org-mover dropdown). */
export const allOrgs = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    return await ctx.db.query("organizations").collect();
  },
});

/**
 * Move an existing user into a different organization (or out of all orgs).
 * Super Admin / Administrator only. The user's memberships are replaced with
 * a single membership in the target org and their `company` follows the org.
 */
export const setUserOrg = mutation({
  args: {
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { userId, orgId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !(isSuperAdmin(actor) || actor.role === "admin")) throw new ConvexError("Admin only");
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    // The permanent super admin can never be moved.
    if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
      throw new ConvexError("The super admin account cannot be moved");
    }

    // Replace all current memberships with a single membership in the target org.
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const m of existing) await ctx.db.delete(m._id);

    let orgName: string | undefined;
    if (orgId) {
      const org = await ctx.db.get(orgId);
      if (!org) throw new ConvexError("Organization not found");
      orgName = org.name;
      await ctx.db.insert("organizationMembers", {
        orgId,
        userId,
        role: "member",
        department: target.department,
        designation: target.designation,
        joinedAt: Date.now(),
      });
    }
    await ctx.db.patch(userId, { company: orgName });
    await logAudit(
      ctx,
      actor._id,
      "user.org_changed",
      "users",
      String(userId),
      orgId ? `moved to ${orgId}` : "removed from all organizations",
    );
  },
});

// ---- Super admin · God powers ---------------------------------------------
// Organizations are created and deleted ONLY by the super admin. Deleting an
// organization cascades to its memberships, teams, tasks and meeting links.

/** Create an organization (Super Admin god power). */
export const createOrganization = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    plan: v.optional(v.string()),
    ownerUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, { name, description, plan, ownerUserId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !isSuperAdmin(actor)) throw new ConvexError("Super Admin only");
    const clean = name.trim();
    if (!clean) throw new ConvexError("Organization name is required");
    const now = Date.now();
    const ownerId = ownerUserId ?? actor._id;
    const orgId = await ctx.db.insert("organizations", {
      name: clean,
      slug: clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org",
      description: description?.trim() || undefined,
      ownerId,
      plan: plan?.trim() || "free",
      createdAt: now,
    });
    await ctx.db.insert("organizationMembers", {
      orgId,
      userId: ownerId,
      role: "owner",
      department: "Executive",
      joinedAt: now,
    });
    const owner = await ctx.db.get(ownerId);
    if (owner && !owner.company) {
      await ctx.db.patch(ownerId, { company: clean });
    }
    await logAudit(
      ctx,
      actor._id,
      "organization.created",
      "organizations",
      String(orgId),
      `${clean} (owner: ${owner?.name ?? ownerId})`,
    );
    return orgId;
  },
});

/** Delete an organization and its scoped data (Super Admin god power). */
export const deleteOrganization = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !isSuperAdmin(actor)) throw new ConvexError("Super Admin only");
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError("Organization not found");
    if (org.slug === "dejoiy" || org.name.toLowerCase() === "dejoiy") {
      throw new ConvexError("The DEJOIY home organization can never be deleted");
    }
    const orgName = org.name;

    // memberships → teams → team members → tasks → meetings (unlink) → conversations (unlink)
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const m of members) {
      const user = await ctx.db.get(m.userId);
      if (user && user.company === orgName) {
        await ctx.db.patch(m.userId, { company: undefined });
      }
      await ctx.db.delete(m._id);
    }
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const t of teams) {
      const tm = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", t._id))
        .collect();
      for (const row of tm) await ctx.db.delete(row._id);
      await ctx.db.delete(t._id);
    }
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const c of conversations) {
      await ctx.db.patch(c._id, { orgId: undefined });
    }
    const meetings = await ctx.db
      .query("meetings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const m of meetings) {
      await ctx.db.patch(m._id, { orgId: undefined });
    }

    await ctx.db.delete(orgId);
    await logAudit(
      ctx,
      actor._id,
      "organization.deleted",
      "organizations",
      String(orgId),
      orgName,
    );
  },
});

/**
 * One-time idempotent sweep: assign every user a dedicated employee ID
 * (DSU001, DAD002, DEM017 …) based on their current role. Called from the
 * Admin console; also runs lazily on heartbeat for new accounts.
 */
export const ensureAllEmployeeIds = mutation({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    const users = await ctx.db.query("users").take(2000);
    let assigned = 0;
    for (const u of users) {
      const before = u.employeeId;
      await ensureEmployeeId(ctx, u._id as any);
      const after = (await ctx.db.get(u._id))?.employeeId;
      if (before !== after) assigned++;
    }
    return { assigned };
  },
});

/** Per-role headcounts for the Admin hierarchy panel. */
export const roleHierarchy = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    const users = await ctx.db.query("users").take(2000);
    const counts = new Map<string, number>();
    const samples = new Map<string, string[]>();
    for (const u of users) {
      const role = u.role ?? "user";
      counts.set(role, (counts.get(role) ?? 0) + 1);
      const list = samples.get(role) ?? [];
      if (list.length < 4) {
        list.push(u.name ?? u.email ?? "—");
        samples.set(role, list);
      }
    }
    return {
      counts: Object.fromEntries(counts),
      samples: Object.fromEntries(samples),
      rank: ROLE_RANK,
    };
  },
});

export const auditLogs = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    const rows = await ctx.db.query("auditLogs").order("desc").take(100);
    const items = [];
    for (const row of rows) {
      const actor = await ctx.db.get(row.actorId as any);
      items.push({ ...row, actor });
    }
    return items;
  },
});

/** Round-trip latency probe for the system health card. */
export const ping = query({
  args: {},
  handler: async () => ({ serverTime: Date.now() }),
});

/**
 * Detailed records backing the expandable analytics tiles on the Admin console.
 * Returns the most recent rows for every tracked entity plus who is online now.
 */
export const adminBreakdown = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isAdmin(ctx))) throw new ConvexError("Admin only");
    const now = Date.now();

    const [meetingRows, taskRows, fileRows, orgRows, callRows] = await Promise.all([
      ctx.db.query("meetings").order("desc").take(12),
      ctx.db.query("tasks").order("desc").take(12),
      ctx.db.query("files").order("desc").take(12),
      ctx.db.query("organizations").order("desc").take(12),
      ctx.db.query("calls").order("desc").take(12),
    ]);
    const messageRows = await ctx.db.query("messages").order("desc").take(20);
    const presenceRows = await ctx.db.query("presence").order("desc").take(15);

    const idSet = new Set<string>();
    const collect = (ids: (string | undefined)[]) => {
      for (const id of ids) if (id) idSet.add(id);
    };
    collect(meetingRows.map((m) => m.hostId));
    collect(taskRows.map((t) => [t.assigneeId, t.createdBy]).flat());
    collect(fileRows.map((f) => f.ownerId));
    collect(orgRows.map((o) => o.ownerId));
    collect(callRows.map((c) => [c.initiatorId, c.recipientId]).flat());
    collect(messageRows.map((m) => m.senderId));
    collect(presenceRows.map((p) => p.userId));

    const userDocs = await Promise.all([...idSet].map((id) => ctx.db.get(id as any)));
    const byId = new Map(userDocs.filter((u): u is NonNullable<typeof u> => !!u).map((u: any) => [u._id, u]));
    const name = (id?: string) => {
      if (!id) return "—";
      const u: any = byId.get(id);
      return u ? u.name ?? u.email ?? "Unknown" : "Unknown";
    };

    return {
      meetings: meetingRows.map((m) => ({
        _id: m._id,
        title: m.title,
        code: m.roomCode,
        status: m.status,
        startTime: m.startTime,
        host: name(m.hostId),
      })),
      tasks: taskRows.map((t) => ({
        _id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority ?? "medium",
        assignee: name(t.assigneeId ?? undefined),
        createdAt: t.createdAt,
      })),
      files: fileRows.map((f) => ({
        _id: f._id,
        name: f.name,
        size: f.size,
        kind: f.kind ?? "file",
        createdAt: f.createdAt,
        owner: name(f.ownerId),
      })),
      orgs: orgRows.map((o) => ({
        _id: o._id,
        name: o.name,
        plan: o.plan ?? "free",
        owner: name(o.ownerId),
        createdAt: o.createdAt,
      })),
      calls: callRows.map((c) => ({
        _id: c._id,
        kind: c.kind,
        status: c.status,
        startedAt: c.startedAt,
        durationSec: c.endedAt ? Math.max(0, Math.round((c.endedAt - c.startedAt) / 1000)) : null,
        from: name(c.initiatorId),
        to: name(c.recipientId),
      })),
      messages: messageRows.map((m) => ({
        _id: m._id,
        body: (m.body ?? "").slice(0, 140),
        kind: m.kind,
        createdAt: m.createdAt,
        sender: name(m.senderId),
      })),
      activeNow: presenceRows.map((p) => ({
        userId: p.userId,
        name: name(p.userId),
        status: p.status,
        updatedAt: p.updatedAt,
        online: p.updatedAt > now - 5 * 60 * 1000,
      })),
      mauUsers: (await ctx.db.query("users").collect())
        .filter((u: any) => (u.lastSeen ?? 0) > now - 30 * 24 * 60 * 60 * 1000)
        .sort((a: any, b: any) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
        .slice(0, 15)
        .map((u: any) => ({
          _id: u._id,
          name: u.name ?? u.email ?? "Unknown",
          email: u.email,
          role: u.role,
          lastSeen: u.lastSeen ?? u._creationTime,
        })),
    };
  },
});

// ---- Control Sheet: generic admin field updater ----------------------------
// Allows admins to update specific user profile fields from the spreadsheet.
// Every edit is audit-logged with previous → new value.
const EDITABLE_USER_FIELDS = [
  "name",
  "department",
  "designation",
  "company",
  "location",
  "phone",
  "bio",
  "timezone",
  "employeeId",
  "isActive",
] as const;

export const adminUpdateUserField = mutation({
  args: {
    userId: v.id("users"),
    field: v.string(),
    value: v.union(v.string(), v.boolean(), v.number(), v.null()),
  },
  handler: async (ctx, { userId, field, value }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor || !(isSuperAdmin(actor) || actor.role === "dejoiy_admin" || actor.role === "admin")) {
      throw new ConvexError("Admin only");
    }
    if (!(EDITABLE_USER_FIELDS as readonly string[]).includes(field)) {
      throw new ConvexError(`Field "${field}" is not editable via Control Sheet`);
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
      throw new ConvexError("The super admin account cannot be modified");
    }
    const prev = (target as any)[field];
    if (prev === value) return; // no-op
    await ctx.db.patch(userId, { [field]: value } as any);
    await logAudit(
      ctx,
      actor._id,
      `user.field_updated`,
      "users",
      String(userId),
      `${field}: ${JSON.stringify(prev)} → ${JSON.stringify(value)}`,
    );
    return { ok: true, prev, next: value };
  },
});

// ---- Add user to organization by email (admin / super admin) ---------------

export const addUserToOrg = mutation({
  args: {
    email: v.string(),
    orgId: v.id("organizations"),
    role: v.optional(
      v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    ),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
  },
  handler: async (ctx, { email, orgId, role = "member", department, designation }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new ConvexError("Not authenticated");
    if (!(isSuperAdmin(actor) || actor.role === "dejoiy_admin" || actor.role === "admin")) {
      throw new ConvexError("Admin only");
    }

    // Find user by email
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!target) throw new ConvexError("No SHINE account found for that email");

    // Check if already a member
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), target._id))
      .unique();
    if (existing) throw new ConvexError("That user is already a member of this organization");

    const now = Date.now();
    await ctx.db.insert("organizationMembers", {
      orgId,
      userId: target._id,
      role,
      department,
      designation,
      joinedAt: now,
    });

    // Notify the user
    const org = await ctx.db.get(orgId);
    await ctx.db.insert("notifications", {
      userId: target._id,
      kind: "org_invite",
      title: `You were added to ${org?.name ?? "an organization"}`,
      body: `Added by ${actor.name ?? "an admin"}`,
      link: "/app/organizations",
      read: false,
      createdAt: now,
    });

    await logAudit(
      ctx,
      actor._id,
      "org.member_added_by_admin",
      "organizations",
      String(orgId),
      `${email} added as ${role}`,
      String(orgId),
    );
    return { ok: true };
  },
});
