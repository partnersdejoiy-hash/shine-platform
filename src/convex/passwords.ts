import { getAuthUserId } from "@convex-dev/auth/server";
import bcrypt from "bcryptjs";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import {
  getCurrentUser,
  isSuperAdmin,
  logAudit,
} from "./users";

/**
 * Email + password authentication for every SHINE employee (alongside email
 * OTP). Passwords are bcrypt-hashed and stored in the dedicated `passwords`
 * table — never on the user doc — so hashes can't leak through directory,
 * participant or admin queries.
 *
 * The `password` auth provider's `authorize` callback runs inside a Convex
 * ACTION (no direct `ctx.db`), so credential verification happens here via
 * `ctx.runMutation(internal.passwords.loginWithPassword, …)`.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** How many previous passwords are remembered and rejected on reuse. */
export const PASSWORD_HISTORY_SIZE = 5;

function validateNewPassword(password: string) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new ConvexError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }
}

/** Generate a cryptographically-random temporary password (12 chars). */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const rand = new Uint32Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 12; i++) rand[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[rand[i] % chars.length];
  return out;
}

/** Generate a random 6-digit verification code (email-verified fallback). */
function generateCode(): string {
  // crypto, not Math.random: the code stands in for a password
  return (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, "0");
}

/** How long a temp auth code stays valid before it expires. */
const TEMP_CODE_TTL_MS = 10 * 60 * 1000;
const CODE_TRIES = 5;

/** A new one-time code for this person (any earlier one stops working). Kept off the user's own row. */
async function issueCode(ctx: MutationCtx, userId: Id<"users">): Promise<string> {
  await clearAuthCode(ctx, userId);
  const code = generateCode();
  await ctx.db.insert("authCodes", { userId, code, expiresAt: Date.now() + TEMP_CODE_TTL_MS, tries: 0 });
  return code;
}

/** Removes this person's code, and any code an older version left on their row. */
export async function clearAuthCode(ctx: MutationCtx, userId: Id<"users">) {
  for (const row of await ctx.db.query("authCodes").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
    await ctx.db.delete(row._id);
  }
  const user = await ctx.db.get(userId);
  if (user && (user.tempAuthCode !== undefined || user.tempAuthCodeExpiresAt !== undefined)) {
    await ctx.db.patch(userId, { tempAuthCode: undefined, tempAuthCodeExpiresAt: undefined });
  }
}

/** null when the code is right (and it is used up); otherwise what to tell the person.
 *  A wrong try is counted, so the caller must return this message rather than throw (a throw would undo the count). */
async function checkCode(ctx: MutationCtx, userId: Id<"users">, code: string): Promise<string | null> {
  const row = await ctx.db.query("authCodes").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (!row || Date.now() > row.expiresAt) {
    if (row) await ctx.db.delete(row._id);
    return "The verification code is invalid or has expired — request a new one.";
  }
  if (code.trim() !== row.code) {
    if (row.tries + 1 >= CODE_TRIES) {
      await ctx.db.delete(row._id);
      return "Too many wrong codes. Request a new one.";
    }
    await ctx.db.patch(row._id, { tries: row.tries + 1 });
    return "The verification code you entered is incorrect.";
  }
  await ctx.db.delete(row._id);
  return null;
}

/**
 * Queue a (new) temporary password email via the email action.
 *
 * Convex 1.42+: mutations can't make network requests AND no longer expose
 * `ctx.runAction` — the only way to fire an action from a mutation is
 * `ctx.scheduler.runAfter(0, …)`, which runs right after this mutation commits.
 */
function sendTempPasswordEmail(
  ctx: any,
  target: { email?: string; name?: string },
  tempPassword: string,
) {
  if (!target.email) return;
  ctx.scheduler.runAfter(0, internal.emailActions.sendTempPassword, {
    to: target.email,
    name: target.name,
    tempPassword,
  });
}

