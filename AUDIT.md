# SHINE — SELF-HOSTING MIGRATION AUDIT

> Generated: 2026-09-09
> Status: COMPLETE
> Author: Migration Audit (DEJOIY/SHINE project)

---

## 1. Current State

The SHINE application is an enterprise communication platform (chat, meetings, calls, tasks, files, notifications, admin, AI) built with:

- **Frontend (Live):** Vite + React 19 + Tailwind v4 + shadcn/ui + Framer Motion
- **Backend (Live):** Convex cloud (managed database, realtime, auth, storage)
- **Backend (Self-hosted target):** NestJS 10 + Drizzle ORM + PostgreSQL, partially scaffolded
- **Infrastructure:** Docker Compose stack with 17 core + ~20 profile-gated services

The application currently runs on Convex cloud and must be migrated to a fully self-hosted stack.

---

## 2. Existing Architecture

### 2.1 Frontend (Vite/React)

```
Browser (React 19 + Tailwind + shadcn/ui + Framer Motion)
  └── ConvexReactClient (VITE_CONVEX_URL)
        ├── useQuery / useMutation / useAction (from "convex/react")
        ├── ConvexAuthProvider (from "@convex-dev/auth/react")
        └── API calls to src/convex/* functions
```

- **32 files** import `useQuery`/`useMutation`/`useAction` from `"convex/react"`
- **32 files** import from `@/convex/_generated/api`
- **28 Convex function files** define the entire backend logic in `src/convex/`
- **Auth:** Convex Auth with OTP (Freebuff relay), password (super admin), OAuth providers
- **Storage:** `ctx.storage` (Convex cloud) with self-hosted MinIO fallback attempt
- **Realtime:** Convex reactive queries + WebRTC signaling through Convex

### 2.2 Backend (NestJS - self-hosted target)

```
NestJS 10 + Drizzle ORM + PostgreSQL
  ├── auth      → JWT (bcrypt) - COMPLETE
  ├── users     → Profile + presence - PARTIAL
  ├── orgs      → Organizations + members - PARTIAL (no teams)
  ├── conversations → CRUD + members + read state - COMPLETE
  ├── messages  → CRUD + reactions + pin + forward - COMPLETE
  ├── meetings  → CRUD + join/leave/end - PARTIAL (no LiveKit)
  ├── calls     → Start/answer/decline/signal - PARTIAL
  ├── notifications → In-app CRUD - PARTIAL
  ├── files     → Metadata CRUD - PARTIAL
  ├── tasks     → CRUD - PARTIAL
  ├── contacts  → CRUD - COMPLETE
  ├── tickets   → CRUD + status + notes - PARTIAL
  ├── policies  → CRUD + publish + acknowledge - PARTIAL
  ├── audit     → List logs - PARTIAL (no auto-capture)
  ├── permissions → Role matrix CRUD - PARTIAL (not enforced)
  ├── admin     → Stats + users + orgs - STUB (no RBAC)
  ├── realtime  → Socket.IO gateway - COMPLETE (in-memory)
  ├── search    → SQL ILIKE - STUB (no Meilisearch)
  ├── storage   → Stub URLs - BROKEN (MinIO dead code)
  └── statuses  → Empty shell - NOT IMPLEMENTED
```

### 2.3 Database

Two competing schemas exist:

| Definition | Status | Used at runtime? |
|---|---|---|
| `server/prisma/schema.prisma` (683 lines) | Legacy - has migrations | NO - @prisma/client not installed |
| `server/src/db/schema.ts` (Drizzle, 34 tables) | Authoritative | YES - all services use it |

**Drizzle is the actual runtime ORM.** Prisma files are abandoned scaffolding.

Drizzle schema (34 tables): users, passwords, presence, devices, organizations, organization_members, teams, team_members, conversations, conversation_members, messages, reactions, pinned_messages, bookmarks, typing, folders, files, meetings, meeting_participants, meeting_activity_log, calls, call_signals, meeting_signals, notifications, tasks, contacts, permission_requests, tickets, role_permissions, audit_logs, policies, policy_versions, policy_acknowledgements, payments

**Missing migrations**: No drizzle-kit config, no migrations generated. Schema exists as code only.

---

## 3. Dependency Map

### 3.1 Convex (must be REMOVED)

