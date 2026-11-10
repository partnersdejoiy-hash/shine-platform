import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { roleFromMail } from "./lib/adminRoles";
import { verifyDejoiyMailToken } from "./lib/dejoiyMailToken";
import type { Role } from "./schema";
import { ensureEmployeeId, isSuperAdminEmail, logAudit } from "./users";

/**
 * Accounts come from Dejoiy Mail (Zimbra). The first time someone opens Shine
 * from their mailbox they get a Shine user with the same email; after that the
 * same user is reused. Deactivated Shine users stay locked out.
 * Every time Shine is opened from Dejoiy Mail, the admin role and the profile
 * photo follow Dejoiy Mail again (see lib/adminRoles.ts).
 */
const claims = { email: v.string(), name: v.string(), admin: v.string(), photo: v.string() };
const MAIL_PHOTO = "/api/avatar?email=";

async function applyMail(
  ctx: MutationCtx,
  user: Doc<"users">,
  c: { email: string; name: string; admin: string; photo: string },
) {
  const role = roleFromMail(isSuperAdminEmail(c.email), c.admin, user.role) as Role;
  const patch: Partial<Doc<"users">> = {};
  if (!user.name && c.name) patch.name = c.name;
  // a photo uploaded in Shine wins; otherwise show the Dejoiy Mail one (or none once it's removed there)
  if (!user.avatarStorageId) {
    const image = c.photo || (user.image?.includes(MAIL_PHOTO) ? undefined : user.image);
    if (image !== user.image) patch.image = image;
  }
  if (user.role !== role) patch.role = role;
  if (Object.keys(patch).length) await ctx.db.patch(user._id, patch);
  if (patch.role) {
    await ensureEmployeeId(ctx, user._id);
    await logAudit(ctx, user._id, "user.role_synced", "users", String(user._id), `${role} (from Dejoiy Mail)`);
  }
}

export const upsertUser = internalMutation({
  args: claims,
  handler: async (ctx, c) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", c.email))
      .first();
    if (user) {
      if (user.isActive === false) {
        throw new Error("This account has been deactivated. Contact your administrator.");
      }
      await applyMail(ctx, user, c);
      return user._id;
    }
    const userId = await ctx.db.insert("users", {
      email: c.email,
      name: c.name || c.email.split("@")[0],
      company: c.email.split("@")[1],
      image: c.photo || undefined,
      emailVerificationTime: Date.now(),
      isActive: true,
      role: roleFromMail(isSuperAdminEmail(c.email), c.admin, undefined) as Role,
    });
    await ensureEmployeeId(ctx, userId);
    return userId;
  },
});

export const syncMe = internalMutation({
  args: { userId: v.id("users"), ...claims },
  handler: async (ctx, { userId, ...c }) => {
    const user = await ctx.db.get(userId);
    if (user && user.email?.toLowerCase() === c.email) await applyMail(ctx, user, c);
  },
});

/** Already signed in as this mailbox: refresh role and photo from a fresh Dejoiy Mail token. */
export const refresh = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId: Id<"users"> | null = await getAuthUserId(ctx);
    if (!userId) return;
    const c = await verifyDejoiyMailToken(token, process.env.DEJOIY_MAIL_SSO_SECRET);
    await ctx.runMutation(internal.dejoiyMail.syncMe, { userId, ...c });
  },
});
