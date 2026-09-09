import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { ROLE_RANK } from "./admin";
import { generateTempPassword } from "./passwords";
import bcrypt from "bcryptjs";
import { getCurrentUser, isSuperAdmin, logAudit } from "./users";

/**
 * SHINE Enterprise Access-Request Ticketing.
 *
 * Any employee can open a ticket (\"I need permission X\", \"promote me to Y\").
 * The ticket is forwarded UP the role hierarchy — every role above the
 * requester gets a chance to approve in order, and the FINAL approval always
 * rests with the super admin (the apex of the hierarchy).
 *
 * Ticket numbers look like DJT12345 (DJT + five random digits) and are unique
 * forever. Every decision is recorded (who, when, comment) for auditability.
 *
 * Ticket lifecycle:
 *   pending → (picked up) → in_progress → approved | rejected | resolved
 *   resolved = password-recovery ticket where a tagged admin emailed the user
 *              a fresh temporary password.
 *
 * Email notifications (from ticketing@dejoiy.com) fire on: created, picked up,
 * status change and final status. Mutations can't fetch, so emails are queued
 * to the action runner via ctx.scheduler.runAfter.
 */

const VALID_ROLES = new Set([
  "super_admin",
  "dejoiy_admin",
  "admin",
  "super_it",
  "it",
  "president",
  "director",
  "om",
  "tl",
  "client_admin",
  "user",
  "member",
]);

/** Roles that can review tickets directly (god authority on any ticket). */
const REVIEWER_ROLES = new Set(["super_admin", "dejoiy_admin", "admin"]);

function rankOf(user: { role?: string | null } | null | undefined): number {
  if (!user) return -1;
  if (isSuperAdmin(user)) return 10;
  return ROLE_RANK[user.role ?? "user"] ?? 0;
}

/** In-app notification row. */
async function notifyUser(
  ctx: any,
  userId: string,
  title: string,
  body: string,
  link: string,
) {
  await ctx.db.insert("notifications", {
    userId,
    kind: "ticket",
    title,
    body,
    link,
    read: false,
    createdAt: Date.now(),
  });
}

