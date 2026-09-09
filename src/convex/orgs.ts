import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, logAudit } from "./users";

// ---- Organizations ----------------------------------------------------------

/** Normalize an org domain to lowercase, no whitespace, no "@" or scheme. */
export function normalizeDomain(raw?: string): string | undefined {
  if (!raw) return undefined;
  let d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.replace(/^@/, "").replace(/\/.*$/, "").split("/")[0].trim();
  if (!d || d.length < 3 || !d.includes(".")) return undefined;
  return d;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    logo: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { name, description, logo, domain }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const now = Date.now();
    const normalizedDomain = normalizeDomain(domain);
    if (domain && !normalizedDomain) throw new Error("Invalid domain — use the form company.com");
    if (normalizedDomain) {
      const dup = await ctx.db
        .query("organizations")
        .withIndex("by_domain", (q) => q.eq("domain", normalizedDomain))
        .collect();
      if (dup.length > 0) throw new Error(`Domain ${normalizedDomain} is already registered by another organization`);
    }
    const orgId = await ctx.db.insert("organizations", {
      name,
      description,
      logo,
      ownerId: user._id,
      plan: "enterprise",
      domain: normalizedDomain,
      createdAt: now,
    });
    await ctx.db.insert("organizationMembers", {
      orgId,
      userId: user._id,
      role: "owner",
      joinedAt: now,
    });
    await logAudit(ctx, user._id, "org.created", "organizations", String(orgId), name, String(orgId));
    return orgId;
  },
});

export const myOrgs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.orgId);
        return org ? { ...org, myRole: m.role, joinedAt: m.joinedAt, department: m.department, designation: m.designation } : null;
      }),
    );
    return orgs.filter((o): o is NonNullable<typeof o> => o !== null);
  },
});

export const orgDetail = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!membership) return null;

    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const memberUsers = await Promise.all(
      members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return u ? { ...u, orgRole: m.role, joinedAt: m.joinedAt } : null;
      }),
    );

    const teams = await ctx.db.query("teams").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
    const teamWithCounts = await Promise.all(
      teams.map(async (t) => {
        const tms = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", t._id)).collect();
        return { ...t, memberCount: tms.length };
      }),
    );

    const channels = await ctx.db
      .query("conversations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("kind"), "channel"))
      .collect();

    const tasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();

    return {
      org,
      myRole: membership.role,
      members: memberUsers.filter((m): m is NonNullable<typeof m> => m !== null),
      teams: teamWithCounts,
      channels,
      tasks,
    };
  },
});

export const update = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    logo: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Only owners/admins can update the organization");
    }
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (typeof patch.domain === "string") {
      const normalized = normalizeDomain(patch.domain);
      if (!normalized) throw new Error("Invalid domain — use the form company.com");
      clean.domain = normalized;
      const dup = await ctx.db
        .query("organizations")
        .withIndex("by_domain", (q) => q.eq("domain", normalized))
        .collect();
      if (dup.some((o) => o._id !== orgId)) {
        throw new Error(`Domain ${normalized} is already registered by another organization`);
      }
    }
    if (Object.keys(clean).length) await ctx.db.patch(orgId, clean);
    await logAudit(ctx, userId, "org.updated", "organizations", String(orgId), "", String(orgId));
  },
});

/**
 * Domain-based auto-provisioning: after sign-in, any user whose email belongs
 * to an organization's registered domain is automatically added as a member
 * (role "member") — no manual invite needed. Safe to call on every login; it
 * never downgrades or duplicates existing memberships.
 */
export const autoJoinByEmailDomain = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.email) return { joined: [] as string[] };
    const domain = user.email.slice(user.email.lastIndexOf("@") + 1).toLowerCase();
    const orgs = await ctx.db
      .query("organizations")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .collect();
    const joined: string[] = [];
    for (const org of orgs) {
      const existing = await ctx.db
        .query("organizationMembers")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .filter((q) => q.eq(q.field("userId"), user._id))
        .unique();
      if (!existing) {
        await ctx.db.insert("organizationMembers", {
          orgId: org._id,
          userId: user._id,
          role: "member",
          joinedAt: Date.now(),
        });
        joined.push(org.name);
      }
    }
    if (joined.length > 0) {
      await logAudit(ctx, user._id, "org.auto_joined_by_domain", "organizations", "", joined.join(", "), "");
    }
    return { joined };
  },
});

