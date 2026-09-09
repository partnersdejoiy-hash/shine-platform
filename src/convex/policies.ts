import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser, isSuperAdmin, logAudit } from "./users";

/**
 * Compliance: versioned policies + mandatory acknowledgements.
 *
 * A policy is a titled, version-controlled document. Only admins (super admin,
 * dejoiy admin, admin) create/publish policies. Every publish creates a NEW
 * version row — a published version is never mutated. Mandatory published
 * policies must be acknowledged at their current version; until then the
 * frontend blocks normal app use (pending-ack gate).
 *
 * Acknowledgements are append-only (history is preserved). Compliance = an ack
 * row exists for the policy's current version.
 */

type SeedPolicy = {
  title: string;
  category: string;
  summary: string;
  doc: string[];
};

/** The ten enterprise policies required before first use + platform extras. */
const SEED_POLICIES: SeedPolicy[] = [
  {
    title: "Privacy Policy",
    category: "Governance",
    summary:
      "SHINE, the enterprise communication platform of DEJOIY India Private Limited, collects and processes personal data strictly to operate your workplace communications. This policy explains what we collect, why, how long we keep it, and the rights you hold under applicable data protection law.",
    doc: [
      "1. Data we collect: account identifiers (name, email, employee ID), profile information you provide, communications you send and receive through SHINE, device and network metadata used for security, and usage analytics.",
      "2. How we use it: to deliver messaging, calling, meetings, files and collaboration; to secure the platform and investigate incidents; to comply with legal and regulatory obligations.",
      "3. Sharing: your data is never sold. It is shared with other employees of your organization only to the extent required for collaboration, and with service providers bound by data processing agreements.",
      "4. Retention: data is retained per the SHINE Retention Policy and erased or anonymised when no longer needed.",
      "5. Your rights: access, rectification, erasure, restriction, portability and objection — raise requests through your organization administrator or support@shine.dejoiy.com.",
      "6. Changes: this policy may be updated; material changes are communicated in-app and acknowledged by users.",
    ],
  },
  {
    title: "Terms of Service",
    category: "Governance",
    summary:
      "These Terms govern your use of SHINE as an employee, member or administrator of a DEJOIY customer organization. By using SHINE you agree to use it lawfully and in accordance with your organization's policies.",
    doc: [
      "1. Eligibility: you must be authorised by your organization to access SHINE. Accounts are provisioned and administered by your employer.",
      "2. Acceptable use: you may not misuse the platform — no unlawful content, harassment, impersonation, circumvention of security controls, or automated abuse.",
      "3. Your content: you retain ownership of content you post. You grant the organization a licence to store, process and administer it as required to run the workspace.",
      "4. Service availability: SHINE is provided on a best-efforts enterprise basis with defined uptime objectives; planned maintenance is scheduled outside business hours where possible.",
      "5. Termination: your organization may suspend or terminate access for breach of these Terms or its internal policies.",
    ],
  },
  {
    title: "Code of Conduct",
    category: "Governance",
    summary:
      "The DEJOIY Code of Conduct sets the standards of professional behaviour expected of every employee using SHINE and in the workplace generally.",
    doc: [
      "1. Integrity: act honestly and transparently; never misrepresent facts or use the platform to mislead.",
      "2. Fairness: treat every colleague with dignity; maintain an inclusive, harassment-free environment.",
      "3. Accountability: own your actions, your communications and your data; speak up when you see wrongdoing.",
      "4. Confidentiality: protect company, customer and personal data at all times.",
      "5. Compliance: comply with all laws and DEJOIY policies; violations are investigated and may lead to corrective action.",
    ],
  },
  {
    title: "Acceptable Use Policy",
    category: "Security",
    summary:
      "SHINE is a professional workplace tool. This policy defines what is acceptable when using messaging, channels, meetings, files and other platform features.",
    doc: [
      "1. Respect: treat colleagues with courtesy. Harassment, discrimination, threats or offensive material are prohibited and reportable.",
      "2. Confidentiality: do not share confidential, proprietary or regulated information outside authorised channels.",
      "3. Resources: use platform resources (storage, meetings, recordings) for legitimate business purposes.",
      "4. Prohibited content: no malware, phishing, spam, pirated material, or content that violates law or third-party rights.",
      "5. Reporting: violations are reported to your manager or the IT team and may result in disciplinary action.",
    ],
  },
  {
    title: "Information Security Policy",
    category: "Security",
    summary:
      "This policy establishes the security controls that protect SHINE and the data it holds, and the responsibilities of every user.",
    doc: [
      "1. Authentication: use strong, unique passwords, enable MFA, and never share credentials.",
      "2. Devices: keep devices updated, lock screens, and report lost or stolen devices to IT immediately.",
      "3. Data handling: classify and protect information; store sensitive data only in approved locations.",
      "4. Incident response: report suspected breaches, phishing or anomalies to security@shine.dejoiy.com promptly.",
      "5. Access control: least-privilege access is enforced; requests for elevated permission go through the approval workflow.",
    ],
  },
  {
    title: "Employee Communication Policy",
    category: "Governance",
    summary:
      "Guidance for clear, professional and compliant communication on SHINE — including messaging etiquette, channels and sensitive topics.",
    doc: [
      "1. Professional tone: communicate respectfully; avoid language that could be construed as aggressive or discriminatory.",
      "2. Right channel: use direct messages for individuals, channels for teams, and announcements for company-wide information.",
      "3. Work hours: respect colleagues' availability and presence settings; avoid non-urgent messages outside working hours.",
      "4. External representation: do not speak publicly on behalf of the company without authorisation.",
      "5. Record keeping: communications are business records and subject to audit and retention requirements.",
    ],
  },
  {
    title: "Data Protection Policy",
    category: "Compliance",
    summary:
      "DEJOIY implements organisational and technical measures to protect personal data processed through SHINE in line with applicable data protection regulations including the DPDP Act.",
    doc: [
      "1. Principles: lawfulness, purpose limitation, data minimisation, accuracy, storage limitation, integrity and confidentiality.",
      "2. Technical controls: encryption in transit and at rest, access controls, multi-factor authentication, audit logging and secure software development.",
      "3. Data subject rights: mechanisms to exercise access, correction, erasure and portability rights through administrators.",
      "4. Breach management: security incidents are contained, investigated and reported to regulators and affected parties where required.",
      "5. Training: employees handling personal data complete mandatory privacy and security awareness training.",
    ],
  },
  {
    title: "Meeting Recording Policy",
    category: "Meetings",
    summary:
      "Meetings may be recorded for accuracy, compliance and knowledge sharing. This policy governs when recording is allowed and how recordings are handled.",
    doc: [
      "1. Consent: participants are informed when a meeting is being recorded, in-app and by the host.",
      "2. Authorisation: recording requires host initiation; hosts are responsible for compliance with applicable laws.",
      "3. Storage: recordings are stored in approved storage, access-controlled, and deleted per the Retention Policy.",
      "4. Usage: recordings are for internal business use; external sharing requires approval.",
      "5. Transcripts: automated transcripts are treated with the same confidentiality as the recording itself.",
    ],
  },
  {
    title: "Confidentiality Agreement",
    category: "Legal",
    summary:
      "Every employee of DEJOIY India Private Limited must protect the confidential and proprietary information they access through SHINE and in the course of their work.",
    doc: [
      "1. Definition: confidential information includes business plans, customer data, financials, source code, credentials and any non-public information obtained through SHINE.",
      "2. Obligation: you may use confidential information only for your authorised duties and must not disclose it to third parties without approval.",
      "3. Safeguards: store confidential material in approved, access-controlled locations; never share it via public channels.",
      "4. Term: this obligation continues after employment ends.",
      "5. Breach: unauthorised disclosure is a serious disciplinary and potentially legal matter and must be reported immediately.",
    ],
  },
  {
    title: "Data Processing / Consent Policy",
    category: "Compliance",
    summary:
      "This policy explains how personal data is processed on your behalf through SHINE and the consent basis for that processing.",
    doc: [
      "1. Controller and processor: DEJOIY India Private Limited acts as controller for its own employee data and as processor for customer organizations using SHINE.",
      "2. Consent: by using SHINE you consent to the processing described in the Privacy Policy, which you may withdraw in accordance with applicable law.",
      "3. Lawful basis: processing is necessary for the employment/contract relationship, legal compliance, and legitimate interests.",
      "4. Sub-processors: service providers are bound by data processing agreements and may only process data per documented instructions.",
      "5. Queries: contact privacy@dejoiy.com for any consent or processing query.",
    ],
  },
  {
    title: "Retention Policy",
    category: "Compliance",
    summary:
      "SHINE retains data only for as long as it serves a legitimate business or legal purpose, after which it is securely deleted or anonymised.",
    doc: [
      "1. Messages and files: retained per organizational configuration and legal obligations, subject to audit and legal-hold requirements.",
      "2. Meeting recordings and transcripts: retained for a defined period then archived or deleted, per the Meeting Recording Policy.",
      "3. Audit logs: retained for security and compliance review periods defined by your organization.",
      "4. Account data: removed or anonymised within a defined window after deactivation.",
      "5. Legal hold: retention schedules are suspended where records are subject to litigation or regulatory holds.",
    ],
  },
  {
    title: "IT Usage Policy",
    category: "Security",
    summary:
      "Rules for the responsible use of SHINE and associated IT resources, ensuring security, performance and fair use.",
    doc: [
      "1. Authorised use: SHINE resources are provided for business purposes; limited personal use is permitted where it does not interfere with work.",
      "2. Software: do not install unauthorised software or browser extensions that compromise security.",
      "3. Accounts and devices: register devices, enable MFA, and follow device management guidance from IT.",
      "4. Monitoring: SHINE maintains audit logs; users should have no expectation of privacy in violation of this policy.",
    ],
  },
];

