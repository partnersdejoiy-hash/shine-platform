# Deploying SHINE on your own server

This stack runs everything **on your hardware** — no Freebuff, no proprietary
APIs. Emails leave your SMTP, media flows through your LiveKit, files land in
your MinIO, data lives in your PostgreSQL.

## 1. Requirements

- Linux server (Ubuntu 22.04/24.04 recommended), Docker 24+ + Compose v2
- 4 vCPU / 8 GB RAM minimum, 16 GB recommended (LiveKit egress needs more)
- Domain with DNS → server IP (example uses `shine.dejoiy.com`)
- Open ports:
  - `80/443` — NGINX (web, API, signaling)
  - `3478/udp+tcp`, `3479/udp`, `5349/tcp` — Coturn (TURN/STUN)
  - `50000–50100/udp` — LiveKit media

## 2. Deploy

```bash
# from the repository root
bash deploy/scripts/setup.sh
```

`setup.sh` generates every secret into `.env`, boots all services, waits for
health, and prints the URLs. Then:

1. Edit `.env` → set `PUBLIC_SITE_URL`, `SMTP_HOST/USER/PASS` (emails now go
   through **your** SMTP), `TURN_REALM`, and OAuth keys if you want them.
2. Put TLS certs in `deploy/nginx/certs/` (or run certbot with
   `--webroot -w deploy/nginx/html`) and uncomment the two `ssl_certificate`
   lines in `deploy/nginx/shine.conf`.
3. Set your real public IP in `deploy/coturn/turnserver.conf`
   (`external-ip=...`), then `docker compose restart coturn livekit`.
4. First boot runs `prisma migrate deploy` + `prisma db seed` inside the API
   container — this creates the DEJOIY organization, the 8-role permission
   hierarchy, and the permanent super admin `deepak.sharma@corp.dejoiy.com`
   (password = `SUPER_ADMIN_PASSWORD` in `.env`).

## 3. Where things live

| Service | Internal | Public | Config |
|---|---|---|---|
| NGINX | `nginx:80/443` | `:80/:443` | `deploy/nginx/` |
| NestJS API | `api:3001` | `/api`, `/socket.io` | `server/` |
| PostgreSQL | `postgres:5432` | — | env |
| Redis | `redis:6379` | — | env |
| MinIO | `minio:9000/9001` | `/minio`, console `:9001` | env |
| Meilisearch | `meilisearch:7700` | `/search` | env |
| LiveKit | `livekit:7880` | `/livekit` (WSS) | `deploy/livekit/livekit.yaml` |
| LiveKit Egress | `livekit-egress:7882` | — | `deploy/livekit/egress.yaml` |
| Coturn | host networking | `3478/3479/5349` | `deploy/coturn/turnserver.conf` |
| Novu | `novu:3000` | `/notifications` | env |
| Prometheus | `prometheus:9090` | `/prometheus` | `deploy/prometheus/` |
| Grafana | `grafana:3000` | `/grafana` | `deploy/grafana/` |
| Loki + Promtail | `loki:3100` | — | `deploy/loki/` |

## 4. Video meetings — TURN relay setup

WebRTC meetings need a TURN relay to work for users behind symmetric NAT /
corporate firewalls. This stack ships Coturn; wire it into the app's Keys tab:

1. Edit `deploy/coturn/turnserver.conf` → set `external-ip=<server public IP>`
   and the `user=dejoiy-turn:<password>` line (pick a strong password).
2. Set the same values as env vars in the app's **Keys/API keys tab**:
   ```
   TURN_URL=turn:meet.dejoiy.com:3478?transport=udp
   TURN_USERNAME=dejoiy-turn
   TURN_PASSWORD=<the password from step 1>
   RTC_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
   ```
3. `docker compose up -d coturn` (host networking: ports 3478/3479/5349).

The meeting client automatically picks up these servers (no redeploy needed)
and shows a "TURN relay not configured" hint in the pre-join screen when they
are missing.

## 5. Operations

```bash
docker compose ps                          # status
docker compose logs -f api                 # API logs
docker compose logs -f livekit             # media server logs
docker compose exec postgres pg_dump -U shine shine > backup.sql   # DB backup
docker compose exec api node dist/scripts/backup.js                # full backup
docker compose up -d --force-recreate api # redeploy after code changes
```

## 6. Phase B — frontend

The `web` service (Next.js + Auth.js + Tailwind + shadcn/ui) is reserved in
`docker-compose.yml` under the `web` profile. Once the frontend port lands in
`./web`, run:

```bash
docker compose --profile web up -d --build
```

See `../SELF_HOSTING.md` for the full audit and phase plan.
