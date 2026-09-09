import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// =============================================================================
// SHINE Billing — Razorpay integration (Powered by DEJOIY)
// -----------------------------------------------------------------------------
// Server-side money handling, always. Secrets live in the project's Keys tab:
//   RAZORPAY_KEY_ID          (public identifier, safe to send to the client)
//   RAZORPAY_KEY_SECRET      (private — only read in billingNode.ts actions)
//   RAZORPAY_WEBHOOK_SECRET  (optional — verifies webhook callbacks)
//
// Node-runtime functions (createOrder / verifyPayment / razorpayWebhook) live
// in billingNode.ts ("use node"). This file holds the catalog + data layer.
// =============================================================================

/** Public plan catalog (prices in paise — Razorpay's smallest unit for INR). */
export const PLANS = [
  {
    code: "free",
    name: "Free",
    price: 0,
    period: "month",
    currency: "INR",
    tagline: "For small teams getting started",
    features: [
      "Up to 10 employees",
      "1-to-1 chat, calls & meetings",
      "Standard support",
    ],
  },
  {
    code: "starter",
    name: "Starter",
    price: 49900, // ₹499
    period: "month",
    currency: "INR",
    tagline: "For growing teams",
    features: [
      "Up to 50 employees",
      "Group chats & channels",
      "HD meetings + screen share",
      "Email support",
    ],
  },
  {
    code: "professional",
    name: "Professional",
    price: 199900, // ₹1,999
    period: "month",
    currency: "INR",
    tagline: "For scaling organisations",
    features: [
      "Up to 500 employees",
      "Recordings, live captions & breakout rooms",
      "Advanced admin & compliance",
      "Priority support",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: 0,
    period: "custom",
    currency: "INR",
    tagline: "Custom licensing for large enterprises",
    features: [
      "Unlimited employees",
      "SSO / SCIM / audit & legal hold",
      "Dedicated success manager",
      "Custom SLA & onboarding",
    ],
  },
] as const;

export type PlanCode = (typeof PLANS)[number]["code"];

/** Whether Razorpay keys are present (populated from the Keys tab). */
export const razorpayConfigured = () =>
  !!(process.env.RAZORPAY_KEY_ID ?? "").trim() &&
  !!(process.env.RAZORPAY_KEY_SECRET ?? "").trim();

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Plan catalog + whether the deployment is ready to take payments. */
export const plans = query({
  args: {},
  handler: async () => ({
    configured: razorpayConfigured(),
    plans: PLANS.map((p) => ({ ...p })),
  }),
});

/** The caller's first organization id, if any. */
export const myOrgId = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const member = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return member?.orgId ?? null;
  },
});

/** Billing overview for the current user: org plan + payment history. */
export const billingOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const member = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    let plan = "free";
    if (member) {
      const org = await ctx.db.get(member.orgId);
      plan = org?.plan ?? "free";
    }
    const history = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(25);
    return { plan, history, configured: razorpayConfigured() };
  },
});

// ---------------------------------------------------------------------------
// Mutations (called from billingNode.ts actions via ctx.runMutation)
// ---------------------------------------------------------------------------

/** Internal: create a payments row in `created` state. */
export const recordOrder = mutation({
  args: {
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    planCode: v.string(),
    planName: v.string(),
    amount: v.number(),
    currency: v.string(),
    orderId: v.string(),
    receipt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("payments", {
      userId: args.userId,
      orgId: args.orgId,
      planCode: args.planCode,
      planName: args.planName,
      amount: args.amount,
      currency: args.currency,
      orderId: args.orderId,
      receipt: args.receipt,
      status: "created",
      createdAt: Date.now(),
    });
  },
});

/** Internal: lookup one payment by Razorpay order id. */
export const paymentByOrder = query({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

/** Internal: mark a payment paid (verified) and upgrade the org plan. */
export const markPaid = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.optional(v.string()),
    signature: v.optional(v.string()),
    method: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    if (!payment) throw new Error("Unknown order.");
    if (payment.status === "paid") return payment;

    await ctx.db.patch(payment._id, {
      status: "paid",
      paymentId: args.paymentId,
      signature: args.signature,
      method: args.method,
    });

    // Upgrade the organization's plan so role gating reflects the new tier.
    if (payment.orgId) {
      const org = await ctx.db.get(payment.orgId);
      if (org) {
        const rank = (code: string) => PLANS.findIndex((p) => p.code === code);
        const current = rank(org.plan ?? "free");
        const next = rank(payment.planCode);
        if (next > current || payment.planCode === "enterprise") {
          await ctx.db.patch(payment.orgId, { plan: payment.planCode });
        }
      }
    }
    return payment;
  },
});