function isPolicyAdmin(actor: { role?: string; email?: string }): boolean {
  return (
    isSuperAdmin(actor) ||
    actor.role === "dejoiy_admin" ||
    actor.role === "admin"
  );
}

/**
 * Pure-JS FNV-1a digest for acknowledgement records (no Node-only imports in
 * mutation runtime). Deterministic fingerprint of the acknowledgement row.
 */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Idempotent: seed the required platform policies as published v1. */
export const seedDefaultPolicies = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    if (!isPolicyAdmin(actor)) throw new Error("Admin role required");

    let created = 0;
    const now = Date.now();
    for (const seed of SEED_POLICIES) {
      const existing = await ctx.db
        .query("policies")
        .filter((q) => q.eq(q.field("title"), seed.title))
        .first();
      if (existing) continue;

      const policyId = await ctx.db.insert("policies", {
        title: seed.title,
        category: seed.category,
        status: "published",
        mandatory: true,
        currentVersion: 1,
        createdBy: actor._id,
        updatedBy: actor._id,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("policyVersions", {
        policyId,
        version: 1,
        title: seed.title,
        summary: seed.summary,
        content: seed.doc.join("\n\n"),
        effectiveAt: now,
        publishedBy: actor._id,
        createdAt: now,
      });
      created += 1;
    }
    await logAudit(
      ctx,
      actor._id,
      "policy.seed",
      "policies",
      undefined,
      `seeded ${created} default policies`,
    );
    return { created };
  },
});