/** Queue a branded ticket email to the action runner (mutations can't fetch). */
function queueTicketEmail(
  ctx: any,
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  ctx.scheduler.runAfter(0, api.emailActions.sendTicketEmail, { to, subject, html, text });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Branded ticket email body. */
function ticketEmailBody(ticketNumber: string, title: string, lines: string[]): { html: string; text: string } {
  const body = lines.map((l) => `<p style="margin:6px 0;color:#e8e8e8;font-size:14px">${l}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#0B0B0B;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0B">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141414;border:1px solid rgba(212,175,55,0.35);border-radius:18px;overflow:hidden">
          <tr><td style="padding:26px 30px 6px">
            <div style="font-size:20px;font-weight:700;color:#D4AF37">SHINE</div>
            <div style="font-size:11px;color:#8A8F98;margin-top:2px">Enterprise Ticketing · Powered by DEJOIY</div>
          </td></tr>
          <tr><td style="padding:10px 30px 4px">
            <span style="display:inline-block;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.4);color:#D4AF37;font-size:12px;font-weight:700;padding:3px 10px;border-radius:6px">${ticketNumber}</span>
            <span style="color:#ffffff;font-size:16px;font-weight:600;margin-left:10px">${esc(title)}</span>
          </td></tr>
          <tr><td style="padding:14px 30px 22px">${body}</td></tr>
          <tr><td style="padding:12px 30px;background:#0F0F0F;border-top:1px solid rgba(255,255,255,0.06)">
            <div style="font-size:11px;color:#8A8F98">Track this ticket in SHINE → App → Access requests.</div>
            <div style="font-size:11px;color:#8A8F98;margin-top:4px">Powered by SHINE · Developed by DEJOIY India Private Limited</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
  const text = `[${ticketNumber}] ${title}\n\n${lines.join("\n")}\n\nTrack it in SHINE → App → Access requests.`;
  return { html, text };
}

/** Build the ordered approver chain for a requester (lowest above → super admin last). */
async function buildApproverChain(ctx: any, requester: any): Promise<Id<"users">[]> {
  const requesterRank = rankOf(requester);
  const allUsers = await ctx.db.query("users").take(2000);
  const approvers = allUsers.filter((u: any) => {
    if (!u || u.isActive === false) return false;
    if (String(u._id) === String(requester._id)) return false;
    return rankOf(u) > requesterRank;
  });
  approvers.sort((a: any, b: any) => rankOf(a) - rankOf(b));
  // Super admin must always have the final word — move them to the end.
  const sorted = [...approvers];
  const saIndex = sorted.findIndex((u: any) => isSuperAdmin(u));
  if (saIndex >= 0 && saIndex !== sorted.length - 1) {
    const [sa] = sorted.splice(saIndex, 1);
    sorted.push(sa);
  }
  return sorted.map((u: any) => u._id as Id<"users">);
}

/** All super-admin + DEJOIY-admin + admin accounts — the dedicated ticket department. */
async function getTicketDepartment(ctx: any): Promise<Id<"users">[]> {
  const allUsers = await ctx.db.query("users").take(2000);
  return allUsers
    .filter(
      (u: any) =>
        u.isActive !== false && REVIEWER_ROLES.has(u.role ?? ""),
    )
    .sort((a: any, b: any) => rankOf(b) - rankOf(a))
    .map((u: any) => u._id as Id<"users">);
}

async function generateTicketNumber(ctx: any): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const digits = String(Math.floor(10000 + Math.random() * 90000));
    const number = `DJT${digits}`;
    const existing = await ctx.db
      .query("tickets")
      .withIndex("by_ticket_number", (q: any) => q.eq("ticketNumber", number))
      .unique();
    if (!existing) return number;
  }
  return `DJT${String(Date.now() % 100000).padStart(5, "0")}`;
}

/** Any signed-in employee can open an access-request ticket. */
export const createTicket = mutation({
  args: {
    kind: v.union(
      v.literal("permission"),
      v.literal("role"),
      v.literal("general"),
      v.literal("password"),
      v.literal("support"),
      v.literal("org_update"),
    ),
    target: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("urgent"),
        v.literal("critical"),
      ),
    ),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { kind, target, title, description, priority, category }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const cleanTarget = target.trim();
    if (!cleanTarget) throw new Error("Target is required");

    if (kind === "role" && !VALID_ROLES.has(cleanTarget)) {
      throw new Error(`Unknown role \"${cleanTarget}\"`);
    }
    if (kind === "role") {
      const tgtRank = ROLE_RANK[cleanTarget] ?? 0;
      if (tgtRank >= rankOf(me)) {
        throw new Error(
          `You are already at or above the ${cleanTarget} level — no promotion ticket needed`,
        );
      }
    }

    // No pending duplicate for the same kind + target.
    const pending = await ctx.db
      .query("tickets")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", me._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    const dup = pending.find(
      (t) => t.kind === kind && t.target.toLowerCase() === cleanTarget.toLowerCase(),
    );
    if (dup) {
      throw new Error(`You already have a pending ticket (${dup.ticketNumber}) for this`);
    }

    // If the requester is the apex (super admin), there is nobody to ask.
    if (rankOf(me) >= 10) {
      throw new Error("The super admin already holds the highest role in the hierarchy");
    }

    const chain = await buildApproverChain(ctx, me);
    if (chain.length === 0) {
      throw new Error("No approver exists above your role — contact the super admin directly");
    }

    const now = Date.now();
    const ticketNumber = await generateTicketNumber(ctx);
    const ticketId = await ctx.db.insert("tickets", {
      ticketNumber,
      requesterId: me._id,
      kind,
      target: cleanTarget,
      title: title?.trim() || `${kind === "role" ? "Role request" : kind === "support" ? "Support request" : "Access request"}: ${cleanTarget}`,
      description: description?.trim() || undefined,
      status: "pending" as const,
      priority: priority ?? "normal",
      category: category?.trim() || undefined,
      approverChain: chain,
      currentLevel: 0,
      decisions: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
    });

    const firstApprover = await ctx.db.get(chain[0]);
    await notifyUser(
      ctx,
      chain[0],
      `Ticket ${ticketNumber} needs your approval`,
      `${me.name ?? me.email ?? "Someone"} is requesting: ${title?.trim() || cleanTarget}`,
      "/app/tickets",
    );
    // Email notifications — ticket created (requester) + first approver.
    if (me.email) {
      queueTicketEmail(
        ctx,
        me.email,
        `Ticket ${ticketNumber} created — ${title?.trim() || cleanTarget}`,
        ...ticketEmailLines(ticketNumber, title?.trim() || cleanTarget, [
          `Hi ${me.name ?? "there"}, your ticket was created and is climbing the approval chain.`,
          `First approver: ${firstApprover?.name ?? "the next level"}. You'll be notified on every status change.`,
        ]),
      );
    }
    if (firstApprover?.email) {
      queueTicketEmail(
        ctx,
        firstApprover.email,
        `Ticket ${ticketNumber} needs your approval`,
        ...ticketEmailLines(ticketNumber, title?.trim() || cleanTarget, [
          `${me.name ?? "An employee"} is requesting: ${title?.trim() || cleanTarget}.`,
          `Open SHINE → Access requests to approve or reject with a comment.`,
        ]),
      );
    }
    await logAudit(
      ctx,
      me._id,
      "ticket.created",
      "tickets",
      String(ticketId),
      `${ticketNumber} · ${kind} · ${cleanTarget} → ${firstApprover?.name ?? "?"}`,
    );
    return { ticketId, ticketNumber, chain };
  },
});

