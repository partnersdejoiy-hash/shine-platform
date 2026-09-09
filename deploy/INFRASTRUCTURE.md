# SHINE — Self-Hosted Enterprise Infrastructure

**SHINE · Powered by DEJOIY** — the official Enterprise Communication, Collaboration,
Governance, Compliance and Workplace Platform of **DEJOIY INDIA PRIVATE LIMITED**.

This document is the authoritative blueprint for the self-hosted infrastructure.
Everything runs **on your own hardware** — no mandatory SaaS dependencies. All core
services are Docker Compose–deployed today and Kubernetes-ready tomorrow.

> **Live deployment:** `https://app.shine.dejoiy.com` → `178.104.228.157`

---

## 1. Architecture Overview

```
                    ┌─────────────────────────────────────────────┐
                    │  Reverse proxy (Traefik preferred / NGINX)  │
                    │  Let's Encrypt auto-HTTPS · WSS upgrade     │
                    └──────────────┬──────────────────────────────┘
                                   │
        ┌──────────────┬───────────┴──────────┬───────────────────┐
        │              │                      │                   │
   ┌────▼────┐   ┌─────▼─────┐   ┌────────────▼────────┐   ┌──────▼──────┐
   │  API    │   │ Frontend  │   │  LiveKit SFU +      │   │   Novu      │
   │ NestJS  │   │ (Vite/    │   │  Egress + Coturn    │   │ Notifications│
   │ SocketIO│   │  React)   │   │  (HD media, TURN)   │   │             │
   └────┬────┘   └───────────┘   └────────────┬────────┘   └──────┬──────┘
        │                                    │                    │
   ┌────▼────────────────────────────────────▼────────────────────▼────┐
   │ PostgreSQL 17 · Redis 7 · MinIO (S3) · Meilisearch · RabbitMQ     │
   └───────────────────────────────────────────────────────────────────┘
        │                    │                    │
   ┌────▼────┐   ┌───────────▼─────────┐   ┌──────▼──────────┐
   │  Ops    │   │  Media & Docs       │   │  Security       │
   │ Grafana │   │  OnlyOffice · Tika  │   │  CrowdSec       │
   │ Loki    │   │  Gotenberg · ClamAV │   │  Fail2Ban       │
   │ Uptime  │   │  FFmpeg/ImageMagick │   │  MFA · RBAC     │
   │ Kuma    │   │  Wiki.js            │   │  Audit logs     │
   │ Glitch  │   │  PostHog · n8n      │   │  Infisical      │
   │ Tip     │   └─────────────────────┘   │  Flagsmith      │
   └────┬────┘                             └─────────────────┘
        │
   ┌────▼────┐
   │ Backup  │  Restic → MinIO (encrypted, incremental)
   └─────────┘
```

### Principles
- **100% self-hosted** — the platform keeps working even if internet to third
  parties is unavailable (except external email delivery via **Resend**, which is
  your chosen outbound relay and requires no inbound dependency).
- **Docker Compose today, Kubernetes tomorrow** — services are stateless-fronting
  stateful stores, all config via env vars, all ready for K8s manifests.
- **Profile-gated** — every optional service starts only with its `--profile` flag,
  so a small VPS stays lean and nothing breaks an existing deployment.

---

## 2. Service Catalog (docker-compose.yml)

### Core (started by default — `docker compose up -d`)
| Service | Image | Port (host) | Purpose |
|---|---|---|---|
| `api` | built `./server` | 3001 (internal) | NestJS API, Socket.IO, Prisma, RBAC, Swagger at `/api/docs` |
| `postgres` | postgres:16-alpine | internal | Primary database (upgrade to 17 = change tag + reindex) |
| `redis` | redis:7-alpine | internal | Sessions, presence, typing, OTP, queues, locks, meeting state |
| `minio` | minio/minio | **9100 / 9101** (remapped on prod host) | S3 object storage: files, avatars, recordings, policy PDFs |
| `meilisearch` | getmeili/meilisearch:v1.8 | internal | Instant search: messages, employees, meetings, docs, policies |
| `livekit` | livekit/livekit-server | 7880, 7881, 50000–50100/udp | HD audio/video, screen share, recording (egress) |
| `livekit-egress` | livekit/egress | internal | Recording/transcode → MinIO |
| `coturn` | coturn/coturn | 3478/3479/5349 (host) | TURN/STUN relay for NAT traversal |
| `novu` | novu/novu | 3005 | Notifications: email, in-app, push, SMS-ready, webhooks |
| `novu-mongo` | mongo:7 | internal | Novu store |
| `prometheus` | prom/prometheus | internal | Metrics |
| `grafana` | grafana/grafana | **3001** | Dashboards (Prometheus + Loki datasources pre-provisioned) |
| `loki` + `promtail` | grafana/loki + promtail | internal | Centralized structured logs |
| `nginx` | nginx:1.27-alpine | 80/443 | Reverse proxy (used on fresh installs; Caddy owns prod 80/443) |

