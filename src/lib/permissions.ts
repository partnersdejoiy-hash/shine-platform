/**
 * Frontend role + permission helpers.
 *
 * The authoritative permission matrix lives in `convex/permissions.ts` and is
 * applied server-side. These helpers are used by the UI to show/hide actions
 * and to render role badges consistently.
 */

export type PermValue = boolean | "limited" | "team" | "department";

export interface RoleMeta {
  value: string;
  label: string;
  short: string;
  badgeClass: string;
  description: string;
}

export const ROLE_META: RoleMeta[] = [
  {
    value: "super_admin",
    label: "Super Admin",
    short: "SA",
    badgeClass: "bg-primary/15 text-primary hover:bg-primary/20",
    description: "Full system owner (God Console) — nothing is restricted.",
  },
  {
    value: "dejoiy_admin",
    label: "DEJOIY Admin",
    short: "DA",
    badgeClass: "bg-amber-400/15 text-amber-300 hover:bg-amber-400/20",
    description: "Platform-wide admin just below the Super Admin.",
  },
  {
    value: "admin",
    label: "Admin",
    short: "AD",
    badgeClass: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/20",
    description: "Everything except super-admin-only features.",
  },
  {
    value: "super_it",
    label: "Super IT",
    short: "SI",
    badgeClass: "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/20",
    description: "Above IT — full employee management, analytics, settings (still below admins).",
  },
  {
    value: "it",
    label: "IT Team",
    short: "IT",
    badgeClass: "bg-sky-500/15 text-sky-400 hover:bg-sky-500/20",
    description: "Technical support — resets, devices, security policies.",
  },
  {
    value: "president",
    label: "President",
    short: "PR",
    badgeClass: "bg-violet-500/15 text-violet-400 hover:bg-violet-500/20",
    description: "Highest business authority — departments, company meetings, broadcasts.",
  },
  {
    value: "director",
    label: "Director",
    short: "DR",
    badgeClass: "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/20",
    description: "Department head — department groups, meetings, employees.",
  },
  {
    value: "om",
    label: "Operations Manager",
    short: "OM",
    badgeClass: "bg-teal-500/15 text-teal-400 hover:bg-teal-500/20",
    description: "Team operations — team groups, tasks, announcements.",
  },
  {
    value: "tl",
    label: "Team Leader",
    short: "TL",
    badgeClass: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20",
    description: "Team lead — team chat, meetings, task assignment.",
  },
  {
    value: "client_admin",
    label: "Client Admin",
    short: "CA",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-400 hover:bg-fuchsia-500/20",
    description: "Tenant administrator for partner organizations.",
  },
  {
    value: "user",
    label: "Employee",
    short: "EM",
    badgeClass: "bg-accent text-muted-foreground",
    description: "Standard employee — messaging, 1:1 calls, join meetings.",
  },
  {
    value: "member",
    label: "Member",
    short: "MB",
    badgeClass: "bg-accent text-muted-foreground",
    description: "Limited member access.",
  },
];

export const roleMeta = (role?: string | null): RoleMeta =>
  ROLE_META.find((r) => r.value === role) ?? {
    value: role ?? "user",
    label: role ? role.replace(/_/g, " ") : "Employee",
    short: "?",
    badgeClass: "bg-accent text-muted-foreground",
    description: "",
  };

/**
 * SHINE enterprise hierarchy (lowest → highest).
 *   member → user → tl → om → director → president → it → super_it
 *   → admin → dejoiy_admin → super_admin
 */
export const ROLE_HIERARCHY: { role: string; label: string; rank: number; employeeIdPrefix: string }[] = [
  { role: "super_admin", label: "Super Admin", rank: 10, employeeIdPrefix: "DSU" },
  { role: "dejoiy_admin", label: "DEJOIY Admin", rank: 9, employeeIdPrefix: "DDA" },
  { role: "admin", label: "Admin", rank: 8, employeeIdPrefix: "DAD" },
  { role: "super_it", label: "Super IT", rank: 7, employeeIdPrefix: "DSI" },
  { role: "it", label: "IT Team", rank: 6, employeeIdPrefix: "DIT" },
  { role: "president", label: "President", rank: 5, employeeIdPrefix: "DPR" },
  { role: "director", label: "Director", rank: 4, employeeIdPrefix: "DDI" },
  { role: "om", label: "Operations Manager", rank: 3, employeeIdPrefix: "DOM" },
  { role: "tl", label: "Team Leader", rank: 2, employeeIdPrefix: "DTL" },
  { role: "user", label: "Employee", rank: 1, employeeIdPrefix: "DEM" },
  { role: "member", label: "Member", rank: 0, employeeIdPrefix: "DMB" },
];

/**
 * Who may use the @allS god command (everyone on Shine and Dejoiy Mail, every domain):
 * DEJOIY's super admins and IT, plus admins and IT on DEJOIY's own domains,
 * or anyone granted the permission. Keep in step with convex/reach.ts canMentionEveryone.
 */
const DEJOIY_DOMAINS = ["dejoiy.com", "mail.dejoiy.com"];
export function isHigherManagement(
  user: { role?: string | null; email?: string | null; approvedPermissions?: string[] | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "super_admin" || user.role === "dejoiy_admin" || user.role === "super_it") return true;
  const domain = (user.email ?? "").toLowerCase().split("@")[1] ?? "";
  if ((user.role === "admin" || user.role === "it") && DEJOIY_DOMAINS.includes(domain)) return true;
  return user.approvedPermissions?.includes("all_users_mention") ?? false;
}

/** True when the value grants access (true or any scope string). */
export function permAllowed(value: PermValue | undefined): boolean {
  return value === true || (typeof value === "string" && value.length > 0);
}

