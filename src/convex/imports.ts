import bcrypt from "bcryptjs";
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { Role } from "./schema";
import { generateTempPassword, PASSWORD_MIN_LENGTH } from "./passwords";
import { ensureEmployeeId, getCurrentUser, isSuperAdmin, logAudit } from "./users";
import { MAIL_MANAGED_MESSAGE, MAIL_MANAGED_ROLES, assertNotMailManaged } from "./lib/adminRoles";

/**
 * Excel / CSV bulk workflows (admin console).
 *
 * - exportUsers  — dump directory rows for spreadsheet download.
 * - importUsers  — bulk-create users from parsed rows, with per-row validation
 *                  (email format, missing name, invalid role, duplicate emails /
 *                  employee IDs inside the file, already-registered emails).
 * - bulkUserAction — activate / deactivate / set role for many users at once.
 *
 * The permanent super admin account is protected from bulk changes by any
 * other actor, and only the super admin can grant the super_admin role.
 */

const VALID_ROLES = new Set([
  "super_admin",
  "dejoiy_admin",
  "admin",
  "super_it",
  "it",
  "president",
  "director",
  "om",
  "tl",
  "client_admin",
  "user",
  "member",
]);

// Roles that only the super admin may grant through bulk import.
const SUPER_ONLY_ROLES = new Set(["super_admin", "dejoiy_admin"]);

async function canManageUsers(ctx: any) {
  const me = await getCurrentUser(ctx);
  if (!me) return false;
  return isSuperAdmin(me) || me.role === "admin" || me.role === "it";
}

/** Directory rows ready for spreadsheet export (admin / IT / client admin). */
export const exportUsers = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const allowed =
      isSuperAdmin(me) ||
      me.role === "admin" ||
      me.role === "it" ||
      me.role === "client_admin";
    if (!allowed) throw new ConvexError("Admin, IT or Client Admin only");
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isAnonymous)
      .map((u) => ({
        email: u.email ?? "",
        name: u.name ?? "",
        employeeId: u.employeeId ?? "",
        role: u.role ?? "user",
        department: u.department ?? "",
        designation: u.designation ?? "",
        company: u.company ?? "",
        phone: u.phone ?? "",
        isActive: u.isActive !== false,
        lastSeen: u.lastSeen ?? 0,
        createdAt: u._creationTime,
      }));
  },
});

/**
 * Bulk-create users from validated rows. Rows are already parsed + previewed
 * client-side; the server re-validates everything so imports are safe from
 * hand-crafted requests.
 */