function ticketEmailLines(
  ticketNumber: string,
  title: string,
  lines: string[],
): [string, string] {
  const { html, text } = ticketEmailBody(ticketNumber, title, lines);
  return [html, text];
}

/** Resolve a ticket with requester + chain members + notes authors hydrated. */
async function hydrate(ctx: any, tickets: any[]) {
  const out = [];
  for (const t of tickets) {
    const requester = await ctx.db.get(t.requesterId);
    const chain = await Promise.all(
      (t.approverChain ?? []).map((id: any) => ctx.db.get(id)),
    );
    const decisions = [];
    for (const d of t.decisions ?? []) {
      const approver = await ctx.db.get(d.approverId);
      decisions.push({ ...d, approver });
    }
    const notes = [];
    for (const n of t.notes ?? []) {
      const author = await ctx.db.get(n.authorId);
      notes.push({ ...n, author });
    }
    const pickedUpBy = t.pickedUpBy ? await ctx.db.get(t.pickedUpBy) : undefined;
    out.push({ ...t, requester, chain, decisions, notes, pickedUpBy });
  }
  return out;
}

/** My own tickets (all statuses). */
export const myTickets = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("tickets")
      .withIndex("by_requester", (q: any) => q.eq("requesterId", me._id))
      .order("desc")
      .take(100);
    return hydrate(ctx, rows);
  },
});

/**
 * Tickets waiting on my approval.
 *
 * Reviewers (super admin / DEJOIY admin / admin) see EVERY open ticket —
 * god authority means they can approve or reject any pending ticket directly,
 * not just the one waiting at their own level. Everyone else sees tickets
 * only when it is their turn in the chain.
 */
