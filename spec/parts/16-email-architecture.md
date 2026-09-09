# Part 16 — Enterprise Email Architecture & Templates

**Status:** Skeleton · **Depends on:** Part 04, Part 09, Part 14 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the email system: delivery via the org's own SMTP (never a managed
relay), sender identities, the template engine, and every email event.

## 2. Detailed outline

### 2.1 Delivery architecture
- Nodemailer + org-configured SMTP; per-org SMTP overrides with
  `<identity>@<companydomain>` senders; system default `@shine.dejoiy.com`.

### 2.2 Sender identities
- 22 identities: welcome, auth, security, notifications, meetings, support,
  compliance, governance, policies, training, audit, risk, legal, broadcast,
  hr, it, reports, billing, system, backup, monitoring, no-reply.

### 2.3 Template engine
- SHINE enterprise shell (dark + gold), variables (name, role, department,
  org, meeting, manager, logo, brand colors, signature, timezone, language,
  date, device, browser, support email, policy version, action button, footer).
- Per-org branding overrides.

### 2.4 Email events
- **Authentication:** welcome, verification, OTP, password reset/changed
  (self/IT/admin/super admin), MFA enabled/disabled, new/suspicious login,
  new device, device removed, locked/unlocked, session expired/revoked.
- **Lifecycle:** invited, joined, removed, suspended, reactivated, role
  changed, department changed, manager changed, org transfer.
- **Messaging:** mention, unread reminder, pinned, announcement, broadcast,
  important notice, chat export, message deleted.
- **Meetings:** invitation (attendee names + code), reminder, started,
  cancelled, recording ready, transcript ready, summary, follow-up.
- **Approvals:** leave, expense, document, role, access, policy reminder.
- **Security:** failed login attempts, account locks.

### 2.5 Email log & deliverability
- Send log (to/from/subject/template/status/error), retry, bounce handling.

## 3. Key decisions locked so far

- Self-hosted MailService: Nodemailer, `resolveFrom` per-org, `SHINE_SHELL`
  template, templates: welcome, magic_link, otp, meeting_reminder,
  policy_reminder, password_reset, meeting invite.
- `EmailLog` model records every send.

## 4. Open questions to finalize

- [ ] Retry/queue strategy (Redis-backed) for bulk sends.
- [ ] Email localization scope.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P16-AC-01 | All email leaves the org-configured SMTP, never a managed relay | Must |
| P16-AC-02 | Every event type renders the SHINE template with correct variables | Must |
| P16-AC-03 | Meeting invites include attendee names, room code, time and join link | Must |
| P16-AC-04 | Failed sends are logged and retried per policy | Must |
