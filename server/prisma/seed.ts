/**
 * SHINE database seed — creates the DEJOIY organization, the 8-level role
 * hierarchy, the full permission matrix and the permanent super admin
 * (deepak.sharma@corp.dejoiy.com). Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL || "deepak.sharma@corp.dejoiy.com";
// No default: a password in the code would be public to anyone who can read the repo.
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
if (!SUPER_ADMIN_PASSWORD) throw new Error("Set SUPER_ADMIN_PASSWORD before seeding.");

/** Permission keys — keep in sync with the frontend capability map. */
const PERMISSIONS: Record<string, string> = {
  "org.create": "Create organizations (super admin only)",
  "roles.manage": "Manage roles & permissions",
  "users.manage": "Manage users (create/disable/delete)",
  "users.roles": "Change user roles",
  "users.bulk": "Bulk user operations (import/export/update)",
  "users.invite": "Invite employees",
  "users.resetPassword": "Reset passwords",
  "devices.manage": "Manage devices & trust",
  "sessions.revoke": "Revoke sessions",
  "announcements.broadcast": "Company-wide announcements",
  "departments.create": "Create departments",
  "teams.create": "Create teams",
  "groups.create": "Create group chats",
  "channels.create": "Create channels",
  "private_chat": "1-to-1 messaging",
  "group_chat": "Group messaging",
  "meetings.schedule": "Schedule meetings",
  "meetings.start": "Start meetings",
  "meetings.join": "Join meetings",
  "meetings.record": "Record meetings",
  "meetings.manage": "Manage meetings (lock, breakout, moderators)",
  "calendar.manage": "Manage calendars & shares",
  "files.upload": "Upload files",
  "files.download": "Download files",
  "exports.data": "Export data (Excel/CSV/PDF)",
  "imports.data": "Bulk import data",
  "reports.view": "View analytics & reports",
  "audit.view": "View audit logs",
  "compliance.manage": "Manage compliance & policy acknowledgements",
  "policies.manage": "Manage policies",
  "integrations.manage": "Manage integrations",
  "security.configure": "Configure security policies",
  "ai.configure": "Configure AI features",
  "monitoring.view": "View system monitoring",
  "backup.manage": "Backup & restore",
};

/** Role -> permission matrix (the SHINE hierarchy from the spec). */
const MATRIX: Record<string, string[]> = {
  super_admin: Object.keys(PERMISSIONS), // everything
  admin: [
    "roles.manage", "users.manage", "users.roles", "users.bulk",
    "users.invite", "users.resetPassword", "devices.manage",
    "sessions.revoke", "announcements.broadcast", "departments.create",
    "teams.create", "groups.create", "channels.create", "private_chat",
    "group_chat", "meetings.schedule", "meetings.start", "meetings.join",
    "meetings.record", "meetings.manage", "calendar.manage", "files.upload",
    "files.download", "exports.data", "imports.data", "reports.view",
    "audit.view", "compliance.manage", "policies.manage",
    "integrations.manage", "security.configure", "monitoring.view",
  ],
  it: [
    "users.resetPassword", "users.invite", "devices.manage",
    "sessions.revoke", "integrations.manage", "security.configure",
    "monitoring.view", "audit.view", "private_chat", "group_chat",
    "meetings.join", "files.upload", "files.download",
  ],
  president: [
    "announcements.broadcast", "departments.create", "teams.create",
    "channels.create", "users.invite", "reports.view", "exports.data",
    "private_chat", "group_chat", "meetings.schedule", "meetings.start",
    "meetings.join", "meetings.record", "meetings.manage", "calendar.manage",
    "files.upload", "files.download", "compliance.manage",
  ],
  director: [
    "departments.create", "teams.create", "channels.create", "users.invite",
    "users.manage", "private_chat", "group_chat", "meetings.schedule",
    "meetings.start", "meetings.join", "meetings.record", "meetings.manage",
    "calendar.manage", "files.upload", "files.download", "reports.view",
    "exports.data",
  ],
  om: [
    "teams.create", "groups.create", "channels.create", "private_chat",
    "group_chat", "meetings.schedule", "meetings.start", "meetings.join",
    "meetings.record", "calendar.manage", "files.upload", "files.download",
    "exports.data",
  ],
  tl: [
    "groups.create", "channels.create", "private_chat", "group_chat",
    "meetings.schedule", "meetings.start", "meetings.join", "meetings.record",
    "calendar.manage", "files.upload", "files.download",
  ],
  employee: [
    "private_chat", "meetings.join", "files.upload", "files.download",
  ],
};

