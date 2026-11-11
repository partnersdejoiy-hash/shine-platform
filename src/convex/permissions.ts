import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isSuperAdmin, logAudit } from "./users";

/**
 * SHINE role permission matrix.
 *
 * SHINE enterprise hierarchy (lowest → highest):
 *   member → user (Employee) → tl → om → director → president → it → super_it
 *   → admin → dejoiy_admin → super_admin
 *
 * Every role has a fixed default matrix (below). Super Admin, DEJOIY Admin,
 * Administrator and IT team can override individual cells from the Admin
 * console → Permissions. Super Admin is always locked to full access.
 *
 * A value is either a boolean (allow/deny) or a scope string:
 *   "limited"    – partial access (e.g. IT can only view/reset, not edit)
 *   "team"       – applies to the user's own team only
 *   "department" – applies to the user's own department only
 */

export const ROLES_ALL = [
  "super_admin",
  "dejoiy_admin",
  "admin",
  "super_it",
  "it",
  "president",
  "director",
  "om",
  "tl",
  "user",
] as const;
export type MatrixRole = (typeof ROLES_ALL)[number];

export type PermValue = boolean | "limited" | "team" | "department";

export interface PermissionDef {
  id: string;
  label: string;
  category: string;
  description: string;
  scoped?: boolean; // when true, value may be a scope string
  defaults: Record<MatrixRole, PermValue>;
}

export const PERMISSIONS: PermissionDef[] = [
  {
    id: "create_organization",
    label: "Create Organization",
    category: "Organization",
    description: "Create new organizations. Super Admin only.",
    defaults: {
      super_admin: true, dejoiy_admin: false, admin: false, super_it: false,
      it: false, president: false, director: false, om: false, tl: false, user: false,
    },
  },
  {
    id: "manage_roles",
    label: "Manage Roles",
    category: "Administration",
    description: "Change roles and assign permissions to employees.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: false,
      it: false, president: false, director: false, om: false, tl: false, user: false,
    },
  },
  {
    id: "all_users_mention",
    label: "@allS — Mention Every User",
    category: "Messaging",
    description:
      "Use the @allS god command to tag every user of the app, every domain. DEJOIY's super admins and IT (a company's own IT and admins only on DEJOIY's domains).",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: false, super_it: true,
      it: false, president: false, director: false, om: false, tl: false, user: false,
    },
  },
  {
    id: "company_announcement",
    label: "Company Announcement",
    category: "Communication",
    description: "Broadcast announcements to the whole company.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: false,
      it: false, president: true, director: false, om: false, tl: false, user: false,
    },
  },
  {
    id: "department_groups",
    label: "Department Groups",
    category: "Groups",
    description: "Create and manage department-level groups.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: false,
      it: false, president: true, director: true, om: false, tl: false, user: false,
    },
  },
  {
    id: "team_groups",
    label: "Team Groups",
    category: "Groups",
    description: "Create and manage team-level groups.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: false,
      it: false, president: true, director: true, om: true, tl: true, user: false,
    },
  },
  {
    id: "private_chat",
    label: "Private Chat",
    category: "Messaging",
    description: "Send and receive one-to-one messages.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: true,
    },
  },
  {
    id: "group_chat",
    label: "Group Chat",
    category: "Messaging",
    description: "Join and send messages in group chats and channels.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: false,
    },
  },
  {
    id: "one_to_one_call",
    label: "One-to-One Call",
    category: "Calling",
    description: "Start audio and video calls with another employee.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: true,
    },
  },
  {
    id: "group_call",
    label: "Group Call",
    category: "Calling",
    description: "Start group audio or video calls.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: false,
    },
  },
  {
    id: "start_meeting",
    label: "Start Meeting",
    category: "Meetings",
    description: "Start or schedule meetings (incl. webinars).",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: false,
    },
  },
  {
    id: "join_meeting",
    label: "Join Meeting",
    category: "Meetings",
    description: "Join meetings and webinars.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: true,
    },
  },
  {
    id: "invite_multiple_users",
    label: "Invite Multiple Users",
    category: "Meetings",
    description: "Invite multiple people to a meeting or group.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: true, president: true, director: true, om: true, tl: true, user: false,
    },
  },
  {
    id: "manage_employees",
    label: "Manage Employees",
    category: "Administration",
    description: "Add, remove or manage employees within the allowed scope.",
    scoped: true,
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: "limited", president: true, director: true, om: "team", tl: "team", user: false,
    },
  },
  {
    id: "view_analytics",
    label: "View Analytics",
    category: "Reports",
    description: "View usage and company analytics within the allowed scope.",
    scoped: true,
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: true, super_it: true,
      it: "limited", president: true, director: "department", om: "team", tl: false, user: false,
    },
  },
  {
    id: "system_settings",
    label: "System Settings",
    category: "Administration",
    description: "Access platform configuration and security settings.",
    scoped: true,
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: "limited", super_it: "limited",
      it: "limited", president: false, director: false, om: false, tl: false, user: false,
    },
  },
  {
    id: "delete_chat",
    label: "Delete Chat",
    category: "Moderation",
    description: "Delete chats and messages for everyone.",
    defaults: {
      super_admin: true, dejoiy_admin: true, admin: false, super_it: false,
      it: false, president: false, director: false, om: false, tl: false, user: false,
    },
  },
];

