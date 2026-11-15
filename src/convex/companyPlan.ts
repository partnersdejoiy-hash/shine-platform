import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Shine is not sold on its own: it comes with the company's Dejoiy Mail plan. Dejoiy Mail keeps the
 * subscription (paid through Dejoiy Pay); Shine only asks which plan the signed-in person's company is on.
 */
export type CompanyPlan = {
  domain: string;
  state: "trial" | "active" | "expired" | "internal" | "none" | "unknown";
  ends?: number;
  daysLeft?: number;
  plan?: string | null;
  planName?: string | null;
  period?: "month" | "year" | null;
  mailboxes?: number | null;
};

export const mine = action({
  args: {},
  handler: async (ctx): Promise<CompanyPlan | null> => {
    const userId = await getAuthUserId(ctx);
    const base = process.env.DEJOIY_MAIL_URL, secret = process.env.DEJOIY_MAIL_SSO_SECRET;
    if (!userId || !base || !secret) return null;
    const email = await ctx.runQuery(internal.dejoiyMail.emailOf, { userId });
    if (!email) return null;
    const res = await fetch(base + "/api/shine/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CompanyPlan;
  },
});
