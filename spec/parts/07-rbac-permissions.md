# Part 07 — RBAC & Permission Matrix

**Status:** Skeleton · **Depends on:** Part 06 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the eight-level role hierarchy, the complete permission matrix, and the
role-level security policy model (devices, networks, capabilities).

## 2. Detailed outline

### 2.1 Role hierarchy
- Super Admin (1) → Administrator (2) → IT Team (3) → President (4) → Director (5)
  → Operations Manager (6) → Team Leader (7) → Employee (8).

### 2.2 Role definitions
- Per-role capabilities and prohibitions (from the SHINE spec), plus
  Client Admin variant.

### 2.3 Permission matrix
- Full matrix: Create Organization, Manage Roles, Company Announcement,
  Department Groups, Team Groups, Private Chat, Group Chat, Meetings,
  Exports, Reports, Audit, Compliance, etc. (38+ permissions in seed).

### 2.4 Role security policies
- Per-role: allowed platforms, OS, personal/company devices, network/VPN/IP
  restrictions, country restrictions, external sharing, offline access,
  exports/uploads/downloads/printing (detail in Part 18).

### 2.5 Permission requests & grants
- Request → review (Super Admin/Admin/IT) → approve/reject → persist in
  `approvedPermissions`; expiry and audit.

### 2.6 RBAC enforcement
- Frontend gating + backend authorization on every query/mutation/action.

## 3. Key decisions locked so far

- Permanent super admin cannot be demoted/deactivated by others.
- Only super admin can grant super_admin.
- Permission requests capped at 5 pending; duplicate requests rejected.
- Self-hosted seed encodes roles + matrix + flags (`canCreateMeetings`, etc.).

## 4. Open questions to finalize

- [ ] Custom role creation (beyond the 8 system roles) in v1.0?
- [ ] Permission granularity (feature-level vs action-level) for v1.0.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P07-AC-01 | Every backend function enforces RBAC server-side, not just UI | Must |
| P07-AC-02 | Permission matrix matches the approved SHINE hierarchy | Must |
| P07-AC-03 | Super admin protections hold under adversarial access attempts | Must |
| P07-AC-04 | Approved permission grants are audit-logged and expirable | Must |
