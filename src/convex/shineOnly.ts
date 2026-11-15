import { v, ConvexError } from "convex/values";
import bcrypt from "bcryptjs";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { sendResend, SHINE_EMAIL_FROM } from "./emailProvider";
import { PASSWORD_MIN_LENGTH } from "./passwords";
import { linkPaidSince, shinePrice, SHINE_PRICE, TRIAL_DAYS, DAY } from "./lib/shinePlan";

/**
 * Shine on its own, for companies without Dejoiy Mail: they sign up here with their work email and a
 * password, invite colleagues on the same email domain, and pay per person on Dejoiy Pay
 * (₹29 a person a month, or ₹240 a year, plus 18% GST). Companies on Dejoiy Mail get Shine with their
 * mail plan instead (companyPlan.ts).
 *
 * Settings (Convex env, from /etc/shine/pay.env): DEJOIY_PAY_KEY_ID, DEJOIY_PAY_KEY_SECRET,
 * optional DEJOIY_PAY_WEBHOOK_SECRET, optional DEJOIY_PAY_URL (default https://pay.dejoiy.com).
 */

// people share a company by email domain in Shine, so a public mail service can't be one
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "rediffmail.com", "zoho.com", "zohomail.in",
  "yandex.com", "gmx.com", "mail.com", "tutanota.com",
]);
const EMAIL = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/;
const domainOf = (email: string) => email.split("@")[1] ?? "";
const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

async function domainTaken(ctx: MutationCtx, domain: string) {
  const org = await ctx.db.query("organizations").withIndex("by_domain", (q) => q.eq("domain", domain)).first();
  const someone = (await ctx.db.query("users").collect()).some((u) => domainOf((u.email ?? "").toLowerCase()) === domain);
  return !!org || someone;
}

/** Step 1: a company signs up. Sends a 6-digit code to the work email; nothing is created yet. */
export const startSignup = mutation({
  args: { name: v.string(), company: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase(), name = args.name.trim(), company = args.company.trim();
    if (!EMAIL.test(email)) throw new ConvexError("Enter your work email address.");
    const domain = domainOf(email);
    if (FREE_MAIL.has(domain)) throw new ConvexError("Use your company's email address (not Gmail, Yahoo or Outlook): your colleagues join by the same domain.");
    if (name.length < 2 || name.length > 80) throw new ConvexError("Enter your name.");
    if (company.length < 2 || company.length > 80) throw new ConvexError("Enter your company's name.");
    if (args.password.length < PASSWORD_MIN_LENGTH || args.password.length > 200) throw new ConvexError(`Use a password of at least ${PASSWORD_MIN_LENGTH} characters.`);
    if (await domainTaken(ctx, domain)) throw new ConvexError(`${domain} is already on Shine. Ask your company's admin to add you, or sign in.`);
    const old = await ctx.db.query("shineSignups").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (old && old.expiresAt - 29 * 60_000 > Date.now()) throw new ConvexError("A code was just sent. Wait a minute before asking for another.");
    if (old) await ctx.db.delete(old._id);
    const code = code6();
    await ctx.db.insert("shineSignups", { email, name, company, hash: bcrypt.hashSync(args.password, 10), code, tries: 0, expiresAt: Date.now() + 30 * 60_000 });
    await ctx.scheduler.runAfter(0, internal.shineOnly.sendCode, { email, name, code });
    return { ok: true };
  },
});

