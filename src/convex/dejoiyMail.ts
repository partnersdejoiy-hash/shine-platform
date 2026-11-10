import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { roleFromMail } from "./lib/adminRoles";
import type { Role } from "./schema";
import { ensureEmployeeId, isSuperAdminEmail, logAudit } from "./users";

/**
 * Accounts come from Dejoiy Mail (Zimbra). The first time someone opens Shine
 * from their mailbox they get a Shine user with the same email; after that the
 * same user is reused. Deactivated Shine users stay locked out.
 * Admin rights follow Dejoiy Mail on every sign-in (see lib/adminRoles.ts).
 * Internal only: reachable solely through the "dejoiy-mail" sign-in provider,
 * which has already checked the signed token.
 */
export const upsertUser = internalMutation({
  args: { email: v.string(), name: v.string(), admin: v.string() },
  handler: async (ctx, { email, name, admin }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (user) {
      if (user.isActive === false) {
        throw new Error("This account has been deactivated. Contact your administrator.");
      }
      const role = roleFromMail(isSuperAdminEmail(email), admin, user.role) as Role;
      if (!user.name && name) await ctx.db.patch(user._id, { name });
      if (user.role !== role) {
        await ctx.db.patch(user._id, { role });
        await ensureEmployeeId(ctx, user._id);
        await logAudit(ctx, user._id, "user.role_synced", "users", String(user._id), `${role} (from Dejoiy Mail)`);
      }
      return user._id;
    }
    const userId = await ctx.db.insert("users", {
      email,
      name: name || email.split("@")[0],
      company: email.split("@")[1],
      emailVerificationTime: Date.now(),
      isActive: true,
      role: roleFromMail(isSuperAdminEmail(email), admin, undefined) as Role,
    });
    await ensureEmployeeId(ctx, userId);
    return userId;
  },
});