export const PERMISSION_BY_ID = new Map(PERMISSIONS.map((p) => [p.id, p]));

/** Default matrix as a plain record for a role (no overrides applied). */
export function defaultMatrix(role: string): Record<string, PermValue> {
  const out: Record<string, PermValue> = {};
  for (const p of PERMISSIONS) {
    const val = (p.defaults as Record<string, PermValue>)[role];
    if (val !== undefined) out[p.id] = val;
  }
  return out;
}

/** Whether a role can never be restricted (super admin). */
export function isLockedRole(role?: string | null): boolean {
  return role === "super_admin";
}

/** True when the value grants access (true or any scope string). */
export function permAllowed(value: PermValue | undefined): boolean {
  return value === true || (typeof value === "string" && value.length > 0);
}

/** True when an admin-editable override differs from the system default. */
export function isOverridden(role: string, permId: string, value: PermValue): boolean {
  const def = defaultMatrix(role)[permId];
  return def !== value;
}

/**
 * Fetch the effective permission map for a role from the database (defaults
 * merged with admin overrides). Callers inside a query/mutation pass ctx.
 */
export async function getEffectivePermissions(
  ctx: { db: any },
  role: string | null | undefined,
): Promise<Record<string, PermValue>> {
  const base = defaultMatrix(role ?? "user");
  if (!role) return base;
  const row = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q: any) => q.eq("role", role))
    .unique();
  if (!row || !row.permissions) return base;
  return { ...base, ...row.permissions };
}

/** Convenience check: does the given role have `permission`? */
export async function roleHasPermission(
  ctx: { db: any },
  role: string | null | undefined,
  permission: string,
  approvedPermissions?: string[] | null,
): Promise<boolean> {
  if (Array.isArray(approvedPermissions) && approvedPermissions.includes(permission)) return true;
  const map = await getEffectivePermissions(ctx, role);
  return permAllowed(map[permission]);
}

/**
 * Authoritative server-side check for a concrete user document.
 *
 * Order of precedence:
 *   1. Super admin is always allowed.
 *   2. Per-user grants (approvedPermissions, granted from the Admin console
 *      or via approved permission requests) always allow.
 *   3. The role's effective matrix (defaults + admin overrides).
 *
 * Every mutation/query that gates on a permission MUST use this helper (or
 * pass `approvedPermissions` to roleHasPermission) so dashboard grants
 * actually take effect server-side, not just in the UI.
 */
export async function userHasPermission(
  ctx: { db: any },
  user: { role?: string | null; approvedPermissions?: string[] | null } | null | undefined,
  permission: string,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (Array.isArray(user.approvedPermissions) && user.approvedPermissions.includes(permission)) {
    return true;
  }
  const map = await getEffectivePermissions(ctx, user.role);
  return permAllowed(map[permission]);
}

// ---------------------------------------------------------------------------
// Convex API
// ---------------------------------------------------------------------------