export const sendCode = internalAction({
  args: { email: v.string(), name: v.string(), code: v.string() },
  handler: async (_ctx, { email, name, code }) => {
    const out = await sendResend({
      from: SHINE_EMAIL_FROM.auth,
      to: email,
      subject: `${code} is your Shine sign-up code`,
      text: `Hi ${name},\n\nYour Shine sign-up code is ${code}. It works for 30 minutes.\n\nIf you didn't sign up for Shine, ignore this mail.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:16px;color:#121212"><p>Hi ${escapeHtml(name)},</p><p>Your Shine sign-up code:</p><p style="font-size:34px;font-weight:800;letter-spacing:8px;background:#d4ff3a;display:inline-block;padding:10px 18px;border-radius:14px">${code}</p><p>It works for 30 minutes. If you didn't sign up for Shine, ignore this mail.</p></div>`,
    });
    if (!out.ok) console.error("Shine sign-up code not sent:", out.error);
  },
});
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Step 2: the code is right, so the person, their password and their company are made. Then they sign in. */
export const finishSignup = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const row = await ctx.db.query("shineSignups").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (!row || row.expiresAt < Date.now()) throw new ConvexError("That code has run out. Start again to get a new one.");
    if (row.code !== args.code.trim()) {
      if (row.tries >= 4) await ctx.db.delete(row._id);
      else await ctx.db.patch(row._id, { tries: row.tries + 1 });
      throw new ConvexError(row.tries >= 4 ? "Too many wrong codes. Start again." : "That code isn't right.");
    }
    const domain = domainOf(email);
    if (await domainTaken(ctx, domain)) throw new ConvexError(`${domain} is already on Shine. Ask your company's admin to add you.`);
    const now = Date.now();
    const userId = await ctx.db.insert("users", { email, name: row.name, emailVerificationTime: now, role: "user", isActive: true } as any);
    await ctx.db.insert("passwords", { userId, hash: row.hash, history: [], updatedAt: now });
    const orgId = await ctx.db.insert("organizations", {
      name: row.company, ownerId: userId, plan: "shine", domain, shineOnly: true, trialEnds: now + TRIAL_DAYS * DAY, createdAt: now,
    });
    await ctx.db.insert("organizationMembers", { orgId, userId, role: "owner", joinedAt: now } as any);
    await ctx.db.delete(row._id);
    return { ok: true };
  },
});

/** The signed-in person's Shine-only company, if they're in one. */
async function myShineOrg(ctx: { db: any }, userId: Id<"users">) {
  const rows: Doc<"organizationMembers">[] = await ctx.db.query("organizationMembers").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect();
  for (const m of rows) {
    const org: Doc<"organizations"> | null = await ctx.db.get(m.orgId);
    if (org?.shineOnly) return { org, member: m };
  }
  return null;
}
const isOrgAdmin = (m: { role: string }) => m.role === "owner" || m.role === "admin";

