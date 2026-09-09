# Part 12 — Tasks, Approvals & Workflows

**Status:** Skeleton · **Depends on:** Part 06, Part 07 · **Last updated:** 2026-08-05

## 1. Purpose

Specify task management plus the approval and workflow engine (leave, expense,
document, role, access approvals).

## 2. Detailed outline

### 2.1 Tasks
- Task CRUD, assignee, priority, due date, status board, filters, task→calendar
  deadlines, task notifications.

### 2.2 Task assignment & teams
- Assign to individuals/teams, task lists per org/team, supervisor views.

### 2.3 Approvals engine
- Approval types: leave, expense, document, role, access request.
- Approval chains (submit → approver(s) → approve/reject → notify), deadlines,
  escalation, delegation.

### 2.4 Workflows
- Configurable workflow templates, triggers, actions, SLA timers,
  workflow audit trail.

### 2.5 Reporting
- Task completion rates, approval cycle times, workload views.

## 3. Key decisions locked so far

- Task model on Convex: title, description, assignee, dueDate, priority,
  status (todo/in_progress/done), org-scoped lists.
- Self-hosted schema adds Task ↔ CalendarEvent link and approvals audit hooks.

## 4. Open questions to finalize

- [ ] Approval chain depth (multi-level) for v1.0.
- [ ] Leave/expense data model ownership (HR module vs generic engine).
- [ ] Workflow builder UI scope.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P12-AC-01 | Tasks support full lifecycle with role-appropriate permissions | Must |
| P12-AC-02 | Approval requests route through the configured chain and log every step | Must |
| P12-AC-03 | Task deadlines surface on the calendar | Must |