export const approvalQueue = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    // Include all non-terminal statuses: pending, in_progress, new, open,
    // escalated, waiting_for_user, waiting_for_approval, reopened.
    // Excluded: approved, rejected, resolved, cancelled.
    const terminal = new Set(["approved", "rejected", "resolved", "cancelled"]);
    const allRows = await ctx.db
      .query("tickets")
      .order("desc")
      .take(500);
    const activeRows = allRows.filter((t) => !terminal.has(t.status));
    const isReviewer = REVIEWER_ROLES.has(me.role ?? "");
    const mine = activeRows.filter((t) => {
      const chain = t.approverChain ?? [];
      const atTurn = chain[t.currentLevel ?? 0] === me._id;
      if (atTurn) return true;
      // Requester can see their own active tickets.
      if (t.requesterId === me._id) return true;
      // Picked-up tickets show for the picker.
      if (t.pickedUpBy === me._id) return true;
      // Reviewers can act on any open ticket.
      if (isReviewer) return true;
      return false;
    });
    return hydrate(ctx, mine);
  },
});

/** Every ticket ever (Admin / DEJOIY Admin / Super Admin console view). */
export const allTickets = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (
      !me ||
      !(isSuperAdmin(me) || me.role === "dejoiy_admin" || me.role === "admin")
    ) {
      throw new Error("Admin only");
    }
    const rows = await ctx.db.query("tickets").order("desc").take(300);
    return hydrate(ctx, rows);
  },
});

/** Any chain member or reviewer can add a teammate note on a ticket. */
export const addTicketNote = mutation({
  args: { ticketId: v.id("tickets"), text: v.string() },
  handler: async (ctx, { ticketId, text }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    const clean = text.trim();
    if (!clean) throw new Error("Note cannot be empty");

    const isRequester = String(ticket.requesterId) === String(me._id);
    const inChain = (ticket.approverChain ?? []).some(
      (id: any) => String(id) === String(me._id),
    );
    const isReviewer = REVIEWER_ROLES.has(me.role ?? "");
    if (!isRequester && !inChain && !isReviewer) {
      throw new Error("Only the requester, approvers or admins can add notes");
    }

    const notes = [...(ticket.notes ?? []), { authorId: me._id, text: clean, at: Date.now() }];
    await ctx.db.patch(ticketId, { notes, updatedAt: Date.now() });
    await logAudit(ctx, me._id, "ticket.note_added", "tickets", String(ticketId), ticket.ticketNumber);
    return true;
  },
});

/** Pick up a ticket — status pending → in_progress (assigned to the actor). */
export const pickupTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "pending" && ticket.status !== "in_progress") {
      throw new Error("Only open tickets can be picked up");
    }
    const inChain = (ticket.approverChain ?? []).some(
      (id: any) => String(id) === String(me._id),
    );
    const isReviewer = REVIEWER_ROLES.has(me.role ?? "");
    if (!inChain && !isReviewer) {
      throw new Error("Only tagged approvers or admins can pick up this ticket");
    }

    await ctx.db.patch(ticketId, {
      status: "in_progress",
      pickedUpBy: me._id,
      pickedUpAt: Date.now(),
      updatedAt: Date.now(),
    });
    await notifyUser(
      ctx,
      ticket.requesterId,
      `Ticket ${ticket.ticketNumber} picked up`,
      `${me.name ?? "A teammate"} is now handling your ticket: ${ticket.title}`,
      "/app/tickets",
    );
    const requester = await ctx.db.get(ticket.requesterId);
    if (requester?.email) {
      queueTicketEmail(
        ctx,
        requester.email,
        `Ticket ${ticket.ticketNumber} picked up`,
        ...ticketEmailLines(ticket.ticketNumber, ticket.title, [
          `Good news — ${me.name ?? "a teammate"} picked up your ticket and is working on it.`,
          `Status is now: in progress.`,
        ]),
      );
    }
    await logAudit(ctx, me._id, "ticket.picked_up", "tickets", String(ticketId), ticket.ticketNumber);
    return { status: "in_progress" };
  },
});

/**
 * The current actor's decision on a ticket. Reject at any level closes it.
 * Reviewers (super admin / DEJOIY admin / admin) may decide any open ticket.
 */