/** True when the value is a scoped access (limited/team/department). */
export function permScoped(value: PermValue | undefined): value is Exclude<PermValue, boolean> {
  return typeof value === "string";
}

export const PERM_SCOPE_LABEL: Record<string, string> = {
  limited: "Limited",
  team: "Team",
  department: "Department",
};

/**
 * Can a user perform `permission`? Uses the admin-overridable role matrix
 * passed in (fetched via api.permissions.getPermissionMatrix) or, when no
 * matrix is available, the static defaults from the backend module.
 *
 * Per-user approvedPermissions (via permission requests) always grant access.
 */
export function can(
  user: { role?: string | null; approvedPermissions?: string[] | null } | null | undefined,
  matrix: Record<string, Record<string, PermValue>> | null | undefined,
  permission: string,
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.approvedPermissions?.includes(permission)) return true;
  const roleMap = matrix?.[user.role ?? "user"];
  if (roleMap && roleMap[permission] !== undefined) return permAllowed(roleMap[permission]);
  // Fallback to the static defaults (imported from the shared source of truth).
  return permAllowed(DEFAULT_ROLE_PERMISSIONS[user.role ?? "user"]?.[permission]);
}

/** Static defaults mirroring convex/permissions.ts (UI-only fallback). */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, PermValue>> = {
  super_admin: Object.fromEntries(
    ["create_organization", "manage_roles", "all_users_mention", "company_announcement", "department_groups", "team_groups", "private_chat", "group_chat", "one_to_one_call", "group_call", "start_meeting", "join_meeting", "invite_multiple_users", "manage_employees", "view_analytics", "system_settings", "delete_chat"].map((p) => [p, true]),
  ),
  dejoiy_admin: {
    create_organization: false, manage_roles: true, all_users_mention: true,
    company_announcement: true, department_groups: true, team_groups: true,
    private_chat: true, group_chat: true, one_to_one_call: true, group_call: true,
    start_meeting: true, join_meeting: true, invite_multiple_users: true,
    manage_employees: true, view_analytics: true, system_settings: true, delete_chat: true,
  },
  admin: {
    create_organization: false, manage_roles: true, all_users_mention: false,
    company_announcement: true, department_groups: true, team_groups: true,
    private_chat: true, group_chat: true, one_to_one_call: true, group_call: true,
    start_meeting: true, join_meeting: true, invite_multiple_users: true,
    manage_employees: true, view_analytics: true, system_settings: "limited", delete_chat: false,
  },
  super_it: {
    create_organization: false, manage_roles: false, all_users_mention: true,
    company_announcement: false, department_groups: false, team_groups: false,
    private_chat: true, group_chat: true, one_to_one_call: true, group_call: true,
    start_meeting: true, join_meeting: true, invite_multiple_users: true,
    manage_employees: true, view_analytics: true, system_settings: "limited", delete_chat: false,
  },
  it: {
    create_organization: false, manage_roles: false, all_users_mention: false,
    company_announcement: false, department_groups: false, team_groups: false,
    private_chat: true, group_chat: true, one_to_one_call: true, group_call: true,
    start_meeting: true, join_meeting: true, invite_multiple_users: true,
    manage_employees: "limited", view_analytics: "limited",
    system_settings: "limited", delete_chat: false,
  },
  president: {
    create_organization: false, manage_roles: false, company_announcement: true,
    department_groups: true, team_groups: true, private_chat: true, group_chat: true,
    one_to_one_call: true, group_call: true, start_meeting: true, join_meeting: true,
    invite_multiple_users: true, manage_employees: true, view_analytics: true,
    system_settings: false, delete_chat: false,
  },
  director: {
    create_organization: false, manage_roles: false, company_announcement: false,
    department_groups: true, team_groups: true, private_chat: true, group_chat: true,
    one_to_one_call: true, group_call: true, start_meeting: true, join_meeting: true,
    invite_multiple_users: true, manage_employees: true, view_analytics: "department",
    system_settings: false, delete_chat: false,
  },
  om: {
    create_organization: false, manage_roles: false, company_announcement: false,
    department_groups: false, team_groups: true, private_chat: true, group_chat: true,
    one_to_one_call: true, group_call: true, start_meeting: true, join_meeting: true,
    invite_multiple_users: true, manage_employees: "team", view_analytics: "team",
    system_settings: false, delete_chat: false,
  },
  tl: {
    create_organization: false, manage_roles: false, company_announcement: false,
    department_groups: false, team_groups: true, private_chat: true, group_chat: true,
    one_to_one_call: true, group_call: true, start_meeting: true, join_meeting: true,
    invite_multiple_users: true, manage_employees: "team", view_analytics: false,
    system_settings: false, delete_chat: false,
  },
  user: {
    create_organization: false, manage_roles: false, company_announcement: false,
    department_groups: false, team_groups: false, private_chat: true, group_chat: false,
    one_to_one_call: true, group_call: false, start_meeting: false, join_meeting: true,
    invite_multiple_users: false, manage_employees: false, view_analytics: false,
    system_settings: false, delete_chat: false,
  },
  client_admin: {
    create_organization: false, manage_roles: true, company_announcement: true,
    department_groups: true, team_groups: true, private_chat: true, group_chat: true,
    one_to_one_call: true, group_call: true, start_meeting: true, join_meeting: true,
    invite_multiple_users: true, manage_employees: "limited", view_analytics: "limited",
    system_settings: false, delete_chat: false,
  },
  member: {
    create_organization: false, manage_roles: false, company_announcement: false,
    department_groups: false, team_groups: false, private_chat: true, group_chat: false,
    one_to_one_call: true, group_call: false, start_meeting: false, join_meeting: true,
    invite_multiple_users: false, manage_employees: false, view_analytics: false,
    system_settings: false, delete_chat: false,
  },
};