/** Billing page: the company's state, seats used, prices and payments. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const mine = await myShineOrg(ctx, userId);
    if (!mine) return null;
    const { org, member } = mine;
    const people = (await ctx.db.query("organizationMembers").withIndex("by_org", (q: any) => q.eq("orgId", org._id)).collect()).length;
    const now = Date.now(), paidUntil = org.paidUntil ?? 0, trialEnds = org.trialEnds ?? org.createdAt + TRIAL_DAYS * DAY;
    const state = paidUntil > now ? "active" : trialEnds > now && !paidUntil ? "trial" : "expired";
    const ends = state === "active" ? paidUntil : state === "trial" ? trialEnds : Math.max(paidUntil, trialEnds);
    const payments = isOrgAdmin(member)
      ? (await ctx.db.query("payments").collect()).filter((p) => p.orgId === org._id && p.orderId.startsWith("plink_")).sort((a, b) => b.createdAt - a.createdAt).slice(0, 12)
      : [];
    return {
      orgId: org._id, company: org.name, domain: org.domain, admin: isOrgAdmin(member), people, seats: org.seats ?? null,
      state, ends, daysLeft: Math.max(0, Math.ceil((ends - now) / DAY)),
      price: SHINE_PRICE, payReady: !!(process.env.DEJOIY_PAY_KEY_ID && process.env.DEJOIY_PAY_KEY_SECRET),
      payMode: (process.env.DEJOIY_PAY_KEY_ID ?? "").startsWith("dp_live_") ? "live" : "test",
      payments: payments.map((p) => ({ id: p.orderId, amount: p.amount, seats: p.seats ?? null, period: p.period ?? null, status: p.status, url: p.status === "created" ? p.url : undefined, createdAt: p.createdAt })),
    };
  },
});

/** Add a colleague (same email domain): they get a temporary password by email. Admins only, within paid seats. */
export const invite = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");
    const mine = await myShineOrg(ctx, userId);
    if (!mine || !isOrgAdmin(mine.member)) throw new ConvexError("Only your company's Shine admin can add people.");
    const { org } = mine;
    const email = args.email.trim().toLowerCase(), name = args.name.trim();
    if (!EMAIL.test(email) || domainOf(email) !== org.domain) throw new ConvexError(`Add people with an @${org.domain} address.`);
    if (name.length < 2) throw new ConvexError("Enter their name.");
    if (await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first()) throw new ConvexError("They're already on Shine.");
    const people = (await ctx.db.query("organizationMembers").withIndex("by_org", (q: any) => q.eq("orgId", org._id)).collect()).length;
    if ((org.paidUntil ?? 0) > Date.now() && org.seats && people >= org.seats) throw new ConvexError(`All ${org.seats} paid seats are used. Pay for more people in Billing first.`);
    const now = Date.now();
    const newId = await ctx.db.insert("users", { email, name, role: "user", isActive: true, mustChangePassword: true } as any);
    const temp = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY3479"[b % 48]).join("");
    await ctx.db.insert("passwords", { userId: newId, hash: bcrypt.hashSync(temp, 10), history: [], updatedAt: now });
    await ctx.db.insert("organizationMembers", { orgId: org._id, userId: newId, role: "member", joinedAt: now } as any);
    await ctx.scheduler.runAfter(0, api.emailActions.sendTempPassword, { to: email, name, tempPassword: temp });
    return { ok: true };
  },
});

// ---------- paying on Dejoiy Pay ----------
async function pay(path: string, method = "GET", body?: unknown) {
  const id = process.env.DEJOIY_PAY_KEY_ID, secret = process.env.DEJOIY_PAY_KEY_SECRET;
  if (!id || !secret) throw new ConvexError("Payments are not switched on for Shine yet.");
  const base = (process.env.DEJOIY_PAY_URL ?? "https://pay.dejoiy.com").replace(/\/+$/, "");
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new ConvexError(`Dejoiy Pay said no: ${data?.error?.description ?? res.status}.`);
  return data;
}

export const orgForCheckout = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const mine = await myShineOrg(ctx, userId);
    if (!mine) return null;
    const user = await ctx.db.get(userId);
    const people = (await ctx.db.query("organizationMembers").withIndex("by_org", (q: any) => q.eq("orgId", mine.org._id)).collect()).length;
    return { org: mine.org, admin: isOrgAdmin(mine.member), people, email: user?.email ?? "", name: user?.name ?? "" };
  },
});

export const recordLink = internalMutation({
  args: { userId: v.id("users"), orgId: v.id("organizations"), linkId: v.string(), url: v.string(), amount: v.number(), seats: v.number(), period: v.union(v.literal("month"), v.literal("year")) },
  handler: async (ctx, a) => {
    await ctx.db.insert("payments", {
      userId: a.userId, orgId: a.orgId, planCode: `shine-${a.period}`, planName: `Shine · ${a.seats} people · ${a.period === "year" ? "yearly" : "monthly"}`,
      amount: a.amount, currency: "INR", orderId: a.linkId, status: "created", url: a.url, seats: a.seats, period: a.period, createdAt: Date.now(),
    });
  },
});