export const decideTicket = mutation({
  args: {
    ticketId: v.id("tickets"),
    approve: v.boolean(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { ticketId, approve, comment }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "pending" && ticket.status !== "in_progress") {
      throw new Error("This ticket is already closed");
    }

    const chain = ticket.approverChain ?? [];
    const level = ticket.currentLevel ?? 0;
    const currentApprover = chain[level];
    const isReviewer = REVIEWER_ROLES.has(me.role ?? "");
    const canDecide =
      String(currentApprover) === String(me._id) ||
      (isReviewer && (ticket.kind === "password" || (ticket.approverChain ?? []).some((id: any) => String(id) === String(me._id)) || isSuperAdmin(me)));
    if (!canDecide) {
      throw new Error("This ticket is not waiting on your approval");
    }

    const now = Date.now();
    const decisions = [...(ticket.decisions ?? [])];
    const requester = await ctx.db.get(ticket.requesterId);

    if (!approve) {
      decisions.push({ approverId: me._id, action: "rejected", comment, at: now });
      await ctx.db.patch(ticketId, {
        status: "rejected",
        decisions,
        reviewedBy: me._id,
        reviewedAt: now,
        updatedAt: now,
      });
      await notifyUser(
        ctx,
        ticket.requesterId,
        `Ticket ${ticket.ticketNumber} rejected`,
        `${ticket.title} was rejected by ${me.name ?? me.email}${comment ? ` — ${comment}` : ""}`,
        "/app/tickets",
      );
      if (requester?.email) {
        queueTicketEmail(
          ctx,
          requester.email,
          `Ticket ${ticket.ticketNumber} rejected`,
          ...ticketEmailLines(ticket.ticketNumber, ticket.title, [
            `Your ticket was rejected by ${me.name ?? "an approver"}${comment ? ` with the note: “${comment}”` : ""}.`,
            `You can reply with a note or raise a new request.`,
          ]),
        );
      }
      await logAudit(
        ctx,
        me._id,
        "ticket.rejected",
        "tickets",
        String(ticketId),
        `${ticket.ticketNumber} · ${comment ?? ""}`,
      );
      return { status: "rejected" };
    }

    decisions.push({ approverId: me._id, action: "approved", comment, at: now });

    const isFinal = level >= chain.length - 1;
    if (isFinal) {
      // FINAL approval — grant what was requested.
      if (ticket.kind === "permission") {
        const current = (requester?.approvedPermissions ?? []) as string[];
        if (!current.includes(ticket.target)) {
          await ctx.db.patch(ticket.requesterId, {
            approvedPermissions: [...current, ticket.target],
          });
        }
      } else if (ticket.kind === "role") {
        const tgtRank = ROLE_RANK[ticket.target] ?? 0;
        if (tgtRank > 0 && tgtRank < 10) {
          await ctx.db.patch(ticket.requesterId, { role: ticket.target as any });
        }
      } else if (ticket.kind === "org_update") {
        // Find the org by name and move the user into it.
        const allOrgs = await ctx.db.query("organizations").collect();
        const match = allOrgs.find(
          (o) => o.name.toLowerCase() === ticket.target.toLowerCase(),
        );
        if (match) {
          // Remove old memberships
          const oldMembers = await ctx.db
            .query("organizationMembers")
            .withIndex("by_user", (q: any) => q.eq("userId", ticket.requesterId))
            .collect();
          for (const m of oldMembers) await ctx.db.delete(m._id);
          // Add new membership
          await ctx.db.insert("organizationMembers", {
            orgId: match._id,
            userId: ticket.requesterId,
            role: "member",
            department: requester?.department,
            designation: requester?.designation,
            joinedAt: now,
          });
          await ctx.db.patch(ticket.requesterId, { company: match.name });
        }
      } else if (ticket.kind === "general") {
        // For general tickets, try to auto-assign org if target matches one.
        const allOrgs = await ctx.db.query("organizations").collect();
        const match = allOrgs.find(
          (o) => o.name.toLowerCase() === ticket.target.toLowerCase(),
        );
        if (match) {
          const oldMembers = await ctx.db
            .query("organizationMembers")
            .withIndex("by_user", (q: any) => q.eq("userId", ticket.requesterId))
            .collect();
          for (const m of oldMembers) await ctx.db.delete(m._id);
          await ctx.db.insert("organizationMembers", {
            orgId: match._id,
            userId: ticket.requesterId,
            role: "member",
            department: requester?.department,
            designation: requester?.designation,
            joinedAt: now,
          });
          await ctx.db.patch(ticket.requesterId, { company: match.name });
        }
      }
      await ctx.db.patch(ticketId, {
        status: "approved",
        decisions,
        reviewedBy: me._id,
        reviewedAt: now,
        updatedAt: now,
      });
      await notifyUser(
        ctx,
        ticket.requesterId,
        `Ticket ${ticket.ticketNumber} approved 🎉`,
        `${ticket.title} was fully approved by ${me.name ?? me.email}`,
        "/app/tickets",
      );
      if (requester?.email) {
        queueTicketEmail(
          ctx,
          requester.email,
          `Ticket ${ticket.ticketNumber} approved 🎉`,
          ...ticketEmailLines(ticket.ticketNumber, ticket.title, [
            `Congratulations — your ticket was fully approved by ${me.name ?? "the final approver"}.`,
            `The requested ${ticket.kind} (${ticket.target}) has been granted.`,
          ]),
        );
      }
      await logAudit(
        ctx,
        me._id,
        "ticket.approved",
        "tickets",
        String(ticketId),
        `${ticket.ticketNumber} · granted ${ticket.kind}:${ticket.target}`,
      );
      return { status: "approved" };
    }

    // Advance to the next approver up the hierarchy.
    await ctx.db.patch(ticketId, {
      decisions,
      currentLevel: level + 1,
      updatedAt: now,
    });
    const nextApprover = await ctx.db.get(chain[level + 1]);
    await notifyUser(
      ctx,
      chain[level + 1],
      `Ticket ${ticket.ticketNumber} forwarded to you`,
      `${ticket.title} (requested by ${requester?.name ?? "someone"}) was approved by ${me.name ?? me.email} — now awaiting your decision`,
      "/app/tickets",
    );
    await notifyUser(
      ctx,
      ticket.requesterId,
      `Ticket ${ticket.ticketNumber} moved up`,
      `${me.name ?? "An approver"} approved — the ticket is now with ${nextApprover?.name ?? "the next level"}`,
      "/app/tickets",
    );
    if (requester?.email) {
      queueTicketEmail(
        ctx,
        requester.email,
        `Ticket ${ticket.ticketNumber} status update`,
        ...ticketEmailLines(ticket.ticketNumber, ticket.title, [
          `${me.name ?? "An approver"} approved — your ticket moved to the next level (${nextApprover?.name ?? "next approver"}).`,
        ]),
      );
    }
    if (nextApprover?.email) {
      queueTicketEmail(
        ctx,
        nextApprover.email,
        `Ticket ${ticket.ticketNumber} needs your approval`,
        ...ticketEmailLines(ticket.ticketNumber, ticket.title, [
          `${requester?.name ?? "An employee"} is requesting: ${ticket.title}.`,
          `Open SHINE → Access requests to approve or reject with a comment.`,
        ]),
      );
    }
    await logAudit(
      ctx,
      me._id,
      "ticket.forwarded",
      "tickets",
      String(ticketId),
      `${ticket.ticketNumber} → level ${level + 1}`,
    );
    return { status: "pending", level: level + 1 };
  },
});

