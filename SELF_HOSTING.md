# SHINE — Self-Hosting Audit & Migration Guide

**Target:** SHINE runs 100% on your own server. No Freebuff domains, APIs, SMTP,
auth, storage, meeting servers or managed infrastructure after deployment.

This document is the dependency audit requested in the implementation spec,
plus the exact mapping to the self-hosted replacement for every managed
dependency. It accompanies the deployable artifacts in this repository:

| Artifact | Purpose |
|---|---|
| `docker-compose.yml` | One-command self-hosted stack (see below) |
| `deploy/` | NGINX, LiveKit, Coturn, Prometheus/Grafana/Loki, setup script |
| `server/` | New NestJS + Prisma + Socket.IO backend (self-hosted) |
| `SELF_HOSTING.md` | This audit + migration plan |

---

## 1. Dependency audit — every managed dependency today

| # | Component | Current implementation | File(s) | Managed by | Self-hosted replacement | Status |
|---|---|---|---|---|---|---|
| 1 | Database | Convex (cloud) | `src/convex/*` | Freebuff/Convex cloud | PostgreSQL 16 (Docker) | 🔴 replaced by `server/` |
| 2 | Realtime | Convex reactive queries + WebRTC signaling tables | `src/convex/*` | Convex cloud | Socket.IO gateway (NestJS) | 🔴 replaced by `server/src/realtime` |
| 3 | Auth (sessions, OTP, OAuth) | Convex Auth | `src/convex/auth.ts`, `auth.config.ts` | Convex cloud | Auth.js (Next.js frontend) + NestJS JWT (API) | 🔴 replaced by `server/src/auth` |
| 4 | Email OTP delivery | `https://auth.freebuff.app/send_otp` + hardcoded `x-api-key` | `src/convex/auth/emailOtp.ts` | **Freebuff** | Your SMTP (Nodemailer) — `welcome@shine.dejoiy.com` etc. | 🔴 replaced by `server/src/mail` |
| 5 | Meeting invite emails | `vly.email.sendBatch(...)` | `src/convex/meetingEmails.ts` | **Freebuff (Vly integrations)** | Your SMTP via Nodemailer template engine | 🔴 replaced by `server/src/mail` |
| 6 | Vly integration client | `createVlyIntegrations({ deploymentToken: VLY_INTEGRATION_KEY })` | `src/lib/vly-integrations.ts` | **Freebuff (Vly)** | Remove — no Vly calls remain in self-host build | 🔴 removed |
| 7 | Federated JWT (freebuff.com) | customJwt provider, issuer + JWKS on freebuff.com | `src/convex/auth.config.ts` | **Freebuff** | Remove — no freebuff tokens in self-host build | 🔴 removed |
| 8 | Object storage | Convex `ctx.storage` | `src/convex/files.ts`, `src/lib/upload.ts` | Convex cloud | MinIO (S3-compatible, Docker) | 🔴 replaced by `server/src/storage` |
| 9 | Meetings / media (SFU) | Browser WebRTC + Convex signaling (no media server) | `src/convex/meetings.ts`, `src/hooks/use-rtc.ts` | none (P2P) | LiveKit (self-hosted SFU) + Coturn | 🔴 replaced by `server/src/integrations/livekit.service.ts` |
| 10 | Recording / transcription | not implemented | — | — | LiveKit Egress (self-hosted) | 🔴 in stack |
| 11 | Search | Convex `searchIndex` | `src/convex/*` | Convex cloud | Meilisearch | 🔴 in stack |
| 12 | Notifications | Convex `notifications` table + in-app bell | `src/convex/notifications.ts` | Convex cloud | Novu (self-hosted) + Socket.IO | 🔴 in stack |
| 13 | Monitoring | none | — | — | Prometheus + Grafana + Loki | 🔴 in stack |
| 14 | Reverse proxy / TLS | Vly/Freebuff managed host | `vite.config.ts`, `vly-toolbar-readonly.tsx` | **Freebuff** | NGINX + your TLS certs | 🔴 in stack |
| 15 | Build-time Vly plugin | `vlyPlugin()` from `@vly-ai/integrations` | `vite.config.ts` | **Freebuff** | Removed in self-host build | 🔴 removed |
| 16 | Dev toolbar | `vly-toolbar-readonly.tsx` (freebuff.com publish link) | root | **Freebuff** | Excluded from self-host build | 🔴 excluded |
| 17 | Frontend runtime | Vite + React + Convex client | `src/` | Freebuff preview | Next.js (migration phase) | 🟡 in progress |