| Location | Type | Action |
|---|---|---|
| `package.json` - `convex`, `@convex-dev/auth` | Runtime | REMOVE |
| `src/convex/` (28 files + _generated) | Runtime | REMOVE (archive) |
| 32 frontend files importing `convex/react` | Runtime | REPLACE |
| `vite.config.ts` - convex-vendor chunk, optimizeDeps | Build | REMOVE |
| `.env.example` - CONVEX_URL etc | Env | REMOVE |
| `deploy/web/Dockerfile` - VITE_CONVEX_URL | Build | REMOVE |
| `docker-compose.yml` - VITE_CONVEX_URL | Deploy | REMOVE |

### 3.2 Freebuff / Vly (must be REMOVED)

| Location | Type | Action |
|---|---|---|
| `package.json` - `@vly-ai/integrations` | Runtime | REMOVE |
| `src/convex/auth.config.ts` - Freebuff JWT issuer | Runtime | REMOVE (file deleted) |
| `src/instrumentation.tsx` - Freebuff monitoring | Runtime | REMOVE (dead code) |
| `vly-toolbar-readonly.tsx` | Runtime | REMOVE |
| `vite.config.ts` - vlyPlugin() | Build | REMOVE |
| `src/main.tsx` - VlyToolbar import | Runtime | REMOVE |
| `src/lib/vly-integrations.ts` | Runtime | REMOVE (dead code) |
| `integrations.md` | Docs | REMOVE |

### 3.3 External services (KEEP - intentionally required)

| Service | Where | Purpose |
|---|---|---|
| OpenAI API | `src/convex/ai.ts` | AI features |
| Resend API | `src/convex/emailProvider.ts` | Transactional emails |
| Razorpay | `src/convex/billingNode.ts` | Payments |
| Google/GitHub/Microsoft/Apple OAuth | `src/convex/auth.ts` | SSO (optional) |

### 3.4 Infrastructure services (docker-compose)

| Service | Required | Notes |
|---|---|---|
| postgres | YES | Primary database |
| redis | YES | Cache/queues/realtime |
| minio + minio-init | YES | Object storage |
| meilisearch | YES | Search (not yet connected) |
| livekit + egress | YES | WebRTC SFU |
| coturn | YES | TURN/STUN |
| novu + novu-mongo | NO | Not used by code (remove from core) |
| prometheus/grafana/loki/promtail | NO (optional) | Observability |
| nginx | YES | Reverse proxy |
| api | YES | NestJS backend |
| web | YES | Frontend |

---

## 4. Storage Map

| Component | Current | Target |
|---|---|---|
| Upload flow | `ctx.storage.generateUploadUrl()` then save metadata | MinIO presigned URL → direct upload → save metadata |
| Download flow | `ctx.storage.getUrl()` | MinIO presigned GET / streaming |
| Profile avatars | Convex storage | MinIO bucket `avatars/` |
| Chat attachments | Convex storage | MinIO bucket `chat/` |
| Meeting recordings | LiveKit egress (S3) | MinIO bucket `recordings/` |
| Files module | Convex storage | MinIO bucket `documents/` |
| Thumbnails | Not implemented | MinIO bucket `thumbnails/` |

**Current backend state:** `StorageService` returns fake URLs (TODO stub). `MinioService` is a complete implementation but NOT registered in the module. Must be wired up.

---

## 5. Chat Feature Map

| Feature | Convex (live) | NestJS (target) |
|---|---|---|
| 1:1 DM | ✅ | ✅ (`/conversations/direct`) |
| Group chats | ✅ | ✅ (`/conversations/group`) |
| Channels | ✅ | ✅ (`/conversations/channel`) |
| Message send | ✅ | ✅ (`/messages`) |
| Message history | ✅ | ✅ (`/messages/conversation/:id`) |
| Threads/replies | ✅ | ❌ NOT IMPLEMENTED |
| Reactions | ✅ | ✅ (`/messages/:id/reactions`) |
| Edit message | ✅ | ✅ (`PUT /messages/:id`) |
| Delete message | ✅ | ✅ (`DELETE /messages/:id`) |
| Delete-for-me | ✅ | ❌ (no `hiddenFor` support) |
| Pin messages | ✅ | ✅ (`/messages/:id/pin`) |
| Bookmarks | ✅ | ❌ NOT IMPLEMENTED |
| Read state | ✅ | ✅ (`PUT /conversations/:id/read`) |
| Delivery state | ✅ | ❌ NOT IMPLEMENTED |
| Typing indicator | ✅ | ✅ (Socket.IO `typing:start/stop`) |
| Presence | ✅ | ✅ (Socket.IO `presence:update`) |
| Message search | ✅ | ❌ (SQL ILIKE only) |
| Forward | ✅ | ✅ (`/messages/:id/forward`) |
| Emoji/stickers | ✅ (client-side) | ✅ (client-side) |
| Polls | ✅ | ❌ (schema has poll field, no API) |
| File attachments | ✅ | ❌ (storage stub) |
| Voice messages | ✅ | ❌ NOT IMPLEMENTED |
| Infinite scroll | ✅ | ❌ (no cursor pagination endpoint) |