async function canManagePermissions(user: any): Promise<boolean> {
  if (!user) return false;
  return (
    isSuperAdmin(user) ||
    user.role === "dejoiy_admin" ||
    user.role === "admin" ||
    user.role === "it"
  );
}

/** The signed-in user's own effective permission map (for UI gating). */
export const myPermissionMap = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return { role: null, permissions: defaultMatrix("user") };
    const permissions = await getEffectivePermissions(ctx, me.role);
    // Fold per-user grants on top so the UI reflects exactly what the server
    // will enforce (myPermissionMap + userHasPermission stay in sync).
    for (const p of me.approvedPermissions ?? []) {
      if (permissions[p] === undefined || permissions[p] === false) permissions[p] = true;
    }
    return { role: me.role, permissions, approvedPermissions: me.approvedPermissions ?? [] };
  },
});

/** Full matrix (defaults merged with live overrides) for the Admin console. */
export const getPermissionMatrix = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me || !(await canManagePermissions(me))) throw new Error("Admin, IT or Super Admin only");
    const rows = await ctx.db.query("rolePermissions").collect();
    const overrides = new Map<string, Record<string, PermValue>>();
    for (const r of rows) overrides.set(r.role, r.permissions as Record<string, PermValue>);
    const matrix: Record<
      string,
      { defaults: Record<string, PermValue>; current: Record<string, PermValue> }
    > = {};
    for (const role of ROLES_ALL) {
      const defaults = defaultMatrix(role);
      const current = overrides.get(role) ?? defaults;
      matrix[role] = { defaults, current };
    }
    return { permissions: PERMISSIONS, matrix, roles: ROLES_ALL };
  },
});

/** Apply one permission override for a role (or reset to default with undefined). */
export const setRolePermission = mutation({
  args: {
    role: v.string(),
    permission: v.string(),
    value: v.optional(v.union(v.boolean(), v.literal("limited"), v.literal("team"), v.literal("department"))),
  },
  handler: async (ctx, { role, permission, value }) => {
    const me = await getCurrentUser(ctx);
    if (!me || !(await canManagePermissions(me))) throw new Error("Admin, IT or Super Admin only");
    if (!ROLES_ALL.includes(role as MatrixRole)) throw new Error(`Unknown role "${role}"`);
    if (!PERMISSION_BY_ID.has(permission)) throw new Error(`Unknown permission "${permission}"`);
    if (isLockedRole(role)) throw new Error("Super Admin permissions are locked to full access");

    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q: any) => q.eq("role", role))
      .unique();

    const defaults = defaultMatrix(role);
    const base = existing ? { ...(existing.permissions as Record<string, PermValue>) } : {};
    if (value === undefined) {
      delete base[permission];
    } else {
      base[permission] = value;
    }
    // Clean out cells that equal the system default so only real overrides persist.
    const trimmed: Record<string, PermValue> = {};
    for (const [k, val] of Object.entries(base)) {
      if (defaults[k] !== val) trimmed[k] = val;
    }
    const hasOverrides = Object.keys(trimmed).length > 0;
    if (hasOverrides) {
      if (existing) {
        await ctx.db.patch(existing._id, { permissions: trimmed, updatedBy: me._id, updatedAt: Date.now() });
      } else {
        await ctx.db.insert("rolePermissions", {
          role,
          permissions: trimmed,
          updatedBy: me._id,
          updatedAt: Date.now(),
        });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
    // Audit trail.
    await logAudit(ctx, me._id, "permission.override", "rolePermissions", role, `${permission}=${String(value)}`);
  },
});

/** Reset a whole role back to its system-default matrix. */
export const resetRolePermissions = mutation({
  args: { role: v.string() },
  handler: async (ctx, { role }) => {
    const me = await getCurrentUser(ctx);
    if (!me || !(await canManagePermissions(me))) throw new Error("Admin, IT or Super Admin only");
    if (!ROLES_ALL.includes(role as MatrixRole)) throw new Error(`Unknown role "${role}"`);
    if (isLockedRole(role)) throw new Error("Super Admin permissions are locked");
    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q: any) => q.eq("role", role))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    await logAudit(ctx, me._id, "permission.reset", "rolePermissions", role);
  },
});
