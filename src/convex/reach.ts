import { getAuthUserId } from "@convex-dev/auth/server";
import { v, ConvexError } from "convex/values";
import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isSuperAdmin, logAudit } from "./users";

/**
 * Everyone on Shine and Dejoiy Mail sees their own company. On top of that,
 * employees can reach supervisors (team leads up to admins and IT) at the other
 * companies on the same infrastructure. Admins and IT admins switch this on or
 * off for their company, and for single people.
 */
export const SUPERVISOR_ROLES = new Set(["tl", "om", "director", "president", "it", "super_it", "admin", "client_admin", "dejoiy_admin", "super_admin"]);
const PLATFORM = new Set(["super_admin", "dejoiy_admin", "super_it"]); // may set any company
const COMPANY = new Set(["admin", "client_admin", "it"]); // may set their own company
export const ROLE_LABEL: Record<string, string> = {
  tl: "Team lead", om: "Operations manager", director: "Director", president: "President", it: "IT",
  super_it: "IT admin", admin: "Admin", client_admin: "Company admin", dejoiy_admin: "DEJOIY admin", super_admin: "Super admin",
};

export const domainOf = (email?: string | null) => (email ?? "").toLowerCase().split("@")[1] ?? "";
type Ctx = QueryCtx | MutationCtx;

async function policy(ctx: Ctx, domain: string) {
  return await ctx.db.query("reachPolicies").withIndex("by_domain", (q) => q.eq("domain", domain)).unique();
}

/** May this person reach supervisors at other companies? On by default. */
export async function mayReach(ctx: Ctx, me: Doc<"users">) {
  if (me.reachSupervisors !== undefined) return me.reachSupervisors;
  return (await policy(ctx, domainOf(me.email)))?.enabled ?? true;
}

/** DEJOIY's platform admins and Joi may start a conversation with anyone, on any domain. */
export const reachesEveryone = (me: Doc<"users">) => PLATFORM.has(me.role ?? "") || isSuperAdmin(me) || me.source === "joi";

/**
 * @allS (everyone on Shine and Dejoiy Mail, every domain): DEJOIY's super admins and IT,
 * admins and IT on DEJOIY's own domains, or anyone granted the permission.
 * Keep in step with src/lib/permissions.ts isHigherManagement.
 */
export function canMentionEveryone(me: Doc<"users">) {
  if (PLATFORM.has(me.role ?? "") || isSuperAdmin(me)) return true;
  const dejoiy = (process.env.JOI_INTERNAL_DOMAINS ?? "dejoiy.com,mail.dejoiy.com").split(",").map((d) => d.trim().toLowerCase());
  if ((me.role === "admin" || me.role === "it") && dejoiy.includes(domainOf(me.email))) return true;
  return me.approvedPermissions?.includes("all_users_mention") ?? false;
}

/** Can `me` start a chat with `target`? Same company always; Joi always; other companies only their supervisors. */
export async function canContact(ctx: Ctx, me: Doc<"users">, target: Doc<"users">) {
  if (target.isActive === false) return false;
  if (reachesEveryone(me)) return true;
  if (domainOf(me.email) && domainOf(me.email) === domainOf(target.email)) return true;
  if (target.source === "joi") return true;
  return SUPERVISOR_ROLES.has(target.role ?? "") && (await mayReach(ctx, me));
}

async function reachableFor(ctx: Ctx, me: Doc<"users">) {
  const everyone = reachesEveryone(me);
  if (!everyone && !(await mayReach(ctx, me))) return [];
  const mine = domainOf(me.email);
  const users = await ctx.db.query("users").collect();
  return users
    .filter((u) => u._id !== me._id && u.isActive !== false && u.email && domainOf(u.email) !== mine && (everyone || SUPERVISOR_ROLES.has(u.role ?? "")))
    .map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      image: u.image,
      designation: [u.designation || ROLE_LABEL[u.role ?? ""], u.company || domainOf(u.email)].filter(Boolean).join(" · "),
      department: u.department,
      customStatus: u.customStatus,
      company: u.company || domainOf(u.email),
      role: u.role,
      crossCompany: true as const,
    }));
}

/** Supervisors at other companies you may message (for New chat and Contacts). */
export const supervisors = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const me = userId ? await ctx.db.get(userId) : null;
    return me ? await reachableFor(ctx, me) : [];
  },
});

/** Dejoiy Mail asks the same for a mailbox (its contacts and address suggestions). */
export const supervisorsForMail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const me = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.trim().toLowerCase())).first();
    if (!me || me.isActive === false) return null;
    return (await reachableFor(ctx, me)).map(({ name, email, role, company, customStatus }) => ({ name, email, title: ROLE_LABEL[role ?? ""] ?? "", company, status: customStatus ?? "" }));
  },
});

async function adminOf(ctx: MutationCtx | QueryCtx, domain?: string) {
  const userId = await getAuthUserId(ctx);
  const me = userId ? await ctx.db.get(userId) : null;
  if (!me) throw new ConvexError("Sign in first.");
  const role = me.role ?? "";
  const target = (domain ?? domainOf(me.email)).toLowerCase();
  if (PLATFORM.has(role) || (COMPANY.has(role) && target === domainOf(me.email))) return { me, domain: target, platform: PLATFORM.has(role) };
  throw new ConvexError("Only admins and IT admins can change this.");
}

/** For the admin console: the company switch and everyone's own setting. */
export const settings = query({
  args: { domain: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { domain, platform } = await adminOf(ctx, args.domain);
    const domains = platform
      ? [...new Set((await ctx.db.query("users").collect()).map((u) => domainOf(u.email)).filter(Boolean))].sort()
      : [domain];
    const people = (await ctx.db.query("users").collect())
      .filter((u) => domainOf(u.email) === domain && u.isActive !== false && u.source !== "joi")
      .map((u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, supervisor: SUPERVISOR_ROLES.has(u.role ?? ""), reach: u.reachSupervisors ?? null }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return { domain, domains, enabled: (await policy(ctx, domain))?.enabled ?? true, people };
  },
});

export const setCompany = mutation({
  args: { domain: v.optional(v.string()), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { me, domain } = await adminOf(ctx, args.domain);
    const row = await policy(ctx, domain);
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { enabled: args.enabled, updatedBy: me._id, updatedAt: now });
    else await ctx.db.insert("reachPolicies", { domain, enabled: args.enabled, updatedBy: me._id, updatedAt: now });
    await logAudit(ctx, me._id, "reach.company", "reachPolicies", domain, args.enabled ? "on" : "off");
  },
});

/** One person: true / false, or null to follow the company setting again. */
export const setPerson = mutation({
  args: { userId: v.id("users"), enabled: v.union(v.boolean(), v.null()) },
  handler: async (ctx, { userId, enabled }) => {
    const target = await ctx.db.get(userId);
    if (!target) throw new ConvexError("No such person.");
    const { me } = await adminOf(ctx, domainOf(target.email));
    await ctx.db.patch(userId as Id<"users">, { reachSupervisors: enabled ?? undefined });
    await logAudit(ctx, me._id, "reach.person", "users", String(userId), enabled === null ? "company default" : enabled ? "on" : "off");
  },
});
