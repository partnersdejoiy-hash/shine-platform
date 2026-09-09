# Part 25 — Acceptance Criteria & QA Framework

**Status:** Skeleton · **Depends on:** all parts · **Last updated:** 2026-08-05

## 1. Purpose

Define the cross-cutting quality framework every module must satisfy:
test pyramid, performance budgets, security testing, accessibility, and how
module-level acceptance criteria are owned and tracked.

## 2. Detailed outline

### 2.1 Test strategy
- Unit, integration, E2E layers; testing tools per layer; coverage targets;
  CI gates.

### 2.2 Performance budgets
- Load targets (TBT, LCP, INP), API latency p95, realtime event latency,
  concurrent-user targets (1M+ design goal), media join time.

### 2.3 Security testing
- OWASP Top 10 checklist, auth/RBAC adversarial tests, dependency scanning,
  secrets handling, penetration testing cadence.

### 2.4 Accessibility gate
- WCAG 2.2 AA checks per release, keyboard pass, screen-reader pass.

### 2.5 Acceptance criteria governance
- AC ID scheme (`PN-AC-XX`), status tracking, sign-off workflow,
  regression mapping.

### 2.6 Release quality gate
- Definition of Done for any feature shipping in v1.0.

## 3. Key decisions locked so far

- Each part defines `PN-AC-XX` criteria with Must/Should/Could priorities.
- Platform runs `tsc -b --noEmit` + production build as baseline checks.

## 4. Open questions to finalize

- [ ] E2E tooling choice (Playwright vs Cypress).
- [ ] CI platform for the self-hosted repo.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P25-AC-01 | Every Must criteria has a test that can be run in CI | Must |
| P25-AC-02 | Release gate blocks on failing Must criteria | Must |
| P25-AC-03 | Performance budgets are measured on the release pipeline | Must |
