# SHINE API (NestJS) — self-hosted backend

Part of the SHINE enterprise platform (Powered by DEJOIY). Runs on your own
server with PostgreSQL, Redis, MinIO, Meilisearch, LiveKit and Novu.

## Stack

- NestJS 10 (Node 20, TypeScript)
- Prisma + PostgreSQL 16
- Socket.IO (realtime: presence, typing, chat)
- Nodemailer (all email leaves **your** SMTP — never Freebuff)
- MinIO (S3-compatible object storage, presigned uploads)
- LiveKit SDK (self-hosted SFU + egress recording)
- Meilisearch (global search), Novu (notifications)

## Local development

```bash
cp .env.template .env        # fill in DATABASE_URL etc.
npm install
npx prisma migrate dev
npm run prisma:seed          # roles + permission matrix + DEJOIY org + super admin
npm run start:dev
```

Environment is documented in `.env.template` (and mirrored by
`deploy/scripts/setup.sh` in the repo root). The seed creates
`deepak.sharma@dejoiy.com` (Super Admin / CEO) with the password from
`SUPER_ADMIN_PASSWORD`.

## Key endpoints

| Route | Purpose |
|---|---|
| `POST /api/auth/login` | Email + password login (bcrypt) → JWT |
| `GET /api/auth/me` | Current profile |
| `POST /api/auth/magic-link` | Passwordless magic-link email |
| `GET /api/users/directory?q=` | Org-scoped directory (search only) |
| `POST /api/users` | Admin creates employee + welcome email |
| `POST /api/meetings` | Schedule meeting — `DJM-XXX-000` code + invite emails |
| `POST /api/meetings/:id/join` | LiveKit join token |
| `POST /api/meetings/:id/start` | Host starts; starts recording if enabled |
| `GET /health` · `GET /metrics` | Monitoring (Docker + Prometheus) |
| `GET /socket.io` | Realtime (JWT-authenticated) |

## Schema

`prisma/schema.prisma` models the full enterprise domain: organizations,
departments, teams, the 8-role hierarchy with a permission matrix and
per-role device/network policies, users/sessions/devices, meetings with
recordings, calendar (personal/department/org/holiday/leave/training/
reminder) with shares, policies + acknowledgements, chat, notifications,
files, tasks, invites and audit logs.

## Deploy

`docker compose up -d` from the repository root (see `deploy/README.md`);
this image is built by the `api` service.
