# Part 17 — Notification Engine

**Status:** Skeleton · **Depends on:** Part 08, Part 16 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the unified notification engine: in-app, email and push delivery,
preferences, digests and unread state.

## 2. Detailed outline

### 2.1 Notification model
- Kind taxonomy (mention, message, meeting, announcement, policy, security,
  approval, task, system), channel (inapp/email/push), title, body, link,
  read state, timestamps.

### 2.2 Delivery
- In-app bell with unread count; email fallback/digest (Part 16); push
  (desktop/mobile — Part 24); realtime push via Socket.IO.

### 2.3 Preferences
- Per-user toggles (mentions, DMs, group, calls, meetings, announcements,
  sound, desktop) and quiet hours.

### 2.4 Digests & reminders
- Unread reminders, daily/weekly digests, meeting reminders, policy reminders.

### 2.5 Notification templates
- Notification copy templates consistent with email templates.

## 3. Key decisions locked so far

- Convex `notifications` table + bell popover + unread count + mark read/all.
- `setNotificationPrefs` persists 8 preference toggles.
- Meeting invites create in-app notifications per invitee.

## 4. Open questions to finalize

- [ ] Push delivery path (Novu vs native FCM/APNs) for v1.0.
- [ ] Quiet-hours and scheduling.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P17-AC-01 | Unread counts update in realtime across devices | Must |
| P17-AC-02 | Preferences are respected by every notification path | Must |
| P17-AC-03 | Mention/meeting/announcement notifications reach the right channel | Must |
