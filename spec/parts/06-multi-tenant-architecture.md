# Part 06 — Multi-Tenant Organization Architecture

**Status:** Skeleton · **Depends on:** Part 02, Part 07 · **Last updated:** 2026-08-05

## 1. Purpose

Define how organizations, departments, teams and workspaces are modeled, how
tenants are isolated, and how the platform manages tenant lifecycle.

## 2. Detailed outline

### 2.1 Tenant model
- Organization as the tenant boundary; primary org DEJOIY India Private Limited.
- Only Super Admin can create organizations.

### 2.2 Hierarchy & structure
- Organization → Departments → Teams → Projects/Workspaces.
- Memberships, ownership, transfer, and role assignment per membership.

### 2.3 Data isolation
- Hard isolation rules: no cross-org reads/writes; tenant-scoped queries;
  encryption boundary and backup/restore per tenant.

### 2.4 Tenant provisioning
- Org creation wizard (identity → branding → roles → invite → review),
  invitations, joins, welcome sequences.

### 2.5 Tenant lifecycle
- Suspension, deactivation, export, deletion, retention.

### 2.6 Self-hosted multi-tenancy
- Postgres schema strategy (shared schema + tenant_id vs schema-per-tenant);
  SCIM provisioning of tenants (detail in Part 20).

## 3. Key decisions locked so far

- Super Admin account `deepak.sharma@dejoiy.com` is owner of DEJOIY org.
- Org-scoped directory and search; employees found by search, not proactive lists.
- Meetings, conversations, files and audit logs carry `orgId`.
- Self-hosted Prisma schema models Organization/Department/Team with orgId scoping.

## 4. Open questions to finalize

- [ ] Tenant isolation strategy in Postgres (shared vs schema-per-tenant).
- [ ] Cross-tenant admin (Super Admin) access boundaries and audit rules.
- [ ] Domain-based auto-provisioning (email domain → org) rules.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P06-AC-01 | A tenant can never read or write another tenant's data | Must |
| P06-AC-02 | Only Super Admin can create organizations | Must |
| P06-AC-03 | Tenant export/delete flows preserve audit evidence | Must |