const ROLES: { name: string; displayName: string; rank: number; flags: Partial<Record<string, boolean>> }[] = [
  { name: "super_admin", displayName: "Super Admin", rank: 1, flags: { canCreateMeetings: true, canScheduleMeetings: true, canCreateGroups: true, canCreateChannels: true, canBroadcast: true, canManageUsers: true, canViewReports: true, canViewAudit: true, allowExports: true } },
  { name: "admin", displayName: "Administrator", rank: 2, flags: { canCreateMeetings: true, canScheduleMeetings: true, canCreateGroups: true, canCreateChannels: true, canBroadcast: true, canManageUsers: true, canViewReports: true, canViewAudit: true, allowExports: true } },
  { name: "it", displayName: "IT Team", rank: 3, flags: { canViewAudit: true, allowExports: true } },
  { name: "president", displayName: "President", rank: 4, flags: { canCreateMeetings: true, canScheduleMeetings: true, canCreateGroups: true, canCreateChannels: true, canBroadcast: true, canViewReports: true, allowExports: true } },
  { name: "director", displayName: "Director", rank: 5, flags: { canCreateMeetings: true, canScheduleMeetings: true, canCreateGroups: true, canCreateChannels: true, canViewReports: true, allowExports: true } },
  { name: "om", displayName: "Operations Manager", rank: 6, flags: { canCreateMeetings: true, canScheduleMeetings: true, canCreateGroups: true, canCreateChannels: true } },
  { name: "tl", displayName: "Team Leader", rank: 7, flags: { canCreateMeetings: true, canScheduleMeetings: true, canCreateGroups: true, canCreateChannels: true } },
  { name: "employee", displayName: "Employee", rank: 8, flags: {} },
];

async function main() {
  console.log("Seeding SHINE ...");

  // 1. Permissions
  const permissionIds: Record<string, string> = {};
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const p = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissionIds[key] = p.id;
  }

  // 2. Roles + matrix
  const roleIds: Record<string, string> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name as any },
      update: { displayName: r.displayName, rank: r.rank, ...r.flags },
      create: { name: r.name as any, displayName: r.displayName, rank: r.rank, ...r.flags },
    });
    roleIds[r.name] = role.id;

    const wanted = MATRIX[r.name] ?? [];
    for (const key of wanted) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionIds[key] } },
        update: {},
        create: { roleId: role.id, permissionId: permissionIds[key] },
      });
    }
  }

  // 3. DEJOIY organization
  const org = await prisma.organization.upsert({
    where: { slug: "dejoiy" },
    update: { name: "DEJOIY" },
    create: {
      name: "DEJOIY",
      slug: "dejoiy",
      domain: "dejoiy.com",
      plan: "enterprise",
      brand: {
        primary: "#D4AF37",
        background: "#0B0B0B",
        text: "#FFFFFF",
        muted: "#8A8F98",
        logoUrl: null,
        signature: "DEJOIY India Private Limited",
      },
    },
  });

  // 3b. Billing plans (Razorpay licensing tiers — prices in paise)
  const billingPlans = [
    { code: "free", name: "Free", price: 0, period: "month", features: ["Up to 10 employees", "1-to-1 chat, calls & meetings", "Standard support"] },
    { code: "starter", name: "Starter", price: 49900, period: "month", features: ["Up to 50 employees", "Group chats & channels", "HD meetings + screen share", "Email support"] },
    { code: "professional", name: "Professional", price: 199900, period: "month", features: ["Up to 500 employees", "Recordings, live captions & breakout rooms", "Advanced admin & compliance", "Priority support"] },
    { code: "enterprise", name: "Enterprise", price: 0, period: "custom", features: ["Unlimited employees", "SSO / SCIM / audit & legal hold", "Dedicated success manager", "Custom SLA & onboarding"] },
  ];
  for (const p of billingPlans) {
    await prisma.billingPlan.upsert({
      where: { code: p.code },
      update: { name: p.name, price: p.price, period: p.period, features: p.features, active: true },
      create: { code: p.code, name: p.name, price: p.price, period: p.period, features: p.features, active: true },
    });
  }

  // 4. Permanent super admin — deepak.sharma@corp.dejoiy.com (CEO)
  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      roleId: roleIds["super_admin"],
      orgId: org.id,
      company: "DEJOIY",
      designation: "CEO",
      status: "active",
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      name: "Deepak Sharma",
      passwordHash: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12),
      roleId: roleIds["super_admin"],
      orgId: org.id,
      company: "DEJOIY",
      designation: "CEO",
      status: "active",
      employeeId: "DEJ-0001",
    },
  });

  // 5. Seed a few required policies so acknowledgement gating can be tested
  const requiredPolicies = [
    ["privacy-policy", "Privacy Policy"],
    ["terms-of-service", "Terms of Service"],
    ["code-of-conduct", "Code of Conduct"],
    ["information-security-policy", "Information Security Policy"],
    ["employee-communication-policy", "Employee Communication Policy"],
    ["data-protection-policy", "Data Protection Policy"],
    ["acceptable-use-policy", "Acceptable Use Policy"],
  ];
  for (const [slug, name] of requiredPolicies) {
    await prisma.policy.upsert({
      where: { orgId_slug: { orgId: org.id, slug } },
      update: { name, version: 1, required: true },
      create: {
        orgId: org.id,
        slug,
        name,
        version: 1,
        required: true,
        content: `# ${name}\n\n_This document is managed by SHINE Compliance. Version 1._`,
      },
    });
  }

  console.log(`Seeded DEJOIY org, ${Object.keys(PERMISSIONS).length} permissions, ${ROLES.length} roles, ${billingPlans.length} billing plans.`);
  console.log(`Super admin ready: ${superAdmin.email} (Super Admin / CEO)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