/** Internal: upsert the bcrypt hash for a user (one row per user). */
async function upsertPassword(
  ctx: any,
  userId: string,
  hash: string,
  historyCount = PASSWORD_HISTORY_SIZE,
) {
  const existing = await ctx.db
    .query("passwords")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  if (existing) {
    // move the current hash into history (keeps last N), then replace it
    const history = existing.history ?? [];
    const nextHistory = [existing.hash, ...history].slice(0, historyCount);
    await ctx.db.patch(existing._id, { hash, history: nextHistory, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("passwords", {
      userId,
      hash,
      history: [],
      updatedAt: Date.now(),
    });
  }
}

/** Reject the new password if it matches the current hash or any recent one. */
async function assertNotReused(ctx: any, userId: string, newPassword: string) {
  const existing = await ctx.db
    .query("passwords")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  if (!existing) return;
  const all = [existing.hash, ...(existing.history ?? [])];
  for (const h of all) {
    if (bcrypt.compareSync(newPassword, h)) {
      throw new ConvexError(
        `This password was used recently. Choose a different one — the last ${PASSWORD_HISTORY_SIZE} passwords cannot be reused.`,
      );
    }
  }
}

/**
 * Verify email + password for sign-in. Internal: only the `password` auth
 * provider calls it, so it can't be used to guess passwords from outside.
 */
export const loginWithPassword = internalMutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) {
      throw new ConvexError("Email and password are required.");
    }

    const user: any = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();

    if (!user) {
      throw new ConvexError("No account found with this email.");
    }
    if (user.isActive === false) {
      throw new ConvexError(
        "This account has been deactivated. Contact your administrator.",
      );
    }

    const row = await ctx.db
      .query("passwords")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!row) {
      throw new ConvexError(
        "No password set for this account yet. Sign in with your email verification code, then create a password in Settings → Security.",
      );
    }
    if (!bcrypt.compareSync(password, row.hash)) {
      throw new ConvexError("Invalid email or password.");
    }

    try {
      await logAudit(ctx, user._id, "auth.password_login", "users", String(user._id), normalized);
    } catch {
      // audit logging must never block a successful login
    }
    return user._id;
  },
});

/** Create or change the current user's own password. */
export const setMyPassword = mutation({
  args: {
    currentPassword: v.optional(v.string()),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new ConvexError("Not authenticated");
    validateNewPassword(newPassword);

    const existing = await ctx.db
      .query("passwords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      if (!currentPassword || !bcrypt.compareSync(currentPassword, existing.hash)) {
        throw new ConvexError("Current password is incorrect.");
      }
    }
    // Password compliance: the last 5 passwords can never be reused.
    await assertNotReused(ctx, userId, newPassword);

    const hash = bcrypt.hashSync(newPassword, 10);
    await upsertPassword(ctx, userId, hash);
    // A successful change satisfies any forced-change requirement.
    await ctx.db.patch(userId, {
      mustChangePassword: false,
      passwordChangedAt: Date.now(),
    });
    await logAudit(
      ctx,
      userId,
      existing ? "auth.password_changed" : "auth.password_set",
      "users",
      String(userId),
    );
    return true;
  },
});

/** Admins / IT can set or reset any employee's password. */
export const adminSetUserPassword = mutation({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
    // when true the user must change it on next sign-in
    mustChange: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, newPassword, mustChange }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new ConvexError("Not authenticated");
    if (
      !(isSuperAdmin(actor) || actor.role === "admin" || actor.role === "it")
    ) {
      throw new ConvexError("Admin, IT or Super Admin only");
    }
    validateNewPassword(newPassword);

    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
      throw new ConvexError(
        "Only the super admin can reset the super admin password",
      );
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await upsertPassword(ctx, userId, hash);
    await ctx.db.patch(userId, {
      mustChangePassword: mustChange === true,
      passwordChangedAt: mustChange === true ? undefined : Date.now(),
    });
    await logAudit(
      ctx,
      actor._id,
      "admin.password_reset",
      "users",
      String(userId),
      `by ${actor.email ?? "admin"}${mustChange ? " (forced change)" : ""}`,
    );
    return true;
  },
});