### Profile-gated (start on demand — nothing auto-starts)
| Profile | Services | Ports | Purpose |
|---|---|---|---|
| `proxy` | `traefik` | 80/443, 8082 dashboard | Traefik v3 + Let's Encrypt (preferred proxy) |
| `knowledge` | `wikijs` | 3080 | Company handbook, SOPs, policies, knowledge articles |
| `office` | `onlyoffice` | 3083 | Collaborative Word/Excel/PPT + PDF preview |
| `ops` | `uptime-kuma`, `node-exporter`, `postgres-exporter`, `redis-exporter`, `glitchtip` | 3084, 3085 | Uptime monitoring, error tracking (Sentry-alternative), exporters |
| `analytics` | `posthog`, `clickhouse` | 3086 | Product analytics, session replay, feature flags, funnels |
| `workflow` | `n8n` | 3087 | Approval workflows, employee automation, scheduled tasks |
| `media` | `tika`, `gotenberg`, `clamav` | 3088, 3089, 3310 | Document parsing/OCR, PDF generation, virus scanning |
| `security` | `crowdsec` | 8080 (API) | Intrusion detection, brute-force protection |
| `observability` | `otel-collector` | 4317/4318 | OpenTelemetry traces/metrics/logs → Loki + Prometheus |
| `backup` | `restic` | — | Encrypted incremental backups → MinIO, auto-prune |
| `future` | `rabbitmq`, `infisical`, `flagsmith` | 3090/3091, 3092, 3093 | Future microservices broker, secrets manager, feature flags |

> On the production VPS (`178.104.228.157`), **MinIO is remapped to 9100/9101**
> because the DAOS stack already owns 9000/9001. Grafana is remapped to 3001.
> Only **lightweight** profile services should be started on this box (it has
> ~1.4 GB free RAM); heavy ones (OnlyOffice ~2 GB, PostHog ~1 GB) need a bigger
> VPS or to be run selectively.

---

## 3. Enable & Manage Services

```bash
# Core stack (already running on prod)
docker compose up -d

# Optional services — start individually, nothing else is touched
docker compose --profile knowledge up -d   # Wiki.js → http://<server>:3080
docker compose --profile ops up -d         # Uptime Kuma → 3084 · GlitchTip → 3085
docker compose --profile media up -d       # Tika → 3088 · Gotenberg → 3089 · ClamAV → 3310
docker compose --profile backup up -d      # Restic backups (init + hourly loop)

# Stop only what you started
docker compose --profile knowledge stop

# Everything is health-checked and auto-restarts (restart: unless-stopped)
docker compose ps
```

---

## 4. Ports & URLs (production VPS)

| Service | Internal | Public |
|---|---|---|
| App (frontend, Vite build) | `shine-web:80` | **`https://app.shine.dejoiy.com`** |
| API | `api:3001` | `/api` · health `/api/health` · Swagger `/api/docs` |
| Socket.IO | `api:3001` | `/socket.io` (WSS via Caddy) |
| MinIO API/Console | `minio:9000/9001` | `:9100 / :9101` |
| Meilisearch | `meilisearch:7700` | `/search` |
| LiveKit | `livekit:7880` | `/livekit` (WSS) + UDP 50000–50100 |
| Coturn | host | UDP/TCP 3478, 3479, 5349 |
| Novu | `novu:3000` | `/notifications` |
| Grafana | `grafana:3000` | `:3001` |
| Prometheus / Loki | internal | `/prometheus` / internal |
| Wiki.js | `wikijs:3000` | `:3080` |
| OnlyOffice | `onlyoffice:80` | `:3083` |
| Uptime Kuma | `uptime-kuma:3001` | `:3084` |
| GlitchTip | `glitchtip:8080` | `:3085` |
| PostHog | `posthog:8000` | `:3086` |
| n8n | `n8n:5678` | `:3087` |
| Tika / Gotenberg / ClamAV | internal | `:3088 / :3089 / :3310` |
| RabbitMQ / Infisical / Flagsmith | internal | `:3090/3091 / :3092 / :3093` |

---

## 5. Data, Backups & Retention

- **Volumes:** `pgdata`, `redisdata`, `miniodata`, `meilidata`, `egressdata`,
  `grafanadata`, `loki*`, `onlyoffice*`, `uptimekumadata`, `clickhousedata`,
  `n8ndata`, `clamavdata`, `crowdsec*`, `resticdata`, `rabbitmqdata`.
- **Backups:** `restic` profile → encrypted, incremental snapshots to
  `s3://<minio>/shine-backups`, retention: 7 daily / 4 weekly / 6 monthly, auto-prune.
  Add host paths to `deploy/restic/backup/` (or extra volumes) to include them.
- **PostgreSQL PITR:** enable `wal_level=replica` + archive to MinIO for
  point-in-time recovery (see `server/prisma/migrations` for schema history).
