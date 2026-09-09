"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHmac } from "node:crypto";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { PLANS, razorpayConfigured } from "./billing";

const basicAuth = () =>
  "Basic " +
  Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create a Razorpay order for a plan. Returns the order id + public key id so
 * the client can open Razorpay Checkout. No money moves here.
 */
export const createOrder = action({
  args: { planCode: v.string() },
  handler: async (ctx, args) => {
    if (!razorpayConfigured()) {
      throw new Error(
        "Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the project Keys tab.",
      );
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in.");

    const user = await ctx.runQuery(api.users.currentUser);
    const plan = PLANS.find((p) => p.code === args.planCode);
    if (!plan) throw new Error("Unknown plan.");
    if (plan.price <= 0) {
      throw new Error(
        "This plan is custom-priced — contact sales@shine.dejoiy.com.",
      );
    }

    const orgId = await ctx.runQuery(api.billing.myOrgId);
    const receipt = `shine-${userId.slice(-8)}-${Date.now()}`;

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: basicAuth(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.price,
        currency: plan.currency,
        receipt,
        notes: {
          plan: plan.code,
          user: user?.email ?? userId,
          org: orgId ?? "none",
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(
        `Razorpay order failed (${res.status}): ${detail.slice(0, 300)}`,
      );
    }
    const order = (await res.json()) as {
      id: string;
      amount: number;
      currency: string;
    };

    await ctx.runMutation(api.billing.recordOrder, {
      userId,
      orgId: orgId ?? undefined,
      planCode: plan.code,
      planName: plan.name,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      receipt,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID!,
    };
  },
});

/**
 * Verify a completed Razorpay payment. Recomputes the HMAC-SHA256 signature
 * from {order_id}|{payment_id} with the key secret — if it matches, the
 * payment was genuinely captured by Razorpay and we record it as paid.
 */
export const verifyPayment = action({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    if (!razorpayConfigured()) {
      throw new Error("Razorpay is not configured.");
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("You must be signed in.");

    const expected = createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET!,
    )
      .update(`${args.orderId}|${args.paymentId}`)
      .digest("hex");
    if (expected !== args.signature) {
      throw new Error("Payment signature verification failed.");
    }

    // Mark the payment paid + upgrade the org plan (server-verified, so this
    // is not trusting the client — the signature check above already proves
    // Razorpay captured the payment).
    await ctx.runMutation(api.billing.markPaid, {
      orderId: args.orderId,
      paymentId: args.paymentId,
      signature: args.signature,
    });

    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------
// Production-grade payment webhooks (payment.captured / subscription events)
// are handled by the self-hosted NestJS backend (server/src/billing) which
// runs in production with RAZORPAY_WEBHOOK_SECRET. The web app relies on the
// signature-verified verifyPayment action above — the standard Razorpay
// Checkout flow — so no extra public endpoint is needed here.