export const importUsers = mutation({
  args: {
    rows: v.array(
      v.object({
        email: v.string(),
        name: v.string(),
        employeeId: v.optional(v.string()),
        role: v.optional(v.string()),
        department: v.optional(v.string()),
        designation: v.optional(v.string()),
        company: v.optional(v.string()),
        phone: v.optional(v.string()),
        password: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    if (!(await canManageUsers(ctx))) {
      throw new ConvexError("Admin, IT or Super Admin only");
    }
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");

    const existing = await ctx.db.query("users").collect();
    const existingByEmail = new Map<string, string>();
    for (const u of existing) {
      if (u.email) existingByEmail.set(u.email.toLowerCase(), u._id);
    }

    const seenEmails = new Set<string>();
    const seenEmployeeIds = new Set<string>();
    const created: string[] = [];
    const errors: { row: number; message: string }[] = [];
    const pending: Promise<unknown>[] = [];

    rows.forEach((row, i) => {
      const email = (row.email ?? "").trim().toLowerCase();
      const name = (row.name ?? "").trim();
      const employeeId = (row.employeeId ?? "").trim() || undefined;
      const role = (row.role ?? "user").trim().toLowerCase() || "user";
      const password = (row.password ?? "").trim();
      const line = i + 2; // 1-based + header row

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: line, message: "Invalid or missing email" });
        return;
      }
      if (!name) {
        errors.push({ row: line, message: "Missing name" });
        return;
      }
      if (password && password.length < PASSWORD_MIN_LENGTH) {
        errors.push({ row: line, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
        return;
      }
      if (!VALID_ROLES.has(role)) {
        errors.push({ row: line, message: `Invalid role "${role}"` });
        return;
      }
      if (MAIL_MANAGED_ROLES.has(role)) {
        errors.push({ row: line, message: MAIL_MANAGED_MESSAGE });
        return;
      }
      if (SUPER_ONLY_ROLES.has(role) && !isSuperAdmin(me)) {
        errors.push({ row: line, message: `Only the super admin can import the ${role} role` });
        return;
      }
      if (seenEmails.has(email)) {
        errors.push({ row: line, message: "Duplicate email in file" });
        return;
      }
      if (employeeId && seenEmployeeIds.has(employeeId)) {
        errors.push({ row: line, message: "Duplicate employee ID in file" });
        return;
      }
      if (existingByEmail.has(email)) {
        errors.push({ row: line, message: "Email already registered" });
        return;
      }

      seenEmails.add(email);
      if (employeeId) seenEmployeeIds.add(employeeId);
      created.push(email);
      pending.push(
        (async () => {
          const userId = await ctx.db.insert("users", {
            email,
            name,
            role: role as Role,
            employeeId,
            department: (row.department ?? "").trim() || undefined,
            designation: (row.designation ?? "").trim() || undefined,
            company: (row.company ?? "").trim() || undefined,
            phone: (row.phone ?? "").trim() || undefined,
            isActive: true,
            lastSeen: Date.now(),
          });
          // Guarantee a dedicated SHINE employee ID (DAD007 etc.) unless the
          // sheet already supplied one.
          await ensureEmployeeId(ctx, userId as any);
          // Password column provisions email+password login. When no password
          // is supplied, a random temporary password is generated, emailed to
          // the employee, and they MUST change it on first login (compliance).
          if (password) {
            await ctx.db.insert("passwords", {
              userId,
              hash: bcrypt.hashSync(password, 10),
              history: [],
              updatedAt: Date.now(),
            });
            await ctx.db.patch(userId, { mustChangePassword: false, passwordChangedAt: Date.now() });
          } else {
            const temp = generateTempPassword();
            await ctx.db.insert("passwords", {
              userId,
              hash: bcrypt.hashSync(temp, 10),
              history: [],
              updatedAt: Date.now(),
            });
            await ctx.db.patch(userId, { mustChangePassword: true });
            if (email) {
              // Queue the branded email via the action runner (mutations can't
              // fetch in Convex 1.42+).
              ctx.scheduler.runAfter(0, api.emailActions.sendTempPassword, {
                to: email,
                name,
                tempPassword: temp,
              });
            }
          }
          return userId;
        })(),
      );
    });

    await Promise.all(pending);
    await logAudit(
      ctx,
      me._id,
      "admin.users_bulk_import",
      "users",
      undefined,
      `${created.length} created, ${errors.length} rejected`,
    );
    return { created: created.length, errors };
  },
});

/** Activate / deactivate / change role for many users at once. */
export const bulkUserAction = mutation({
  args: {
    userIds: v.array(v.id("users")),
    action: v.union(
      v.literal("activate"),
      v.literal("deactivate"),
      v.literal("set_role"),
    ),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { userIds, action, role }) => {
    if (!(await canManageUsers(ctx))) {
      throw new ConvexError("Admin, IT or Super Admin only");
    }
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");

    let updated = 0;
    for (const userId of userIds) {
      const target = await ctx.db.get(userId);
      if (!target) continue;
      // The permanent super admin is protected from other actors.
      if (isSuperAdmin(target) && !isSuperAdmin(me)) continue;

      if (action === "activate") {
        await ctx.db.patch(userId, { isActive: true });
        await logAudit(ctx, me._id, "user.activated", "users", String(userId), "bulk");
      } else if (action === "deactivate") {
        await ctx.db.patch(userId, { isActive: false });
        await logAudit(ctx, me._id, "user.deactivated", "users", String(userId), "bulk");
      } else {
        const nextRole = (role ?? "").trim().toLowerCase();
        if (!VALID_ROLES.has(nextRole)) {
          throw new ConvexError(`Invalid role "${nextRole}"`);
        }
        assertNotMailManaged(nextRole);
        if (SUPER_ONLY_ROLES.has(nextRole) && !isSuperAdmin(me)) {
          throw new ConvexError(`Only the super admin can grant the ${nextRole} role`);
        }
        await ctx.db.patch(userId, { role: nextRole as Role });
        await ensureEmployeeId(ctx, userId);
        await logAudit(ctx, me._id, "user.role_changed", "users", String(userId), `${nextRole} (bulk)`);
      }
      updated++;
    }
    return { updated };
  },
});