/**
 * Password-recovery ticket (created from the AUTH page — no session needed).
 *
 * Tagged staff = the dedicated ticket department (super admin + DEJOIY admin +
 * admin). They receive in-app + email notifications and can send a fresh
 * temporary password to the requester's email directly from the ticket
 * (see sendTempPasswordForTicket).
 *
 * Never reveals whether the account exists — always answers generically.
 */
export const createPasswordTicket = mutation({
  args: { email: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, { email, description }) => {
    const normalized = email.trim().toLowerCase();
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q: any) => q.eq("email", normalized))
      .unique();
    // Generic reply — no account existence leak.
    if (!target || !target.email || target.isActive === false) {
      return { ok: true };
    }

    const department = await getTicketDepartment(ctx);
    if (department.length === 0) return { ok: true };

    const now = Date.now();
    const ticketNumber = await generateTicketNumber(ctx);
    const ticketId = await ctx.db.insert("tickets", {
      ticketNumber,
      requesterId: target._id,
      kind: "password",
      target: "password_recovery",
      title: `Password recovery request — ${target.name ?? target.email}`,
      description:
        description?.trim() ||
        "User could not sign in and requested a password reset via the auth page.",
      status: "pending",
      approverChain: department,
      currentLevel: 0,
      decisions: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
    });

    // Notify every tagged staff member (in-app + email).
    for (const staffId of department) {
      await notifyUser(
        ctx,
        staffId,
        `Password ticket ${ticketNumber} needs attention`,
        `${target.name ?? target.email} requested a password reset — send them a temporary password.`,
        "/app/tickets",
      );
      const staff = await ctx.db.get(staffId);
      if (staff?.email) {
        queueTicketEmail(
          ctx,
          staff.email,
          `Password ticket ${ticketNumber} needs attention`,
          ...ticketEmailLines(ticketNumber, "Password recovery request", [
            `${target.name ?? target.email} requested a password reset from the sign-in page.`,
            `Open SHINE → Access requests → ticket ${ticketNumber} and tap “Send temporary password” to email them one automatically.`,
          ]),
        );
      }
    }
    await logAudit(
      ctx,
      target._id,
      "ticket.password_created",
      "tickets",
      String(ticketId),
      `${ticketNumber} · ${target.email}`,
    );
    return { ok: true };
  },
});