---

## 6. Migration Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Data loss during DB migration | HIGH | No live data on self-hosted yet; new DB from scratch |
| Frontend breakage from API swap | HIGH | Build a compatibility layer first, test incrementally |
| Auth session invalidation | HIGH | New JWT-based auth replaces Convex auth |
| Meeting WebRTC broken | MEDIUM | WebRTC signaling via Socket.IO, not Convex tables |
| Storage broken (uploads fail) | HIGH | Wire MinIO first, test presigned flow |
| Real-time events lost | MEDIUM | Socket.IO with Redis adapter |
| Reconnect/recovery | MEDIUM | Socket.IO auto-reconnect + REST revalidation |

---

## 7. Recommended Target Architecture

```
                INTERNET
                   |
                   v
             NGINX / TLS (deploy/nginx/shine.conf)
                   |
      +------------+-------------+
      |                          |
      v                          v
 FRONTEND (web)               API (NestJS :3001)
 Vite/React SPA               │
      |                       ├── Socket.IO Gateway (realtime)
      |                       ├── JWT Auth + RBAC Guards
      +---------------------- │── Drizzle + PostgreSQL
              |               ├── MinIO (presigned URLs)
              |               ├── Redis (cache + Socket.IO adapter)
              |               ├── LiveKit (WebRTC SFU)
              |               └── Meilisearch (full-text)
              v
      MinIO Object Storage (avatars/, chat/, documents/, recordings/)
```

---

## 8. Files That Must Change

### Frontend
1. `package.json` - remove convex, @convex-dev/auth, @vly-ai/integrations, add socket.io-client
2. `vite.config.ts` - remove vlyPlugin, convex-vendor
3. `src/main.tsx` - remove ConvexAuthProvider, VlyToolbar, add AuthProvider + SocketProvider
4. `src/hooks/use-api.ts` - expand API client
5. `src/convex/react.ts` - enhance shim (polling, real-time)
6. `src/lib/convex.ts` - DELETE
7. ALL 32 files importing `convex/react` - change import to `@/convex/react`
8. ALL 32 files importing `@/convex/_generated/api` - change to `@/convex/api`
9. `src/lib/vly-integrations.ts` - DELETE
10. `vly-toolbar-readonly.tsx` - DELETE

### Backend
11. `server/src/storage/storage.module.ts` - register MinioService
12. `server/src/storage/storage.service.ts` - implement presigned URLs
13. `server/src/main.ts` - ValidationPipe, helmet, rate limiting
14. `server/src/app.module.ts` - add mail module
15. `server/src/meetings/meetings.service.ts` - DJM room codes, LiveKit tokens
16. `server/src/realtime/realtime.gateway.ts` - Redis adapter
17. `server/src/db/schema.ts` - add missing tables (sessions, message delivery, bookmarks)
18. `server/src/auth/*` - rate limiting, email OTP

### Infrastructure
19. `.env.example` - complete variable documentation
20. `docker-compose.yml` - remove unused core services (novu), fix grafana port
21. `server/docker-compose.yml` - fix livekit.yaml path
22. `deploy/scripts/setup.sh` - remove CONVEX_URL dependency
23. `deploy/nginx/shine.conf` - TLS + security headers

---

## 9. Files That Should NOT Change