/**
 * Admin provisioning: generate a random temporary password, set it (forcing a
 * change on first login), email it to the user's address, and return it so the
 * admin can share it out-of-band if email delivery fails.
 */
export const adminProvisionPassword = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new ConvexError("Not authenticated");
    if (
      !(isSuperAdmin(actor) || actor.role === "admin" || actor.role === "it")
    ) {
      throw new ConvexError("Admin, IT or Super Admin only");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("User not found");
    if (!target.email) throw new ConvexError("This user has no email address");

    // Privileged accounts (admin / super admin / IT / super IT / DEJOIY admin)
    // manage their own credentials — a temporary password can never be issued
    // to them, not even by another admin.
    const privilegedRoles = [
      "super_admin",
      "dejoiy_admin",
      "admin",
      "super_it",
      "it",
    ];
    if (target.role && privilegedRoles.includes(target.role)) {
      throw new ConvexError(
        "Temporary passwords can't be issued to admin / IT accounts — they manage their own credentials.",
      );
    }

    const tempPassword = generateTempPassword();
    const hash = bcrypt.hashSync(tempPassword, 10);
    await upsertPassword(ctx, userId, hash);
    await ctx.db.patch(userId, {
      mustChangePassword: true,
      passwordChangedAt: undefined,
    });

    // Email is queued to the action runner right after this mutation commits.
    sendTempPasswordEmail(ctx, target, tempPassword);

    await logAudit(
      ctx,
      actor._id,
      "admin.password_provisioned",
      "users",
      String(userId),
      `temp password queued to ${target.email}`,
    );
    return { tempPassword, emailSent: true };
  },
});

/**
 * Resend a new temporary password to the signed-in user's email (used from the
 * forced change-password page when the original email was missed).
 */
export const resendMyTempPassword = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new ConvexError("Not authenticated");
    if (!me.email) throw new ConvexError("No email is attached to this account");

    const tempPassword = generateTempPassword();
    const hash = bcrypt.hashSync(tempPassword, 10);
    await upsertPassword(ctx, userId, hash);
    await ctx.db.patch(userId, {
      mustChangePassword: true,
      passwordChangedAt: undefined,
    });

    sendTempPasswordEmail(ctx, me, tempPassword);
    await logAudit(ctx, userId, "auth.password_resend", "users", String(userId), "temp password queued");
    return { emailSent: true };
  },
});

/** Signed-out reset requests: at most 3 per email address in 15 minutes. */
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX = 3;
async function allowResetRequest(ctx: MutationCtx, email: string) {
  const since = Date.now() - RESET_WINDOW_MS;
  for (const old of await ctx.db.query("resetRequests").withIndex("by_email_at", (q) => q.eq("email", email).lt("at", since)).collect()) {
    await ctx.db.delete(old._id);
  }
  const recent = await ctx.db.query("resetRequests").withIndex("by_email_at", (q) => q.eq("email", email).gte("at", since)).collect();
  if (recent.length >= RESET_MAX) throw new ConvexError("Too many requests for this email. Try again in 15 minutes.");
  await ctx.db.insert("resetRequests", { email, at: Date.now() });
}

/** Emails a reset code to an active account. Its current password keeps working until the code is used. */
async function sendResetCode(ctx: MutationCtx, email: string, action: string) {
  const normalized = email.trim().toLowerCase();
  await allowResetRequest(ctx, normalized);
  const target = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .unique();
  // Same answer either way: no account or role leaks to signed-out callers.
  if (!target || !target.email || target.isActive === false) return { ok: true };

  const code = await issueCode(ctx, target._id);
  ctx.scheduler.runAfter(0, internal.emailActions.sendVerificationCode, {
    to: target.email,
    name: target.name,
    code,
  });
  await logAudit(ctx, target._id, action, "users", String(target._id), "password reset code queued");
  return { ok: true };
}