/**
 * Tagged staff (super admin / DEJOIY admin / admin / IT) send a fresh
 * temporary password to the ticket requester's email — fully automated.
 * The ticket moves to status "resolved".
 */
export const sendTempPasswordForTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.kind !== "password") {
      throw new Error("Only password-recovery tickets support this action");
    }
    if (ticket.status === "rejected" || ticket.status === "cancelled" || ticket.status === "resolved") {
      throw new Error("This ticket is already closed");
    }

    const inChain = (ticket.approverChain ?? []).some(
      (id: any) => String(id) === String(me._id),
    );
    const isReviewer = REVIEWER_ROLES.has(me.role ?? "");
    if (!inChain && !isReviewer) {
      throw new Error("Only tagged admins can send a temporary password for this ticket");
    }

    const requester = await ctx.db.get(ticket.requesterId);
    if (!requester?.email) throw new Error("The requester has no email address");

    const tempPassword = generateTempPassword();
    const hash = bcrypt.hashSync(tempPassword, 10);
    // Upsert the bcrypt hash (reuse passwords.upsertPassword logic inline).
    const existing = await ctx.db
      .query("passwords")
      .withIndex("by_user", (q: any) => q.eq("userId", requester._id))
      .unique();
    if (existing) {
      const history = existing.history ?? [];
      await ctx.db.patch(existing._id, {
        hash,
        history: [existing.hash, ...history].slice(0, 5),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("passwords", {
        userId: requester._id,
        hash,
        history: [],
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(requester._id, {
      mustChangePassword: true,
      passwordChangedAt: undefined,
      tempAuthCode: undefined,
      tempAuthCodeExpiresAt: undefined,
    });

    // Queue the temp-password email (action runner — mutations can't fetch).
    ctx.scheduler.runAfter(0, api.emailActions.sendTempPassword, {
      to: requester.email,
      name: requester.name,
      tempPassword,
    });

    await ctx.db.patch(ticketId, {
      status: "resolved",
      pickedUpBy: me._id,
      pickedUpAt: Date.now(),
      reviewedBy: me._id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await notifyUser(
      ctx,
      requester._id,
      `Ticket ${ticket.ticketNumber} resolved`,
      `A temporary password was emailed to you — sign in and set your own password.`,
      "/app/tickets",
    );
    await logAudit(
      ctx,
      me._id,
      "ticket.password_sent",
      "tickets",
      String(ticketId),
      `${ticket.ticketNumber} · temp password emailed to ${requester.email}`,
    );
    return { status: "resolved", emailSent: true };
  },
});

/** The requester can cancel their own pending ticket. */
export const cancelTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (String(ticket.requesterId) !== String(me._id)) {
      throw new Error("Only the requester can cancel this ticket");
    }
    if (ticket.status !== "pending" && ticket.status !== "in_progress") {
      throw new Error("Only open tickets can be cancelled");
    }
    await ctx.db.patch(ticketId, { status: "cancelled", updatedAt: Date.now() });
    await logAudit(ctx, me._id, "ticket.cancelled", "tickets", String(ticketId), ticket.ticketNumber);
  },
});

/** Super admin cleanup — permanently remove a test/duplicate ticket. */
export const adminDeleteTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!isSuperAdmin(me)) throw new Error("Super admin only");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    await ctx.db.delete(ticketId);
    await logAudit(
      ctx,
      me._id,
      "ticket.deleted",
      "tickets",
      String(ticketId),
      ticket.ticketNumber,
    );
    return true;
  },
});

