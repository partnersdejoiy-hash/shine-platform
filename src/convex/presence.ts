import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Presence and written status, shared by Shine and Dejoiy Mail (like Gmail's
 * Active / Away / Do not disturb, and WhatsApp's status line).
 * One presence row per person; whichever app is open keeps it fresh.
 */
export type Choice = "auto" | "away" | "busy" | "invisible";
export const choiceValidator = v.union(v.literal("auto"), v.literal("away"), v.literal("busy"), v.literal("invisible"));
export const STATUS_MAX = 140;
const FRESH = 120_000; // no heartbeat for 2 minutes = offline

export const cleanStatus = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, STATUS_MAX);

/** What the person shows as, from their choice and whether they're idle. */
export function statusFor(choice: Choice | undefined, idle: boolean) {
  if (choice === "invisible") return "invisible" as const;
  if (choice === "busy") return "busy" as const;
  if (choice === "away" || idle) return "away" as const;
  return "online" as const;
}

/** One heartbeat from any app (Shine or Dejoiy Mail). */
export async function beat(ctx: MutationCtx, user: Doc<"users">, idle: boolean) {
  const now = Date.now();
  // a timed choice ("Away for 15 min") has run out: back to automatic
  if (user.presenceUntil && user.presenceUntil <= now) {
    await ctx.db.patch(user._id, { presenceChoice: "auto", presenceUntil: undefined });
    user = { ...user, presenceChoice: "auto", presenceUntil: undefined };
  }
  const status = statusFor(user.presenceChoice, idle);
  const row = await ctx.db.query("presence").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
  if (row) await ctx.db.patch(row._id, { status, updatedAt: now, customStatus: user.customStatus });
  else await ctx.db.insert("presence", { userId: user._id, status, updatedAt: now, customStatus: user.customStatus });
  await ctx.db.patch(user._id, { lastSeen: now });
  return status;
}

/** Save someone's choice and/or written status, and show it right away. */
export async function setOwn(ctx: MutationCtx, userId: Id<"users">, change: { choice?: Choice; text?: string; minutes?: number }) {
  const patch: Partial<Doc<"users">> = {};
  if (change.choice) {
    patch.presenceChoice = change.choice;
    // minutes: hold this choice for a while (5 min to 24 h), then go back to automatic
    const m = change.choice === "auto" ? 0 : Math.min(Math.max(Math.round(change.minutes ?? 0), 0), 1440);
    patch.presenceUntil = m >= 5 ? Date.now() + m * 60_000 : undefined;
  }
  if (change.text !== undefined) patch.customStatus = cleanStatus(change.text) || undefined;
  if (Object.keys(patch).length) await ctx.db.patch(userId, patch);
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const row = await ctx.db.query("presence").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  const idle = row?.status === "away" && user.presenceChoice !== "away";
  if (row && Date.now() - row.updatedAt < FRESH) await beat(ctx, user, idle);
  else if (row) await ctx.db.patch(row._id, { customStatus: user.customStatus });
  return { choice: user.presenceChoice ?? "auto", text: user.customStatus ?? "", until: user.presenceUntil ?? null };
}

/** What others see: Active / Away / Busy / Offline (appear-offline shows as Offline). */
export function seenAs(row: Doc<"presence"> | null) {
  if (!row || row.status === "offline" || row.status === "invisible" || Date.now() - row.updatedAt > FRESH) return "offline" as const;
  return row.status;
}

const byEmail = (ctx: MutationCtx, email: string) =>
  ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.trim().toLowerCase())).first();

/** Dejoiy Mail: a heartbeat, a new choice, or a new written status for one mailbox. */
export const fromMail = internalMutation({
  args: { email: v.string(), idle: v.optional(v.boolean()), choice: v.optional(choiceValidator), text: v.optional(v.string()) },
  handler: async (ctx, { email, idle, choice, text }) => {
    const user = await byEmail(ctx, email);
    if (!user || user.isActive === false) return null;
    if (choice !== undefined || text !== undefined) await setOwn(ctx, user._id, { choice, text });
    if (idle !== undefined) await beat(ctx, (await ctx.db.get(user._id))!, idle);
    const fresh = (await ctx.db.get(user._id))!;
    return { choice: fresh.presenceChoice ?? "auto", text: fresh.customStatus ?? "" };
  },
});

/** Dejoiy Mail: presence and written status for a batch of mailboxes. */
export const forMail = internalQuery({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const out: Record<string, { status: string; text: string }> = {};
    for (const raw of emails.slice(0, 200)) {
      const email = raw.trim().toLowerCase();
      const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
      if (!user || user.isActive === false) continue;
      const row = await ctx.db.query("presence").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
      out[email] = { status: seenAs(row), text: user.customStatus ?? "" };
    }
    return out;
  },
});
