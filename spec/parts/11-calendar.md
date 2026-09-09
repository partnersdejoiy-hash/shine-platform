# Part 11 — Enterprise Calendar

**Status:** Skeleton · **Depends on:** Part 06, Part 09 · **Last updated:** 2026-08-05

## 1. Purpose

Specify the self-hosted enterprise calendar — no dependence on Google/Microsoft
calendar — covering personal, department, organization, holiday, leave,
training and reminder calendars.

## 2. Detailed outline

### 2.1 Calendar types
- Personal, department, organization, holiday, leave, training, reminder.

### 2.2 Events
- Event CRUD, all-day, location, color categories, recurring events (RRULE),
  deadlines, reminders, ICS import/export.

### 2.3 Sharing & permissions
- Shared calendars, per-share permission (view/edit/manage), calendar-level ACLs.

### 2.4 Calendar views
- Day/week/month/agenda, search, overlapping events, multi-calendar overlay.

### 2.5 Meetings & tasks integration
- Schedule meeting from calendar, meeting links, recurring meetings,
  task deadlines surfaced on calendar, availability checker.

### 2.6 Notifications
- Event reminders, meeting reminders, follow-ups (Part 17).

### 2.7 Chat integration
- Calendar button in every chat: schedule meeting/reminder/follow-up, create
  task, share event, availability check.

## 3. Key decisions locked so far

- Self-hosted schema: `CalendarEvent`, `CalendarShare`, `Holiday` models with
  `calendarType`, `rrule`, `externalId`, share permissions.
- Holiday calendar per org.

## 4. Open questions to finalize

- [ ] RRULE engine (full RFC 5545 vs subset).
- [ ] Availability checker algorithm for v1.0.
- [ ] ICS export/import scope.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P11-AC-01 | All seven calendar types render and behave per spec | Must |
| P11-AC-02 | Recurring events expand correctly across views | Must |
| P11-AC-03 | Shared calendars respect view/edit/manage permissions | Must |
| P11-AC-04 | ICS import/export round-trips event data | Should |