1. `src/components/ui/*` - shadcn/ui primitives (all clean)
2. `src/pages/Landing.tsx` - public marketing page (no Convex deps)
3. `src/pages/NotFound.tsx` - 404 page
4. `src/components/StartupAnimation.tsx` - splash animation
5. `src/components/ShineLogo.tsx` - logo
6. `src/lib/utils.ts`, `src/lib/format.ts`, `src/lib/emoji.ts`, `src/lib/sound.ts` - pure utilities
7. `src/hooks/use-mobile.ts` - mobile detection
8. `public/*` - static assets (logo, templates, manifest)
9. `server/src/db/schema.ts` - Drizzle schema (expand, don't rewrite)
10. `server/src/health/*` - health endpoints
11. `src/index.css` - theme/branding

---

## 10. Missing Functionality (must be implemented)

| Area | What's missing |
|---|---|
| Storage | MinIO wiring, presigned URLs, download streaming |
| Realtime | Redis adapter, message delivery receipts, reconnect sync |
| Auth | Email verification, OTP (SMTP not Convex), device session management |
| Meetings | LiveKit rooms, join tokens, DJM room codes |
| Search | Meilisearch indexing + search API |
| Mail | SMTP module (OTP, invites, notifications) |
| Chat | Cursor pagination, delivery/read receipts, delete-for-me, bookmarks, voice messages |
| Admin | RBAC enforcement, user create/disable | 
| Audit | Auto-capture of all actions |
| Statuses | Empty module needs implementation |
| Billing | Razorpay integration |

---

## 11. Duplicate Functionality

| Duplication | Action |
|---|---|
| Prisma schema + Drizzle schema | Remove Prisma, keep Drizzle |
| Prisma migrations + Drizzle (no migrations) | Generate Drizzle migrations |
| `use-api.ts` + `src/convex/react.ts` shim + Convex real time | Consolidate to API layer |
| `ConvexHealthCheck.tsx` + custom health in main.tsx | Keep one |
| Convex storage + MinIO storage | Remove Convex, keep MinIO |
| Email via Resend (convex) + MailService (planned SMTP) | Replace Resend with SMTP |

---

## 12. Security Concerns

| Issue | Severity | Fix |
|---|---|---|
| JWT fallback secrets in source (`shine_jwt_secret_2024`) | CRITICAL | Require env, no hardcoded fallback |
| Hardcoded docker-compose defaults (`change-me-*`) | CRITICAL | Remove fallbacks, require .env |
| No RBAC enforcement on admin routes | HIGH | Add RolesGuard + @Roles decorator |
| No ValidationPipe | HIGH | Add global ValidationPipe with whitelist |
| No rate limiting | HIGH | @nestjs/throttler |
| No helmet | MEDIUM | Add helmet middleware |
| MinIO console exposed publicly | MEDIUM | Bind to localhost/nginx auth |
| Prometheus/Grafana/Meilisearch exposed | MEDIUM | Add nginx auth or remove proxies |
| CORS too permissive (`*`) | MEDIUM | Set to configured origins |
| SQL injection risk | LOW | Drizzle parameterization (OK) |
| Socket.IO auth weak (warns but accepts) | MEDIUM | Reject unminted sockets |

---

## 13. Performance Concerns

| Issue | Severity | Fix |
|---|---|---|
| Frontend bundle 1MB+ single chunk | HIGH | Lazy-load pages, code split |
| Full chat history loaded | HIGH | Cursor pagination |
| No message virtualization | MEDIUM | Virtualized list for large convos |
| No image optimization | MEDIUM | Thumbnails via MinIO/Sharp |
| Search scans whole table | HIGH | Meilisearch |
| No Redis for presence/cache | MEDIUM | Redis adapter + caching |
| Bulky single Docker image | LOW | Multi-stage (already done) |
| No log rotation | MEDIUM | Loki retention + logrotate |
| Big uploads through API | HIGH | Presigned direct-to-MinIO |

---

## 14. Deployment Problems

| Issue | Severity | Fix |
|---|---|---|
| `server/Dockerfile` doesn't copy prisma/ | HIGH | Remove prisma dependency entirely (Drizzle) |
| TLS certs commented out in shine.conf | HIGH | Enable + mount certs |
| Coturn placeholder credentials | HIGH | Generate in setup.sh |
| `server/docker-compose.yml` broken livekit.yaml path | MEDIUM | Fix reference |
| setup.sh requires CONVEX_URL | HIGH | Remove requirement |
| `.env.example` incomplete | MEDIUM | Complete |
| Grafana port 3001 collides with API | LOW | Change to 3002 |
| Nginx doesn't proxy `/api` without TLS | MEDIUM | Fix |

---

## 15. Recommended Implementation Order

1. ✅ Audit (this document)
2. Remove Convex/Freebuff/Vly dependencies from package.json + config
3. Create frontend API compatibility layer (ShineAPI + api registry + shim)
4. Backend: Wire MinIO (presigned uploads/downloads)
5. Backend: Global security (ValidationPipe, helmet, rate limiting, RBAC)
6. Backend: Mail module (SMTP)
7. Backend: Socket.IO Redis adapter + delivery/read receipts
8. Backend: DJM room codes + LiveKit integration for meetings
9. Frontend: Replace all convex/react imports with shim imports
10. Frontend: Socket.IO client for realtime
11. Infrastructure: .env.example, docker-compose, nginx, setup.sh
12. Verify: build + typecheck + lint
13. Write MIGRATION_REPORT.md