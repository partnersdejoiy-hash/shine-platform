# SHINE — Enterprise Communication Platform (Powered by DEJOIY)

> Complete project documentation: every feature, flow, module, and decision made
> so far, plus the self-hosted migration plan and current build state.
>
> **Status:** Core product live in preview (Vite + React + Convex) · Self-hosted
> backend scaffolded and compiling (`server/`) · Infrastructure blueprint ready (`deploy/`).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Brand & Design System](#2-brand--design-system)
3. [Architecture](#3-architecture)
4. [Repository Layout](#4-repository-layout)
5. [Feature Inventory](#5-feature-inventory)
6. [Authentication Flows](#6-authentication-flows)
7. [Super Admin & Roles](#7-super-admin--roles)
8. [User Profile & Presence Flows](#8-user-profile--presence-flows)
9. [Contacts & Directory Flows](#9-contacts--directory-flows)
10. [Chat & Messaging Flows](#10-chat--messaging-flows)
11. [Calls (Audio/Video) Flows](#11-calls-audiovideo-flows)
12. [Meeting Flows](#12-meeting-flows)
13. [Organizations & Teams Flows](#13-organizations--teams-flows)
14. [Tasks, Files & Notifications Flows](#14-tasks-files--notifications-flows)
15. [Admin & Governance Flows](#15-admin--governance-flows)
16. [AI Assistant (ShineAI) Flows](#16-ai-assistant-shineai-flows)
17. [Email System](#17-email-system)
18. [Policies & Acknowledgements](#18-policies--acknowledgements)
19. [Self-Hosting: Dependency Audit](#19-self-hosting-dependency-audit)
20. [Self-Hosted Infrastructure (deploy/)](#20-self-hosted-infrastructure-deploy)
21. [NestJS Backend (server/)](#21-nestjs-backend-server)
22. [Build & Verification State](#22-build--verification-state)
23. [Roadmap](#23-roadmap)

---

## 1. Project Overview

**SHINE** is an all-in-one enterprise communication platform — messaging, voice &
HD video calling, screen sharing, team collaboration, communities, organizations,
meetings, file sharing, notifications, an AI assistant, and enterprise
administration — built for organizations of any size, from small teams to
millions of concurrent users.

- **Primary organization:** DEJOIY India Private Limited
- **Owner/CEO account:** `deepak.sharma@corp.dejoiy.com` — permanent **Super Admin**
- **Tagline:** *Powered by DEJOIY*

Competing surface: Amazon Chime · Microsoft Teams · Slack · Discord ·
WhatsApp Business · Telegram · Google Meet · Zoom · Cisco Webex.

### Two parallel tracks

| Track | Stack | Status |
|---|---|---|
| **Live app** (what runs in the preview today) | Vite · React 19 · Tailwind v4 · shadcn/ui · **Convex** backend · Convex Auth · WebRTC (P2P) | ✅ Fully functional |
| **Self-hosted target** | Next.js · NestJS · PostgreSQL/Prisma · Socket.IO · Redis · LiveKit · MinIO · Meilisearch · Novu · Prometheus/Grafana/Loki · NGINX · Docker | 🚧 Backend + infra scaffolded, compiles & validates |

---

## 2. Brand & Design System

### Colors (DEJOIY palette)

| Token | Hex |
|---|---|
| Background (near-black) | `#0B0B0B` |
| Gold (primary accent) | `#D4AF37` |
| White (text/surfaces) | `#FFFFFF` |
| Grey (muted text) | `#8A8F98` |

### Style rules
- Ultra-premium glassmorphism UI, rounded corners, thin borders (no heavy shadows).
- Framer Motion animations everywhere (fades, slides, micro-interactions).
- Dark-first theme via `dark` class + CSS variables in `src/index.css` (oklch, Tailwind v4).
- Fully responsive: desktop, laptop, tablet, foldables, large & small phones, landscape/portrait.
- Global components: `ShineLogo`, `LogoDropdown`, `UserAvatar`, gold-on-black buttons.

---

## 3. Architecture

### 3.1 Live app (Convex)

```
Browser (React 19 + Tailwind + shadcn/ui + Framer Motion)
        │  reactive queries / mutations / actions
        ▼
Convex backend (TypeScript)  ── Convex Auth ── OTP relay (dev) / OAuth / password
  tables: users, organizations, organizationMembers, departments, teams, roles,
          presence, conversations, conversationMembers, messages, reactions,
          polls, bookmarks, calls, meetingParticipants, meetings, notifications,
          files, tasks, contacts, devices, permissionRequests, auditLogs
        │
        └─ WebRTC (P2P) via use-rtc.ts + signaling through Convex (calls.ts, meetings.ts)
```

### 3.2 Self-hosted target

See [§19–§21](#19-self-hosting-dependency-audit). Full diagram in `SELF_HOSTING.md`.

---

## 4. Repository Layout

```
PROJECT.md                  ← this document
README.md                   ← template conventions (Vite/Convex)
SELF_HOSTING.md             ← dependency audit + migration plan
docker-compose.yml          ← full self-hosted stack (repo root)
deploy/                     ← NGINX, LiveKit, Coturn, Prometheus/Grafana/Loki, setup.sh
server/                     ← NestJS + Prisma backend (self-hosted API)
src/
  convex/                   ← Convex backend (auth, users, chats, calls, meetings, …)
  pages/                    ← Landing, Auth, Dashboard, App* pages
  components/               ← app shell, chat, meeting, ui (shadcn), etc.
  hooks/                    ← use-auth, use-rtc, use-presence-heartbeat, …
  lib/                      ← format, emoji, presence, sound, upload, vly-integrations
```

---

## 5. Feature Inventory

| Area | Implemented |
|---|---|
| **Auth** | Email OTP · Anonymous guest · Password login (super admin) · Google/Microsoft/GitHub/Apple SSO buttons (auto-enabled when keys exist) · Magic link (self-hosted API) · Session & device management · Trusted devices |
| **Profile** | Photo (upload/remove) · cover · bio · department · designation · company · location · timezone · skills · employee ID · phone · availability · custom status · notification prefs |
| **Presence** | Online / Away / Busy / Invisible / Offline · heartbeat · last seen · typing indicator |
| **Contacts** | Add · favorites · block · suggested · **directory is search-only** (never a proactive list) |
| **Chat** | 1:1 · group · channel · meeting chat · threads/replies · mentions · reactions · emoji picker · GIF/stickers · polls · edit · delete-for-me · delete-for-everyone · forward · pin · bookmarks · read/delivered state · typing · voice messages · file/media share · message search · global search · infinite scroll · rich text/code blocks |
| **Calls** | 1:1 audio/video via WebRTC · mute · camera toggle · speaker · end · record · ring/connect tones · in-call signals · live call list · history |
| **Meetings** | `DJM-XXX-000` codes · schedule · invite by email · meeting chat + files · join by code or link · password · recording toggle · host start/end/cancel · participant states (mute/cam/raise hand) · history · attendance |
| **Organizations** | Create org (super admin) · teams · departments · invites · member roles · org detail · team management |
| **Tasks** | Create · assign · priority · status · due date · filter |
| **Files** | Upload (storage) · folders · rename/move/delete · list |
| **Notifications** | In-app bell · unread count · mark read/all read · prefs |
| **Admin** | Stats dashboard (users, DAU/MAU, messages/day, call minutes, storage) · user management · role changes · enable/disable · permission requests (request → review → grant) · audit logs · device management |
| **AI (ShineAI)** | Chat assistant · summarize chat · extract action items · generate reply · translate · fix grammar · join meetings |
| **Settings** | Profile · notification prefs · devices (trust/remove) · password (self-hosted) · permission requests |
| **Self-hosted** | Full infra blueprint + NestJS API scaffold (see §19–21) |

---

## 6. Authentication Flows

### 6.1 Email OTP (primary, everyone except the super admin)
1. User enters email on `/auth`.
2. `authProviderStatus` (Convex query) reads `process.env` keys to enable/disable SSO buttons.
3. OTP is requested via the OTP relay; user enters the 6-digit code.
4. Convex Auth creates/signs in the user; `RequireAuth` forwards to the originally requested path.

### 6.2 Password login (super admin — CEO)
- Provider: `ConvexCredentials` provider `id: "password"` in `src/convex/auth.ts`.
- Sign-in: through Dejoiy Mail (mail.dejoiy.com). Admin rights come from Dejoiy Mail: Zimbra global admins become DEJOIY Admin, company admins become Client Admin. There is no default password in the code.
- Flow: sign-in card toggle **"Sign in with password instead"** → username + password form → session minted for the SHINE user row → `bootstrapSuperAdmin` locks in role/company/org → audit log `auth.password_login`.
- Only this one email accepts a password; wrong credentials → clean "Invalid email or password."

### 6.3 SSO (Google / Microsoft / GitHub / Apple)
- Configured through Convex Auth providers; buttons are **enabled only when the matching keys exist** in the project's Keys tab:
  - `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`
  - `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`
  - `AUTH_MICROSOFT_ENTRA_ID_ID` + `AUTH_MICROSOFT_ENTRA_ID_SECRET`
  - `AUTH_APPLE_ID` + `AUTH_APPLE_SECRET`
- Session signing key: `AUTH_SECRET` / `BETTER_AUTH_SECRET`.

### 6.4 Session & device management
- `registerDevice` (dedupes by name+platform, first device auto-trusted) runs via the presence heartbeat hook.
- `myDevices` / `setDeviceTrusted` / `removeDevice` in Settings.
- Every auth/device event is written to `auditLogs`.

### 6.5 Self-hosted API auth
- NestJS JWT (bcrypt password, `accessToken` + profile), magic-link passwordless, OTP; Auth.js on the Next.js frontend (Phase B). See `server/src/auth`.

---

## 7. Super Admin & Roles

### 7.1 The permanent super admin
- `SUPER_ADMIN_EMAIL = "deepak.sharma@corp.dejoiy.com"` (`src/convex/users.ts`).
- **Protected:** cannot be demoted or deactivated by other admins (`admin.ts`).
- `bootstrapSuperAdmin` runs on every app-shell mount (idempotent): sets `role: super_admin`, `company: DEJOIY`, `designation: CEO`, `isActive`, creates the **DEJOIY** organization (owner membership) on first run, and audit-logs the provisioning.

### 7.2 Role hierarchy (8 levels)
```
1 Super Admin → 2 Administrator → 3 IT Team → 4 President → 5 Director
→ 6 Operations Manager → 7 Team Leader → 8 Employee
```
- The full permission matrix (create orgs, announcements, department/team groups, private chat, group chat, meetings, exports, etc.) is documented in the spec and encoded in the self-hosted seed (`server/prisma/seed.ts` — `PERMISSIONS` + `MATRIX` + `ROLES`).

### 7.3 Permission request workflow
1. Any user requests a permission they lack (`requestPermission`, max 5 pending).
2. Super Admin / Admin / IT review via the Admin console (`allPermissionRequests`).
3. On approval, the permission is persisted in `user.approvedPermissions`; request + review are audit-logged.

---

## 8. User Profile & Presence Flows

### 8.1 Profile
- `updateProfile` patches only provided fields; `updateAvatar` uploads via Convex storage and stores the public URL; `removeAvatar` falls back to initials avatar (`UserAvatar`).
- Avatar changes are visible to other employees everywhere (chats, meetings, directory, presence).

### 8.2 Presence
- `usePresenceHeartbeat` calls `heartbeat` every ~30 s with a status (`online|away|busy|invisible|offline`) + custom status; stale rows are opportunistically cleaned.
- `goOffline` on tab close/sign-out; `presenceAll` + `presenceOf` drive the online dots; `effectiveStatus`/`isOnline` helpers in `src/lib/presence.ts`.

---

## 9. Contacts & Directory Flows

- `add` / `remove` / `toggleFavorite` / `toggleBlock` / `suggested` in `src/convex/contacts.ts`.
- **Search-only directory:** employees are found by name/email search — never listed proactively (`users.directory`, `globalSearch`).
- Contact chips/cards show presence; blocked users are excluded.

---

## 10. Chat & Messaging Flows

| Action | Backend | Notes |
|---|---|---|
| List / detail | `conversations.list/detail` | conversation + last message preview |
| 1:1 start | `openDirectChat` | reuses existing or creates |
| Group / channel | `createGroupChat` / `createChannel` / `joinChannel` | |
| Send | `messages.handleSend/send` | text, files, voice; mentions notify `notifyMembers` |
| Threads/replies | `parentId` on messages | threaded in `ChatView` |
| Reactions | `react` + `QUICK_REACTIONS` | emoji picker + quick row |
| Polls | `createPoll` / `votePoll` | rendered by `PollBody` |
| Edit | `edit` | marks `edited` |
| Delete | `deleteForEveryone` / `deleteForMe` | |
| Pin | `pin` | pinned messages list |
| Bookmarks | `toggleBookmark` / `myBookmarks` | |
| Read state | `markRead` + lastReadAt | |
| Typing | `setTyping` / `typingIn` | |
| Search | `searchInConversation` / `globalSearch` | across org |
| Voice messages | upload blob + kind `voice` | |

- `MessageBubble` renders markdown/code blocks, attachments, polls, reactions; `MessageComposer` includes sticker & GIF tabs; meeting chats share the same conversation engine (`isMeeting: true`).

---

## 11. Calls (Audio/Video) Flows

- `src/convex/calls.ts` — `start`, `accept`, `decline`, `end`, `setRecording`, `liveCalls`, `history`, plus WebRTC signaling (`sendSignal` / `signalsFor`).
- `src/hooks/use-rtc.ts` — `useRtc` hook: getUserMedia, RTCPeerConnection, ICE candidates relayed through Convex signaling.
- `CallOverlay.tsx` — floating in-call UI: mute, camera toggle, speaker, end, record indicator, participant info.
- Sound effects via `src/lib/sound.ts` (ring, connect, end tones).
- WebRTC signals for meetings are mirrored in `meetings.ts` (`sendMeetingSignal`/`meetingSignalsFor`) for the MeetingRoom.

---

## 12. Meeting Flows

### 12.1 Room codes — `DJM-XXX-000`
- Format: `DJM` + 3 uppercase letters + 3 digits, e.g. `DJM-ABC-123`.
- Generated in `meetings.makeRoomCode`; uniqueness re-rolled up to 12 times against the `by_roomCode` index.
- `normalizeRoomCode` accepts sloppy input (lowercase, missing dashes) and canonicalizes it for join-by-code.

### 12.2 Schedule flow (`meetings.create`)
1. Host picks title, time, optional password, recording toggle, invitee **emails**.
2. Meeting row created (`status: scheduled`) + a linked meeting chat conversation (`isMeeting: true`) + host participant row.
3. Each invitee email is matched to a user (case-insensitive); participants + conversation members are provisioned; in-app notification sent.
4. Returns `{ meetingId, roomCode, conversationId, invitees }`; the UI sends **invitation emails** with attendee names, room code, time, and join link (via `meetingEmails.ts`, and on the self-hosted API via `MailService.sendMeetingInvite`).
5. Audit log `meeting.scheduled`.

### 12.3 Join / start / end / cancel
- `join` (by id or code) sets participant state, links conversation, flips `scheduled → live`.
- `start` (host) — self-hosted API also starts LiveKit **recording** when enabled.
- `end` (host) marks ended + stamps `leftAt` for all participants.
- `cancel` (host only).
- `myMeetings` (hosted + attending), `history` (last 20 ended), `detail`/`detailByCode`.

### 12.4 Meeting room UI (`MeetingRoom.tsx`)
- WebRTC grid, mute/camera, screen share, reactions popover, meeting chat composer, raise hand, participant list, timer, recording indicator.

---

## 13. Organizations & Teams Flows

- `orgs.create` — only the super admin can create additional organizations; every org is data-isolated.
- `orgs.myOrgs`, `orgDetail`, `update` (name/description), `invite` (email → member), `setMemberRole`, `removeMember`.
- Teams: `createTeam`, `teamDetail`, `addTeamMember`, `removeTeamMember`; departments and the 8-role matrix feed the self-hosted schema.
- `AppOrganizations.tsx` — org switcher + manage UI.

---

## 14. Tasks, Files & Notifications Flows

- **Tasks** (`tasks.ts`): `listByOrg`, `myTasks`, `create` (title/desc/priority/dueDate/assignee), `update`, `setStatus`, `remove`. UI in `AppTasks.tsx`.
- **Files** (`files.ts` + `lib/upload.ts`): `generateUploadUrl` → client uploads blob → `saveFile`; folders (`createFolder`, `deleteFolder`, `renameFile`, `deleteFile`); `myFiles`. UI in `AppFiles.tsx`.
- **Notifications** (`notifications.ts`): `list`, `unreadCount`, `markRead`, `markAllRead`; bell popover in `NotificationsPopover.tsx`; per-user prefs in Settings.

---

## 15. Admin & Governance Flows

- **Dashboard** (`admin.stats`): totals + DAU/MAU, messages-per-day (14-day chart), call minutes, storage bytes.
- **User management** (`manageUsers`): every user + presence + device count; `setUserRole` (guarded: super admin immutable to others, only super admin can grant super_admin); `toggleUserActive`.
- **Permission requests** (see §7.3).
- **Audit logs** (`auditLogs`): last 100 entries with actor resolution; every flow writes via `logAudit` (auth, devices, avatars, roles, permissions, meetings, chats, orgs).
- UI: `AppAdmin.tsx` (stats tiles, tables, health ping).

---

## 16. AI Assistant (ShineAI) Flows

- `src/convex/ai.ts` — `llm` (chat), `status`, `summarizeChat`, `extractActionItems`, `generateReply`, `translate`, `fixGrammar`.
- UI: `ShineAIDrawer.tsx` (slide-over assistant), `CommandPalette.tsx` (⌘K global search/commands), quick actions inside chats.
- AI can join meetings via `meetings.join` (utilized by the drawer's meeting actions).

---

## 17. Email System

### 17.1 Live app (dev)
- OTP relay (managed, dev only) + `meetingEmails.ts` via Vly integrations (`vly.email.sendBatch`).

### 17.2 Self-hosted (target — everything leaves YOUR SMTP)
- Nodemailer transport from `SMTP_*` env vars; per-org SMTP override (identity → `@companydomain`).
- 22 sender identities: `welcome`, `auth`, `security`, `notifications`, `meetings`, `support`, `compliance`, `governance`, `policies`, `training`, `audit`, `risk`, `legal`, `broadcast`, `hr`, `it`, `reports`, `billing`, `system`, `backup`, `monitoring`, `no-reply` — all `@shine.dejoiy.com` by default.
- **SHINE enterprise template engine** (`SHINE_SHELL`): dark + gold branding, variables (name, role, dept, org, meeting, brand colors, signature, buttons, footer "Powered by SHINE · Developed by DEJOIY India Private Limited").
- Templates: welcome, magic_link, otp, meeting_reminder, policy_reminder, password_reset, and the meeting invitation (attendee names + room code + join button).
- Every send is logged to `EmailLog`.

---

## 18. Policies & Acknowledgements

- **Spec:** mandatory acknowledgement of Privacy Policy, Terms, Code of Conduct, Information Security Policy, Employee Communication Policy, Data Protection Policy, Acceptable Use Policy; each acknowledgement stores employee ID, name, role, department, org, IP, browser, device, OS, timestamp, version, signature hash.
- **Implemented (self-hosted backend):** `Policy` + `PolicyAcknowledgement` Prisma models (unique per user/policy/version, `signatureHash`, device/IP metadata), and the seed creates the 7 required DEJOIY policies.
- **UI (Phase B/C):** footer policy links open enterprise modals (title, version, last updated, search, print, PDF, accept/close) + an acknowledgement dashboard for Super Admin/Admin/President/Director/OM with pending/completed/export/reminders.

---

## 19. Self-Hosting: Dependency Audit

Every managed dependency and its replacement (full table in `SELF_HOSTING.md`):

| Component | Current (managed) | Self-hosted replacement |
|---|---|---|
| Database | Convex cloud | **PostgreSQL 16** (Docker) |
| Realtime | Convex subscriptions | **Socket.IO** (NestJS gateway) |
| Auth | Convex Auth + Freebuff OTP relay | **Auth.js** (web) + NestJS JWT (API), your SMTP OTP |
| Email OTP / invites | `auth.freebuff.app` + Vly API | **Your SMTP** (Nodemailer) |
| Object storage | Convex `ctx.storage` | **MinIO** |
| Meetings/media | P2P WebRTC | **LiveKit** (SFU) + **Coturn** |
| Recording/transcript | — | **LiveKit Egress** |
| Search | Convex searchIndex | **Meilisearch** |
| Notifications | Convex table + bell | **Novu** + Socket.IO |
| Monitoring | — | **Prometheus + Grafana + Loki** |
| Proxy/TLS | Vly/Freebuff host | **NGINX** + your certs |
| Containers | — | **Docker + Docker Compose** |

**Must be gone after export:** Freebuff OTP relay, Vly integrations, freebuff.com JWKS, Vly plugin/toolbar, and all Convex cloud usage.

---

## 20. Self-Hosted Infrastructure (deploy/)

- `docker-compose.yml` (repo root): `postgres`, `redis`, `minio`, `meilisearch`, `livekit` + `livekit-egress`, `coturn`, `novu`, `prometheus`, `grafana`, `loki` + `promtail`, `nginx`, `api` (NestJS image), reserved `web` profile for the Next.js frontend.
- `deploy/livekit/livekit.yaml` + `egress.yaml` — SFU + recording (S3 → MinIO).
- `deploy/coturn/turnserver.conf` — TURN/STUN (ports 3478/3479/5349, media range 50000–50100).
- `deploy/nginx/nginx.conf` + `shine.conf` — TLS reverse proxy routing `/api`, `/socket.io`, `/livekit`, `/minio`, `/search`, `/notifications`.
- `deploy/prometheus/prometheus.yml`, `deploy/grafana/provisioning/datasources/datasources.yml`, `deploy/loki/loki-config.yaml` + `promtail.yaml`.
- `deploy/scripts/setup.sh` — generates every secret into `.env` (supersedes the blocked `.env.template` filename), boots the stack, waits for health, prints URLs.
- `deploy/README.md` — full walkthrough: requirements, ports, first boot (`prisma migrate deploy` + `db seed` inside the API container), TLS, operations (backups, logs).

---

## 21. NestJS Backend (server/)

**Stack:** NestJS 10 · Prisma 5 + PostgreSQL · Socket.IO · Nodemailer · MinIO · LiveKit SDK · Meilisearch · Novu · JWT · bcrypt.

### Modules
| Module | Purpose |
|---|---|
| `auth` | `POST /api/auth/login` (bcrypt → JWT), `/me`, `magic-link`, JWT guard + `@CurrentUser()` |
| `users` | Directory (search-only), `PATCH /me`, admin `POST /users` (+ welcome email), profile |
| `realtime` | Socket.IO gateway — JWT auth, presence, typing, `chat:send`/`chat:join` |
| `mail` | Nodemailer + SHINE template engine + per-org SMTP + 22 identities |
| `storage` | MinIO presigned upload/download |
| `integrations` | LiveKit (rooms, join tokens, egress recording → MinIO), Meilisearch, Novu |
| `meetings` | Schedule (`DJM-XXX-000`), invite emails w/ attendee names, join tokens, start/record, cancel, egress webhook |
| `health` | `/health`, `/metrics` for the monitoring stack |
| `prisma` | Shared `PrismaService` |

### Prisma schema (enterprise domain)
Organizations, departments, teams, the 8-role hierarchy with the permission matrix **and per-role device/network policies** (allowed platforms/OS, VPN/IP/country restrictions, exports/uploads/downloads/printing), users/sessions/devices, meetings + recordings, calendar (personal/department/org/holiday/leave/training/reminder) with shares, policies + acknowledgements, chat (conversations/messages), notifications, files, tasks, invites, audit logs, email log.

### Seed (`prisma/seed.ts`)
Idempotent: 38 permissions → role matrix for all 8 roles → DEJOIY organization (gold branding JSON) → **super admin `deepak.sharma@corp.dejoiy.com`** (password from `SUPER_ADMIN_PASSWORD`, required, employee ID `DEJ-0001`, CEO) → 7 required policies.

### Verification status
`bun install` ✅ · `prisma validate` ✅ (0 errors) · `prisma generate` ✅ · `tsc --noEmit` ✅ exit 0.

---

## 22. Build & Verification State

| Check | Result |
|---|---|
| Root `bun tsc -b --noEmit` | ✅ exit 0 |
| Root `bun run build` (`tsc -b && vite build`) | ✅ ~10 s, exit 0 |
| Convex codegen (`bunx convex dev --once`) | ✅ |
| Server `bun run typecheck` | ✅ exit 0 |
| Server `prisma validate` / `generate` | ✅ 0 errors |

> **Known transient issue:** a build may occasionally fail with
> `Cannot find module './converters/ensureBlock.js'` (a partial extraction of
> `@babel/types`). Fix: `bun install` (or remove `node_modules/@babel/types`
> and reinstall). No source changes are required — verified healthy after repair.

---

## 23. Roadmap

| Phase | Scope | Status |
|---|---|---|
| A — Current | Core product on Convex + self-hosted infra/API scaffold | ✅ done |
| B — Frontend port | Next.js App Router + Auth.js (credentials/OTP/OAuth/magic link/passkeys/MFA) + LiveKit client rooms + calendar UI + policy modal/ack dashboard + Excel/CSV import-export UI | 🔜 next |
| C — Feature depth | Google-Meet-parity meetings (whiteboard, captions, breakout rooms, spotlight), device/network access policy enforcement, compliance sheets workflow, meeting attendance/transcripts UI | ⏳ |
| D — Hardening | Backups (pg_dump + MinIO mirror), TLS automation, SMTP verification, load testing, SOC2 controls | ⏳ |

---

*Powered by SHINE — An Enterprise Collaboration Platform. Developed by DEJOIY India Private Limited.*