/**
 * Login-page fallback: "Didn't receive your temporary password?". This used to
 * replace the password with a new temporary one, so anyone who knew an email
 * could lock that person out. It now sends a reset code instead, and the
 * current password keeps working until the code is used (resetPasswordWithCode).
 */
export const resendTempPasswordByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => sendResetCode(ctx, email, "auth.password_resend_by_email"),
});

/**
 * Email-verified fallback for the forced change-password page: send a 6-digit
 * code to the signed-in user's email. The code lets them set a new password
 * without knowing the (missed) temporary one.
 */
export const requestTempAuthCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new ConvexError("Not authenticated");
    if (!me.email) throw new ConvexError("No email is attached to this account");

    const code = await issueCode(ctx, userId);

    // Queue the code email to the action runner (mutations can't fetch).
    ctx.scheduler.runAfter(0, internal.emailActions.sendVerificationCode, {
      to: me.email,
      name: me.name,
      code,
    });
    await logAudit(ctx, userId, "auth.code_requested", "users", String(userId), "verification code queued");
    return { emailSent: true };
  },
});

/**
 * Set a new password after verifying the emailed code — the "get me a code to
 * authenticate" path. Skips the temporary-password requirement entirely.
 */
export const setMyPasswordWithCode = mutation({
  args: { code: v.string(), newPassword: v.string() },
  handler: async (ctx, { code, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new ConvexError("Not authenticated");

    // the new password is checked first, so a weak one does not use up the code
    validateNewPassword(newPassword);
    await assertNotReused(ctx, userId, newPassword);
    const wrong = await checkCode(ctx, userId, code);
    if (wrong) return { ok: false as const, error: wrong };

    const hash = bcrypt.hashSync(newPassword, 10);
    await upsertPassword(ctx, userId, hash);
    await ctx.db.patch(userId, {
      mustChangePassword: false,
      passwordChangedAt: Date.now(),
      tempAuthCode: undefined,
      tempAuthCodeExpiresAt: undefined,
    });
    await logAudit(
      ctx,
      userId,
      "auth.password_set_via_code",
      "users",
      String(userId),
    );
    return { ok: true as const };
  },
});

/**
 * AUTH-PAGE reset (no session): email a 6-digit password-reset code.
 *
 * This is the "get me a code to authenticate" flow from the sign-in screen.
 * Generic reply — never reveals whether the account exists or its role.
 */
export const requestPasswordResetCode = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => sendResetCode(ctx, email, "auth.reset_code_requested"),
});

/**
 * AUTH-PAGE reset (no session): set a new password after verifying the emailed
 * code. The code is stored on the user row with a 10-minute expiry.
 */
export const resetPasswordWithCode = mutation({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  handler: async (ctx, { email, code, newPassword }) => {
    const normalized = email.trim().toLowerCase();
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .unique();
    if (!target) throw new ConvexError("No account found with this email.");
    if (target.isActive === false) {
      throw new ConvexError("This account has been deactivated. Contact your administrator.");
    }

    // The code is checked first: a wrong code must learn nothing about this account's old passwords.
    // If the new password is then refused, the throw undoes the code being used up, so it can be tried again.
    const wrong = await checkCode(ctx, target._id, code);
    if (wrong) return { ok: false as const, error: wrong };
    validateNewPassword(newPassword);
    await assertNotReused(ctx, target._id, newPassword);

    const hash = bcrypt.hashSync(newPassword, 10);
    await upsertPassword(ctx, target._id, hash);
    await ctx.db.patch(target._id, {
      mustChangePassword: false,
      passwordChangedAt: Date.now(),
      tempAuthCode: undefined,
      tempAuthCodeExpiresAt: undefined,
    });
    await logAudit(
      ctx,
      target._id,
      "auth.password_reset_via_code",
      "users",
      String(target._id),
    );
    return { ok: true as const };
  },
});

/** Whether the current user has a password set (drives the Settings UI). */
export const hasPassword = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const row = await ctx.db
      .query("passwords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row !== null;
  },
});