**Managed-by-Freebuff components that MUST be gone after export:** items 4, 5, 6,
7, 14, 15, 16 (and all Convex cloud usage: 1, 2, 3, 8, 10).

---

## 2. Target self-hosted architecture

```
                         ┌────────────────────────────┐
   Clients (web/desktop/ │  NGINX :443/:80 (TLS)      │
   mobile/tablet)        │  / → Next.js web           │
                         │  /api → NestJS api         │
                         │  /socket.io → api (WS)     │
                         │  /livekit → LiveKit SFU    │
                         │  /minio → MinIO            │
                         │  /search → Meilisearch     │
                         │  /notifications → Novu     │
                         └─────────────┬──────────────┘
                    ┌──────────────────┼─────────────────────┐
         ┌──────────▼─────────┐  ┌─────▼──────┐  ┌──────────▼─────────┐
         │ Next.js (web)      │  │ NestJS API │  │ LiveKit SFU         │
         │ Auth.js + Prisma   │  │ Prisma ORM │  │ (WebRTC, HD video)  │
         │ (frontend phase)   │  │ Socket.IO  │  │  + Egress (record)  │
         └──────────┬─────────┘  └──┬──────┬──┘  └──────────┬─────────┘
                    │               │      │                │
        ┌───────────┼───────────────┼──────┼────────────────┼───────────┐
        │  Postgres  Redis  MinIO  Meilisearch  Novu  Coturn  │          │
        │  (DB)      (cache)(files) (search)   (notify) (TURN)│          │
        └───────────┼───────────────┼─────────────────────────┼──────────┘
                    └───────────────┼─────────────────────────┘
                                    │
                       Prometheus / Grafana / Loki
                       (metrics, dashboards, logs)
```

---

## 3. What ships in this repository (done)

- `docker-compose.yml` — PostgreSQL, Redis, MinIO, Meilisearch, LiveKit,
  LiveKit Egress, Coturn, Novu, Prometheus, Grafana, Loki, Promtail, NGINX
  and the NestJS API service.
- `deploy/` — LiveKit config, Coturn config, NGINX config, Prometheus/Grafana/
  Loki configs, `.env.example`, `setup.sh` (secret generation + provisioning).
- `server/` — NestJS + Prisma backend scaffold:
  - Prisma schema covering the full enterprise domain (orgs, departments,
    teams, roles/permissions matrix, users, devices, sessions, meetings +
    DJM room codes, calendar + shares, policies + acknowledgements, audit
    logs, chat, notifications, files, tasks, invites, email log).
  - `prisma/seed.ts` — seeds the 8-role SHINE hierarchy, the permission
    matrix, the DEJOIY organization and the permanent super admin
    `deepak.sharma@corp.dejoiy.com` (password from `SUPER_ADMIN_PASSWORD`).
  - Auth module (JWT + Argon2/bcrypt password hashing, remember-me).
  - Users module (profile, directory, device & network policy fields).
  - Realtime gateway (Socket.IO with JWT auth, presence, typing, chat).
  - Mail module (Nodemailer + per-organization SMTP + template engine using
    the SHINE enterprise template and `@shine.dejoiy.com` sender identities).
  - Storage module (MinIO presigned upload/download).
  - Integrations (LiveKit token/egress, Meilisearch, Novu).
  - Health endpoints for the monitoring stack.

## 4. Remaining phases (tracked)

| Phase | Scope | Depends on |
|---|---|---|
| B — Frontend port | Port `src/` UI to Next.js App Router + Tailwind + shadcn/ui; Auth.js (credentials + OAuth + OTP + magic link + passkeys) with Prisma adapter; LiveKit client rooms; calendar UI; excel import/export UI | server/ + infra |
| C — Feature depth | Google-Meet-parity meeting UI, whiteboard, captions, breakout rooms; device/network access policy enforcement; compliance sheets workflow | B |
| D — Hardening | Backups (pg_dump + MinIO mirror), TLS automation, SMTP verification, load testing, SOC2 controls | C |

---

## 5. Prerequisites for your server

- Docker 24+ with Compose v2, 4 vCPU / 8 GB RAM minimum (16 GB recommended).
- A domain (e.g. `shine.dejoiy.com`) with DNS A records → your server IP.
- Open ports: 80/443 (web), 3478/UDP+TCP (Coturn), 3479/UDP (alt), 50000-50100/UDP (LiveKit media), 5349/TCP (TURN TLS).
- An SMTP relay/account (or your mail server) for outbound email.

See `deploy/README.md` for the step-by-step deployment walkthrough.
