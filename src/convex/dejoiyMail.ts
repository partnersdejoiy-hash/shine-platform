import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Accounts come from Dejoiy Mail (Zimbra). The first time someone opens Shine
 * from their mailbox they get a Shine user with the same email; after that the
 * same user is reused. Deactivated Shine users stay locked out.
 * Internal only: reachable solely through the "dejoiy-mail" sign-in provider,
 * which has already checked the signed token.
 */
export const upsertUser = internalMutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (user) {
      if (user.isActive === false) {
        throw new Error("This account has been deactivated. Contact your administrator.");
      }
      if (!user.name && name) await ctx.db.patch(user._id, { name });
      return user._id;
    }
    return await ctx.db.insert("users", {
      email,
      name: name || email.split("@")[0],
      company: email.split("@")[1],
      emailVerificationTime: Date.now(),
      isActive: true,
    });
  },
});
