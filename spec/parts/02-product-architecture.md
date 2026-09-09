# Part 02 — Product Architecture

**Status:** Skeleton · **Depends on:** Part 01 · **Last updated:** 2026-08-05

## 1. Purpose

Describe the end-to-end product architecture — clients, servers, services,
data, realtime, media and deployment — for both the current implementation and
the target self-hosted architecture.

## 2. Detailed outline

### 2.1 System context diagram
- Actors (web, desktop, mobile, admin, external systems) and boundaries.

### 2.2 Layered architecture
- Frontend layer (Vite/React today; Next.js target), API layer (Convex today;
  NestJS + Socket.IO target), infrastructure layer (Postgres, Redis, MinIO,
  LiveKit, Meilisearch, Novu, Coturn, NGINX).

### 2.3 Module map
- Module inventory and ownership (maps 1:1 to Parts 05–24).

### 2.4 Data architecture
- Core entities and relationships (orgs, users, roles, conversations,
  messages, meetings, calendar, policies, audit).
- Multi-tenancy model (summary; detail in Part 06).

### 2.5 Realtime architecture
- Reactive queries (Convex) today; Socket.IO gateway + presence + typing + chat
  events on the self-hosted stack.

### 2.6 Media architecture
- P2P WebRTC today; LiveKit SFU + Coturn + Egress target.

### 2.7 Search & indexing
- Convex search today; Meilisearch target.

### 2.8 Deployment topology
- Cloud preview today; Docker/Kubernetes self-hosted target (detail in Part 22).

### 2.9 Security & compliance posture
- Encryption, TLS, audit, DLP hooks (detail in Parts 14/15/18).

## 3. Key decisions locked so far

- Current implementation: Vite + React 19 + Tailwind v4 + shadcn/ui + Convex + Convex Auth.
- Self-hosted target: Next.js + NestJS + PostgreSQL/Prisma + Socket.IO + Redis +
  LiveKit + MinIO + Meilisearch + Novu + Prometheus/Grafana/Loki + NGINX + Docker.
- Meeting room codes follow `DJM-XXX-000`.
- Full dependency audit captured in `SELF_HOSTING.md`.

## 4. Open questions to finalize

- [ ] Kubernetes manifests vs Docker Compose as the v1.0 default.
- [ ] Migration strategy from Convex → Postgres (data export/import).
- [ ] Read/write replica topology and sharding plan at 100k+ concurrent users.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P02-AC-01 | Architecture supports ≥1M concurrent users in design review | Must |
| P02-AC-02 | Every module maps to an owner service and a spec part | Must |
| P02-AC-03 | No Freebuff/Vly dependency remains in the self-hosted topology | Must |