/** Admin: create a new policy (draft v1). */
export const createPolicy = mutation({
  args: {
    title: v.string(),
    category: v.optional(v.string()),
    mandatory: v.boolean(),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { title, category, mandatory, summary, content }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    if (!isPolicyAdmin(actor)) throw new Error("Admin role required");
    if (!title.trim()) throw new Error("Policy title is required");

    const now = Date.now();
    const policyId = await ctx.db.insert("policies", {
      title: title.trim(),
      category: category?.trim() || "General",
      status: "draft",
      mandatory,
      currentVersion: 1,
      createdBy: actor._id,
      updatedBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("policyVersions", {
      policyId,
      version: 1,
      title: title.trim(),
      summary: summary?.trim(),
      content: content?.trim(),
      createdAt: now,
    });
    await logAudit(
      ctx,
      actor._id,
      "policy.created",
      "policies",
      String(policyId),
      `"${title.trim()}" (v1, ${mandatory ? "mandatory" : "optional"})`,
    );
    return policyId;
  },
});

/**
 * Admin: publish the next version of a policy. Never mutates a published
 * version — the current version is marked superseded and a new row is created.
 */
export const publishPolicy = mutation({
  args: {
    policyId: v.id("policies"),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { policyId, summary, content }) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    if (!isPolicyAdmin(actor)) throw new Error("Admin role required");

    const policy = await ctx.db.get(policyId);
    if (!policy) throw new Error("Policy not found");

    const now = Date.now();
    const nextVersion = policy.currentVersion + 1;

    // Mark the previously current version superseded.
    const prevVersion = await ctx.db
      .query("policyVersions")
      .withIndex("by_policy", (q) =>
        q.eq("policyId", policyId).eq("version", policy.currentVersion),
      )
      .first();
    if (prevVersion && policy.status === "published") {
      // A published version is superseded only when a newer one replaces it.
      // (We keep rows immutable — the policy row carries the live status.)
    }

    const newVersionId = await ctx.db.insert("policyVersions", {
      policyId,
      version: nextVersion,
      title: policy.title,
      summary: summary?.trim() ?? prevVersion?.summary,
      content: content?.trim() ?? prevVersion?.content,
      effectiveAt: now,
      publishedBy: actor._id,
      createdAt: now,
    });
    void newVersionId;

    await ctx.db.patch(policyId, {
      status: "published",
      currentVersion: nextVersion,
      updatedBy: actor._id,
      updatedAt: now,
    });
    await logAudit(
      ctx,
      actor._id,
      "policy.published",
      "policies",
      String(policyId),
      `"${policy.title}" published as v${nextVersion}`,
    );
    return { version: nextVersion };
  },
});

/** Any authenticated user acknowledges the current version of a policy. */
export const acknowledgePolicy = mutation({
  args: {
    policyId: v.id("policies"),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { policyId, userAgent }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Not authenticated");

    const policy = await ctx.db.get(policyId);
    if (!policy || policy.status !== "published") {
      throw new Error("Policy is not published");
    }

    const version = policy.currentVersion;
    // Idempotent for this version — never duplicates.
    const existing = await ctx.db
      .query("policyAcknowledgements")
      .withIndex("by_user_policy", (q) =>
        q
          .eq("userId", userId)
          .eq("policyId", policyId)
          .eq("version", version),
      )
      .first();
    if (existing) return { ok: true };

    const now = Date.now();
    const digest = fnv1a(`${userId}:${policyId}:${version}:${now}`);

    await ctx.db.insert("policyAcknowledgements", {
      orgId: policy.orgId,
      userId,
      policyId,
      version,
      userAgent: userAgent?.slice(0, 300),
      digest,
      createdAt: now,
    });
    await logAudit(
      ctx,
      userId,
      "policy.acknowledged",
      "policies",
      String(policyId),
      `acknowledged v${version} of "${policy.title}"`,
      policy.orgId ? String(policy.orgId) : undefined,
    );
    return { ok: true };
  },
});

/** Published policies visible to the user (platform + their org). */
export const publishedPolicies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const me = await ctx.db.get(userId);
    if (!me) return [];

    const policies = await ctx.db
      .query("policies")
      .filter((q) => q.eq(q.field("status"), "published"))
      .collect();

    // Attach the current version content + the user's ack state.
    const out = [];
    for (const p of policies) {
      const version = await ctx.db
        .query("policyVersions")
        .withIndex("by_policy", (q) =>
          q.eq("policyId", p._id).eq("version", p.currentVersion),
        )
        .first();
      const ack = await ctx.db
        .query("policyAcknowledgements")
        .withIndex("by_user_policy", (q) =>
          q
            .eq("userId", userId)
            .eq("policyId", p._id)
            .eq("version", p.currentVersion),
        )
        .first();
      out.push({
        _id: p._id,
        title: p.title,
        category: p.category,
        status: p.status,
        mandatory: p.mandatory,
        currentVersion: p.currentVersion,
        version: version
          ? {
              summary: version.summary,
              content: version.content,
              effectiveAt: version.effectiveAt,
              publishedAt: version.createdAt,
            }
          : null,
        acknowledged: !!ack,
        acknowledgedAt: ack?.createdAt ?? undefined,
      });
    }
    return out;
  },
});

