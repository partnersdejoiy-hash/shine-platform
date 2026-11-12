import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
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
const MAIL_PHOTO = /\/api\/(public\/)?avatar\?/; // a photo that came from Dejoiy Mail

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
    const image = c.photo || (user.image && MAIL_PHOTO.test(user.image) ? undefined : user.image);
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
      if (user.isActive === false || user.chatOff) {
        throw new ConvexError("This account has been deactivated. Contact your administrator.");
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
      source: "dejoiy-mail",
      role: roleFromMail(isSuperAdminEmail(c.email), c.admin, undefined) as Role,
    });
    await ensureEmployeeId(ctx, userId);
    return userId;
  },
});

// ---- Everyone in Dejoiy Mail is in Shine ------------------------------------
// Every 15 minutes (crons.ts) Shine reads all mailboxes from Dejoiy Mail and
// keeps its users in step: new mailboxes appear (so you can chat with someone
// before they ever open Shine), names/roles/photos follow, closed or locked
// mailboxes are switched off. Shine-only accounts (made inside Shine) are left alone.

const person = v.object({
  email: v.string(),
  name: v.string(),
  active: v.boolean(),
  admin: v.string(),
  department: v.string(),
  title: v.string(),
  photo: v.string(),
});

export const applyDirectory = internalMutation({
  args: { people: v.array(person) },
  handler: async (ctx, { people }) => {
    const seen = new Set<string>();
    let created = 0;
    for (const p of people) {
      const email = p.email.toLowerCase();
      seen.add(email);
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      const c = { email, name: p.name, admin: p.admin, photo: p.photo };
      if (!user) {
        const userId = await ctx.db.insert("users", {
          email,
          name: p.name || email.split("@")[0],
          company: email.split("@")[1],
          department: p.department || undefined,
          designation: p.title || undefined,
          image: p.photo || undefined,
          isActive: p.active,
          source: "dejoiy-mail",
          role: roleFromMail(isSuperAdminEmail(email), p.admin, undefined) as Role,
        });
        await ensureEmployeeId(ctx, userId);
        created++;
        continue;
      }
      await applyMail(ctx, user, c);
      const patch: Partial<Doc<"users">> = { source: "dejoiy-mail" };
      if (p.name && p.name !== user.name) patch.name = p.name;
      if (!user.department && p.department) patch.department = p.department;
      if (!user.designation && p.title) patch.designation = p.title;
      if (user.isActive !== p.active) patch.isActive = p.active;
      await ctx.db.patch(user._id, patch);
    }
    // mailboxes that are gone from Dejoiy Mail can no longer use Shine
    let closed = 0;
    for (const u of await ctx.db.query("users").collect()) {
      if (u.source === "dejoiy-mail" && u.email && !seen.has(u.email.toLowerCase()) && u.isActive !== false) {
        await ctx.db.patch(u._id, { isActive: false });
        closed++;
      }
    }
    return { people: people.length, created, closed };
  },
});

export const syncDirectory = internalAction({
  args: {},
  handler: async (ctx): Promise<{ people: number; created: number; closed: number } | null> => {
    const base = process.env.DEJOIY_MAIL_URL;
    const secret = process.env.DEJOIY_MAIL_SSO_SECRET;
    if (!base || !secret) return null; // not connected to Dejoiy Mail (e.g. a local dev copy)
    const res = await fetch(`${base}/api/shine/directory`, { headers: { Authorization: `Bearer ${secret}` } });
    if (!res.ok) throw new ConvexError(`Dejoiy Mail directory: HTTP ${res.status}`);
    const { people } = (await res.json()) as { people: Array<Record<string, unknown>> };
    const clean = (people ?? []).map((p) => ({
      email: String(p.email ?? ""),
      name: String(p.name ?? ""),
      active: p.active !== false,
      admin: p.admin === "platform" || p.admin === "company" ? String(p.admin) : "",
      department: String(p.department ?? ""),
      title: String(p.title ?? ""),
      photo: typeof p.photo === "string" && p.photo.startsWith("https://") ? p.photo : "",
    })).filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email));
    // an empty answer would switch everyone off; treat it as a failed read instead
    if (clean.length === 0) throw new ConvexError("Dejoiy Mail directory came back empty");
    return await ctx.runMutation(internal.dejoiyMail.applyDirectory, { people: clean });
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

/** Photos uploaded in Shine (not the ones that came from Dejoiy Mail), so Dejoiy Mail can show them too. */
export const shinePhotos = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: Record<string, string> = {};
    for (const u of await ctx.db.query("users").take(5000)) {
      const email = u.email?.toLowerCase();
      if (email && u.source !== "joi" && u.image?.startsWith("https://") && !MAIL_PHOTO.test(u.image)) out[email] = u.image;
    }
    return out;
  },
});

/**
 * One profile photo for Shine and Dejoiy Mail. Dejoiy Mail keeps the photos;
 * a photo changed there arrives here (POST /dejoiy/photo), and one uploaded
 * here is sent there (pushPhoto), so both apps always show the same picture.
 */
export const photoFromMail = internalMutation({
  args: { email: v.string(), photo: v.string() },
  handler: async (ctx, { email, photo }) => {
    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.trim().toLowerCase())).first();
    if (!user || user.source === "joi") return false;
    const old = user.avatarStorageId;
    await ctx.db.patch(user._id, { image: photo, avatarStorageId: "" });
    if (old) {
      try {
        await ctx.storage.delete(old as never);
      } catch {
        /* already gone, or a self-hosted key */
      }
    }
    return true;
  },
});

export const pushPhoto = action({
  // a small square picture (data: URL) made in the browser, or "" when the photo was removed
  args: { image: v.string() },
  handler: async (ctx, { image }): Promise<boolean> => {
    const userId: Id<"users"> | null = await getAuthUserId(ctx);
    if (!userId) return false;
    const me = await ctx.runQuery(internal.dejoiyMail.emailOf, { userId });
    const base = process.env.DEJOIY_MAIL_URL;
    const secret = process.env.DEJOIY_MAIL_SSO_SECRET;
    if (!me || !base || !secret) return false;
    if (image && !/^data:image\/(png|jpeg|webp);base64,/.test(image)) return false;
    const res = await fetch(`${base}/api/shine/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email: me, image }),
    });
    return res.ok;
  },
});

export const emailOf = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.email?.toLowerCase() ?? null,
});
