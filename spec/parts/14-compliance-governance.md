# Part 14 — Compliance & Governance Center

**Status:** Skeleton · **Depends on:** Part 06, Part 07, Part 15 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the compliance center: policy management, mandatory acknowledgements,
data retention, and governance workflows for supervisors.

## 2. Detailed outline

### 2.1 Policy management
- Policy lifecycle (versioning, publish, retire), 12 required SHINE policies
  (Part 04), per-org policy sets.

### 2.2 Mandatory acknowledgements
- Required policies (Privacy, Terms, Code of Conduct, InfoSec, Employee
  Communication, Data Protection, Acceptable Use); acknowledgement gating
  before continued use.
- Acknowledgement record: employee ID, name, role, department, org, IP,
  browser, device, OS, date/time, version, signature hash.

### 2.3 Acknowledgement dashboard
- Visible to Super Admin/Admin/President/Director/OM: pending, completed,
  rejected, expired, version history, reminder history, download Excel/PDF,
  send/bulk reminders.

### 2.4 Policy viewer modal
- Title, last updated, version, document, download PDF, print, search within
  policy, accept, close — no page redirects.

### 2.5 Data retention & DLP
- Retention schedules per data class, legal hold (Part 15), export controls,
  compliance reports.

### 2.6 Compliance workflows
- Download sheets, review offline, edit, re-upload with validation and error
  reports (employee/department/role/permission imports).

## 3. Key decisions locked so far

- Self-hosted schema: `Policy` + `PolicyAcknowledgement` (unique per
  user/policy/version, signatureHash, device/IP metadata).
- Seed creates 7 required DEJOIY policies.
- Footer policy links open in-app modals (planned UI).

## 4. Open questions to finalize

- [ ] Acknowledgement gating UX (block vs nag) for v1.0.
- [ ] Signature hash algorithm and storage requirements.
- [ ] Excel/CSV bulk import validation scope.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P14-AC-01 | Users cannot continue until required policies are acknowledged | Must |
| P14-AC-02 | Every acknowledgement records full identity + device + version + hash | Must |
| P14-AC-03 | Dashboard exports (Excel/PDF) match the pending/completed data | Must |
| P14-AC-04 | Policy viewer supports search, print and PDF download | Must |