/** Mandatory published policies the current user has NOT acknowledged (gate). */
export const pendingAcks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const me = await ctx.db.get(userId);
    if (!me) return [];

    const published = await ctx.db
      .query("policies")
      .filter((q) => q.eq(q.field("status"), "published"))
      .collect();

    const acks = await ctx.db
      .query("policyAcknowledgements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ackedVersions = new Map<string, number>();
    for (const a of acks) {
      const prev = ackedVersions.get(String(a.policyId)) ?? 0;
      if (a.version > prev) ackedVersions.set(String(a.policyId), a.version);
    }

    const pending = [];
    for (const p of published) {
      if (!p.mandatory) continue;
      const ackedVersion = ackedVersions.get(String(p._id)) ?? 0;
      if (ackedVersion >= p.currentVersion) continue;
      const version = await ctx.db
        .query("policyVersions")
        .withIndex("by_policy", (q) =>
          q.eq("policyId", p._id).eq("version", p.currentVersion),
        )
        .first();
      pending.push({
        _id: p._id,
        title: p.title,
        category: p.category,
        currentVersion: p.currentVersion,
        version: version
          ? {
              summary: version.summary,
              content: version.content,
              effectiveAt: version.effectiveAt,
            }
          : null,
      });
    }
    return pending;
  },
});

