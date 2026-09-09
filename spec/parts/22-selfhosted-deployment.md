# Part 22 — Self-Hosted Deployment (Docker/Kubernetes)

**Status:** Skeleton · **Depends on:** Part 02, Part 23 · **Last updated:** 2026-08-05

## 1. Purpose

Specify how SHINE runs 100% on the customer's own infrastructure with zero
managed dependencies (no Freebuff, no proprietary APIs).

## 2. Detailed outline

### 2.1 Requirements
- Server sizing, domain/DNS, ports (80/443, 3478/3479/5349, 50000–50100), SMTP.

### 2.2 Service inventory
- NGINX, web (Next.js), API (NestJS), PostgreSQL, Redis, MinIO, Meilisearch,
  LiveKit + Egress, Coturn, Novu, Prometheus, Grafana, Loki + Promtail.

### 2.3 Docker Compose deployment
- Compose file, env generation (`setup.sh`), health waits, first boot
  (`prisma migrate deploy` + seed), upgrades, backups.

### 2.4 Kubernetes (target)
- Helm charts, persistent volumes, HPA, ingress/TLS, secret management,
  node affinity for media.

### 2.5 TLS & networking
- Certbot/ACME, NGINX routing table, TURN external IP, WSS.

### 2.6 Operations
- Logs, redeploy, secrets rotation, zero-downtime upgrade runbook.

### 2.7 License & activation
- Self-hosted license keys (Part 21), offline activation.

## 3. Key decisions locked so far

- `docker-compose.yml` covers the full stack; `deploy/` ships configs for
  LiveKit, Coturn, NGINX, Prometheus/Grafana/Loki; `setup.sh` generates `.env`.
- `server/` builds a Docker image (Dockerfile); web reserved under a profile.
- Full dependency audit in `SELF_HOSTING.md`.

## 4. Open questions to finalize

- [ ] Kubernetes chart scope for v1.0 (Compose-first?).
- [ ] Backup automation (pg_dump + MinIO mirror) runbook.

## 5. Acceptance criteria (placeholders — deep-dive phase)

| ID | Criteria | Priority |
|----|----------|----------|
| P22-AC-01 | `bash deploy/scripts/setup.sh` boots the full stack on a clean server | Must |
| P22-AC-02 | No Freebuff/Vly/Convex-cloud call exists in the deployed stack | Must |
| P22-AC-03 | TLS + TURN + LiveKit media work behind a single domain | Must |
| P22-AC-04 | Backups and restore are documented and tested | Must |
