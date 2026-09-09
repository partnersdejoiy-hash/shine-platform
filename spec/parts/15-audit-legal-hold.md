# Part 15 — Audit Logs & Legal Hold

**Status:** Skeleton · **Depends on:** Part 06, Part 07 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the immutable audit trail across the platform, legal hold, evidence
export and chain-of-custody requirements.

## 2. Detailed outline

### 2.1 Audit event model
- Actor, action, target type/id, org, IP, user agent, timestamp, details.
- Event taxonomy: auth, devices, profiles, roles, permissions, orgs,
  conversations, messages, meetings, files, tasks, policies, compliance.

### 2.2 Audit pipelines
- Synchronous critical events, async batch events, retention of audit data,
  tamper-evidence (hash chaining).

### 2.3 Audit views
- Admin console (Super Admin/Admin/IT), filters, search, export (CSV/PDF),
  per-tenant scoping.

### 2.4 Legal hold
- Hold on users, conversations, files; immutable copies; hold expiry and
  review workflow.

### 2.5 eDiscovery & export
- Scope-based evidence export with manifest and chain of custody.

## 3. Key decisions locked so far

- `auditLogs` table + `logAudit` helper used across all modules.
- Admin console shows last 100 audit entries with actor resolution.
- Self-hosted schema includes `AuditLog` with orgId scoping.

## 4. Open questions to finalize

- [ ] Audit retention policy (months/years) per plan.
- [ ] Hash-chaining for tamper evidence in v1.0.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P15-AC-01 | Every audited action produces a retrievable, org-scoped record | Must |
| P15-AC-02 | Audit exports include complete filterable evidence | Must |
| P15-AC-03 | Legal hold preserves data beyond normal retention | Must |