- **Retention policy:** configurable per module (messages, meetings, audit logs)
  under Admin → Compliance & Governance.

---

## 6. Email Architecture

- **Outbound:** **Resend** (your API key) via `smtp.resend.com:465` — domain
  **`dejoiy.com` is VERIFIED** in Resend. All senders use `@dejoiy.com`
  identities (`auth@`, `meetings@`, `welcome@`, `notifications@`, `security@`, …).
- **In-app:** API → Resend via `src/convex/emailProvider.ts` (app) and
  `server/src/mail/mail.service.ts` (self-hosted API) with the SHINE enterprise
  template engine (per-org branding, policy footer, action buttons).
- **Self-hosted mail (optional):** add Postal or Mailcow behind the `proxy`
  profile if you ever want to own the full SMTP/IMAP stack. Resend is the live path.

---

## 7. Security

- **Reverse proxy** terminates TLS (Caddy on prod; Traefik/NGINX on fresh installs),
  auto-renewing Let's Encrypt certs.
- **CrowdSec** (profile `security`) — intrusion detection + bouncers for HTTP/SSH.
- **Fail2Ban** on the host for SSH brute force (root password already rotated — see
  deploy notes).
- **ClamAV** (profile `media`) scans all uploads; quarantine bucket in MinIO.
- **MFA / OTP / device trust / audit logs / RBAC** — enforced at the API layer.
- **Secrets** — Infisical (profile `future`) for env/keys/certs; production env is
  in the server's `.env` (generated by `setup.sh`, never committed).

---

## 8. Observability

- **Grafana** (pre-provisioned): Prometheus datasource (metrics) + Loki (logs).
- **OpenTelemetry** (profile `observability`): `otel-collector` on 4317/4318 →
  logs to Loki, metrics remote-write to Prometheus.
- **Uptime Kuma** (profile `ops`): monitors app, SMTP, DB, Redis, LiveKit, MinIO,
  search.
- **GlitchTip** (profile `ops`): self-hosted error tracking (Sentry-compatible DSN:
  `http://glitchtip:8080` — set `SENTRY_DSN` in the API).

---

## 9. Kubernetes Readiness

All services are 12-factor:
- Stateless (API, web, media workers) → scale horizontally behind the proxy.
- Stateful stores (Postgres, Redis, MinIO, Meilisearch, ClickHouse) → use PVCs /
  operators (CloudNativePG, KubeDB) unchanged.
- Config via env vars only → drop into ConfigMaps/Secrets.
- Health endpoints on every service → native K8s probes.

---

## 10. 🔑 Apps That Need External API Keys

Only the following need credentials you own. Everything else is fully self-hosted
and needs **no** external API.

| # | App | Keys (add in project **Keys tab**) | Where to get | Status |
|---|---|---|---|---|
| 1 | **Resend** (email) | `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) | ✅ **Configured** (domain `dejoiy.com` verified) |
| 2 | **Razorpay** (billing) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (+ optional `RAZORPAY_WEBHOOK_SECRET`) | [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → API Keys | ⏳ **Awaiting keys** (code ready) |
| 2b | **Coturn TURN relay** (video meetings behind NAT) | `TURN_URL` (e.g. `turn:meet.dejoiy.com:3478?transport=udp`), `TURN_USERNAME`, `TURN_PASSWORD` | Self-hosted Coturn (`deploy/coturn/turnserver.conf` user line) — set to the same values | 🔧 set on your server |
| 3 | **Google login** | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth client (callback `/api/auth/callback/google`) | ⏳ Awaiting keys |
| 4 | **Microsoft login** | `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Azure portal → App registrations | ⏳ Awaiting keys |
| 5 | **GitHub login** | `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps | ⏳ Awaiting keys |
| 6 | **Apple login** | `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET` | [developer.apple.com](https://developer.apple.com) → Certificates → Keys | ⏳ Awaiting keys |
| 7 | **PostHog** (self-hosted) | no external key — set `POSTHOG_SECRET_KEY` locally | — | 🔧 self-hosted |
| 8 | **GlitchTip / Wiki.js / OnlyOffice / n8n / Infisical / Flagsmith** | all self-hosted, secrets generated by `setup.sh` | — | 🔧 self-hosted |

**Self-hosted and needing no external API:** PostgreSQL, Redis, MinIO, Meilisearch,
LiveKit, Coturn, Novu, Grafana, Prometheus, Loki, Uptime Kuma, ClamAV, Tika,
Gotenberg, CrowdSec, OpenTelemetry, Restic, RabbitMQ, n8n, Wiki.js, OnlyOffice,
PostHog, GlitchTip, Infisical, Flagsmith.

> **Note:** Auth.js secret (`BETTER_AUTH_SECRET`/`AUTH_SECRET`) is already set —
> it signs sessions, it does **not** enable OAuth by itself. OAuth buttons activate
> automatically the moment rows 3–6 keys are added.
