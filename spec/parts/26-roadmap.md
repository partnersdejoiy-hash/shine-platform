# Part 26 — Development Roadmap

**Status:** Skeleton · **Depends on:** all parts · **Last updated:** 2026-08-05

## 1. Purpose

Sequence the work: phases, milestones, dependencies and release plan for
shipping v1.0 and beyond.

## 2. Detailed outline

### 2.1 Phase map
- **Phase A — Foundation (done):** core product on Convex, self-hosted infra
  blueprint, NestJS API scaffold.
- **Phase B — Frontend port:** Next.js + Auth.js (credentials/OTP/OAuth/magic
  link/passkeys/MFA), LiveKit client rooms, calendar UI, policy modal + ack
  dashboard, Excel/CSV import-export UI.
- **Phase C — Feature depth:** Google-Meet parity meetings (whiteboard,
  captions, breakout rooms, spotlight), device/network policy enforcement,
  compliance sheets workflow, attendance/transcripts UI.
- **Phase D — Hardening:** backups, TLS automation, SMTP verification, load
  testing, SOC2 controls.

### 2.2 Milestones
- Milestone list with entry/exit criteria mapped to ACs.

### 2.3 Dependency graph
- Which parts/modules gate which milestones (spec parts as work items).

### 2.4 Release plan
- v1.0 scope definition, release cadence, feature flags, rollback plan.

### 2.5 Post-v1.0
- Marketplace, native apps, K8s GA, internationalization.

## 3. Key decisions locked so far

- Phase A complete; Phase B is the immediate next milestone.
- Self-hosted stack is the deployment target for v1.0.

## 4. Open questions to finalize

- [ ] v1.0 scope freeze list (Must-in vs Must-out).
- [ ] Team capacity assumptions for roadmap sizing.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P26-AC-01 | Every milestone has entry/exit criteria tied to ACs | Must |
| P26-AC-02 | Roadmap reflects approved scope and dependencies | Must |