/** Requester can reopen a resolved/rejected ticket if not yet cancelled. */
export const reopenTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (String(ticket.requesterId) !== String(me._id)) {
      throw new Error("Only the requester can reopen this ticket");
    }
    if (ticket.status !== "resolved" && ticket.status !== "rejected") {
      throw new Error("Only resolved or rejected tickets can be reopened");
    }
    const now = Date.now();
    const decisions = [...(ticket.decisions ?? []), {
      approverId: me._id,
      action: "commented" as const,
      comment: "Ticket reopened by requester",
      at: now,
    }];
    await ctx.db.patch(ticketId, { status: "reopened", decisions, updatedAt: now });
    await logAudit(ctx, me._id, "ticket.reopened", "tickets", String(ticketId), ticket.ticketNumber);
    return true;
  },
});

/** Assign a ticket to a specific user (admin only). */
export const assignTicket = mutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.id("users"),
  },
  handler: async (ctx, { ticketId, assigneeId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(isSuperAdmin(me) || me.role === "admin")) throw new Error("Admin only");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    const now = Date.now();
    const decisions = [...(ticket.decisions ?? []), {
      approverId: me._id,
      action: "commented" as const,
      comment: `Assigned to user`,
      at: now,
    }];
    await ctx.db.patch(ticketId, {
      status: "assigned",
      assignedTo: assigneeId,
      assignedAt: now,
      decisions,
      updatedAt: now,
    });
    await logAudit(ctx, me._id, "ticket.assigned", "tickets", String(ticketId), ticket.ticketNumber);
    return true;
  },
});

/** Escalate a ticket to the next level (admin only). */
export const escalateTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, { ticketId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    if (!(isSuperAdmin(me) || me.role === "admin")) throw new Error("Admin only");
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status === "cancelled" || ticket.status === "resolved") {
      throw new Error("Cannot escalate a closed ticket");
    }
    const now = Date.now();
    const decisions = [...(ticket.decisions ?? []), {
      approverId: me._id,
      action: "commented" as const,
      comment: "Ticket escalated",
      at: now,
    }];
    await ctx.db.patch(ticketId, { status: "escalated", decisions, updatedAt: now });
    await logAudit(ctx, me._id, "ticket.escalated", "tickets", String(ticketId), ticket.ticketNumber);
    return true;
  },
});