/** Which domain is registered for an org (used by the org settings UI). */
export const domainForOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!membership) return null;
    return org.domain ?? null;
  },
});

export const invite = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.optional(v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))),
    department: v.optional(v.string()),
    designation: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, email, role = "member", department, designation }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), actor._id))
      .unique();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error("Only owners/admins can invite members");
    }
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
    if (!target) throw new Error("No SHINE account found for that email");
    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), target._id))
      .unique();
    if (existing) throw new Error("That user is already a member");
    await ctx.db.insert("organizationMembers", {
      orgId,
      userId: target._id,
      role,
      department,
      designation,
      joinedAt: Date.now(),
    });
    await ctx.db.insert("notifications", {
      userId: target._id,
      kind: "org_invite",
      title: `You were added to ${(await ctx.db.get(orgId))?.name ?? "an organization"}`,
      body: `Invited by ${actor.name ?? "a teammate"}`,
      link: "/app/organizations",
      read: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, actor._id, "org.member_invited", "organizations", String(orgId), email, String(orgId));
  },
});

export const setMemberRole = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, { orgId, userId, role }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), actor._id))
      .unique();
    if (!membership || membership.role !== "owner") throw new Error("Only the owner can change roles");
    const target = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!target) throw new Error("Not a member");
    await ctx.db.patch(target._id, { role });
    await logAudit(ctx, actor._id, "org.member_role_changed", "organizations", String(orgId), `${userId} -> ${role}`, String(orgId));
  },
});

export const removeMember = mutation({
  args: { orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, { orgId, userId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), actor._id))
      .unique();
    if (!membership || membership.role !== "owner") throw new Error("Only the owner can remove members");
    const target = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    if (!target) throw new Error("Not a member");
    await ctx.db.delete(target._id);
    await logAudit(ctx, actor._id, "org.member_removed", "organizations", String(orgId), String(userId), String(orgId));
  },
});

// ---- Teams ------------------------------------------------------------------

export const createTeam = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, name, description }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const teamId = await ctx.db.insert("teams", {
      orgId,
      name,
      description,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("teamMembers", { teamId, userId: user._id, role: "lead", joinedAt: Date.now() });
    await logAudit(ctx, user._id, "team.created", "teams", String(teamId), name, String(orgId));
    return teamId;
  },
});

export const teamDetail = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const team = await ctx.db.get(teamId);
    if (!team) return null;
    const tms = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).collect();
    const members = await Promise.all(
      tms.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return u ? { ...u, teamRole: m.role } : null;
      }),
    );
    const channels = await ctx.db
      .query("conversations")
      .withIndex("by_org", (q) => q.eq("orgId", team.orgId))
      .filter((q) => q.eq(q.field("teamId"), teamId))
      .collect();
    return {
      team,
      members: members.filter((m): m is NonNullable<typeof m> => m !== null),
      channels,
    };
  },
});

export const addTeamMember = mutation({
  args: { teamId: v.id("teams"), userId: v.id("users"), role: v.optional(v.union(v.literal("lead"), v.literal("member"))) },
  handler: async (ctx, { teamId, userId, role = "member" }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    const existing = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).filter((q) => q.eq(q.field("userId"), userId)).unique();
    if (existing) throw new Error("Already on the team");
    await ctx.db.insert("teamMembers", { teamId, userId, role, joinedAt: Date.now() });
  },
});

export const removeTeamMember = mutation({
  args: { teamId: v.id("teams"), userId: v.id("users") },
  handler: async (ctx, { teamId, userId }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    const existing = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).filter((q) => q.eq(q.field("userId"), userId)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