/** An admin pays for N people for a month or a year: a Dejoiy Pay link to open. */
export const checkout = action({
  args: { seats: v.number(), period: v.union(v.literal("month"), v.literal("year")) },
  handler: async (ctx, { seats, period }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");
    const info = await ctx.runQuery(internal.shineOnly.orgForCheckout, { userId });
    if (!info || !info.admin) throw new ConvexError("Only your company's Shine admin can pay.");
    if (!Number.isInteger(seats) || seats < info.people || seats > 5000) throw new ConvexError(`Pay for at least the ${info.people} people already on Shine.`);
    const amount = shinePrice(seats, period);
    const link = await pay("/payment_links", "POST", {
      title: `Shine · ${seats} ${seats === 1 ? "person" : "people"} (${period === "year" ? "yearly" : "monthly"})`,
      description: `${info.org.name} · ${info.org.domain} · ₹${SHINE_PRICE[period]} a person + 18% GST`,
      amount, currency: "INR", reference_id: `sh-${Math.random().toString(36).slice(2, 12)}`,
      customer: { email: info.email, name: info.name }, expire_by: Math.floor(Date.now() / 1000) + 48 * 3600,
      notify: { email: true, sms: false }, reminder_enable: false,
      notes: { product: "shine", org: String(info.org._id), seats: String(seats), period },
    });
    if (!String(link?.id ?? "").startsWith("plink_") || !String(link?.short_url ?? "").startsWith("https://")) throw new ConvexError("Dejoiy Pay sent back something unexpected. Try again.");
    await ctx.runMutation(internal.shineOnly.recordLink, { userId, orgId: info.org._id, linkId: link.id, url: link.short_url, amount, seats, period });
    return { url: link.short_url };
  },
});

export const openLinks = internalQuery({
  args: { orgId: v.optional(v.id("organizations")), linkId: v.optional(v.string()) },
  handler: async (ctx, { orgId, linkId }) => {
    if (linkId) return (await ctx.db.query("payments").withIndex("by_order", (q) => q.eq("orderId", linkId)).collect()).filter((p) => p.status === "created").map((p) => p.orderId);
    return (await ctx.db.query("payments").collect()).filter((p) => p.orgId === orgId && p.status === "created" && p.orderId.startsWith("plink_")).map((p) => p.orderId);
  },
});

/** Dejoiy Pay says the link is paid: start or extend the company's paid time. Safe to call twice. */
export const markLinkPaid = internalMutation({
  args: { linkId: v.string() },
  handler: async (ctx, { linkId }) => {
    const p = await ctx.db.query("payments").withIndex("by_order", (q) => q.eq("orderId", linkId)).first();
    if (!p || p.status === "paid" || !p.orgId || !p.period || !p.seats) return false;
    const org = await ctx.db.get(p.orgId);
    if (!org) return false;
    const until = linkPaidSince(Date.now(), org.paidUntil ?? 0, org.trialEnds ?? org.createdAt + TRIAL_DAYS * DAY, p.period);
    await ctx.db.patch(org._id, { paidUntil: until, seats: Math.max(p.seats, (org.paidUntil ?? 0) > Date.now() ? org.seats ?? 0 : 0) });
    await ctx.db.patch(p._id, { status: "paid" });
    return true;
  },
});

/** Ask Dejoiy Pay about open links (the page calls this; the webhook does the same). */
async function settle(ctx: any, ids: string[]) {
  let paid = 0;
  for (const id of ids.slice(0, 3)) {
    const link = await pay(`/payment_links/${id}`).catch(() => null);
    if (link?.status === "paid" && (await ctx.runMutation(internal.shineOnly.markLinkPaid, { linkId: id }))) paid++;
  }
  return paid;
}

export const refresh = action({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const info = await ctx.runQuery(internal.shineOnly.orgForCheckout, { userId });
    if (!info) return 0;
    return await settle(ctx, await ctx.runQuery(internal.shineOnly.openLinks, { orgId: info.org._id }));
  },
});

/** POST /dejoiy-pay/webhook: a payment went through. Dejoiy Pay itself is asked whether the link is paid. */
export const fromWebhook = internalAction({
  args: { linkId: v.string() },
  handler: async (ctx, { linkId }): Promise<number> => settle(ctx, await ctx.runQuery(internal.shineOnly.openLinks, { linkId })),
});