/** The current user's acknowledgement history. */
export const myAcknowledgements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("policyAcknowledgements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const out = [];
    for (const r of rows) {
      const policy = await ctx.db.get(r.policyId);
      out.push({
        policyId: r.policyId,
        title: policy?.title ?? "Deleted policy",
        version: r.version,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

/** Admin: per-policy acknowledgement status + version history. */
export const policyStats = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getCurrentUser(ctx);
    if (!actor) throw new Error("Not authenticated");
    if (!isPolicyAdmin(actor)) throw new Error("Admin role required");

    const policies = await ctx.db.query("policies").collect();
    const versions = await ctx.db.query("policyVersions").collect();
    const acks = await ctx.db.query("policyAcknowledgements").collect();
    const totalUsers = await ctx.db.query("users").collect();

    const ackCounts = new Map<string, Set<string>>(); // policyId -> set of users at current version
    for (const a of acks) {
      const policy = policies.find((p) => p._id === a.policyId);
      if (policy && a.version === policy.currentVersion) {
        if (!ackCounts.has(String(a.policyId))) {
          ackCounts.set(String(a.policyId), new Set());
        }
        ackCounts.get(String(a.policyId))!.add(String(a.userId));
      }
    }

    return {
      totalUsers: totalUsers.length,
      policies: policies
        .map((p) => {
          const policyVersions = versions
            .filter((v) => v.policyId === p._id)
            .sort((a, b) => a.version - b.version);
          const acked = ackCounts.get(String(p._id))?.size ?? 0;
          return {
            _id: p._id,
            title: p.title,
            category: p.category,
            status: p.status,
            mandatory: p.mandatory,
            currentVersion: p.currentVersion,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            acked,
            pending: Math.max(0, totalUsers.length - acked),
            versions: policyVersions.map((v) => ({
              version: v.version,
              summary: v.summary,
              effectiveAt: v.effectiveAt,
              createdAt: v.createdAt,
            })),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    };
  },
});
