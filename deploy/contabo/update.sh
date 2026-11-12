#!/usr/bin/env bash
# Brings Shine up to date on the Dejoiy Mail server (run as root):  bash /opt/shine/deploy/contabo/update.sh
# Pulls the code, pushes the backend functions to the local Convex, rebuilds the web app.
set -euo pipefail
BRANCH=${BRANCH:-feat/gen-z-look}
APP_HOST=${APP_HOST:-app.shine.dejoiy.com}
API_HOST=${API_HOST:-convex.shine.dejoiy.com}
DIR=${DIR:-/opt/shine}
DMAIL_ENV=${DMAIL_ENV:-/etc/dmail/adapter.env}
SSO_SECRET=${SSO_SECRET:-$(grep '^SHINE_SSO_SECRET=' "$DMAIL_ENV" | tail -1 | cut -d= -f2-)}
cd "$DIR"
if [ -z "${FIRST:-}" ]; then
  echo "== Updating code"
  git fetch -q origin "$BRANCH" && git checkout -q "$BRANCH" && git pull -q --ff-only origin "$BRANCH"
  # a new Convex server version restarts the backend (everyone sees "temporarily unavailable"): only when asked
  [ -n "${CONVEX_UPGRADE:-}" ] && docker compose -p shine -f deploy/contabo/docker-compose.yml --env-file /etc/shine/convex.env pull -q
  docker compose -p shine -f deploy/contabo/docker-compose.yml --env-file /etc/shine/convex.env up -d
fi
git log --oneline -1

# node runs in a throwaway container, so the server needs no Node install
# Joi in Shine (optional): JOI_API_URL and JOI_APP_SECRET in /etc/shine/joi.env
JOI_ENV=()
[ -f /etc/shine/joi.env ] && JOI_ENV=(--env-file /etc/shine/joi.env)
docker run --rm --network host "${JOI_ENV[@]}" -v "$DIR":/app -v /etc/shine:/etc/shine -w /app \
  -e CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
  -e CONVEX_SELF_HOSTED_ADMIN_KEY="$(cat /etc/shine/admin-key)" \
  -e SHINE_APP_URL="https://$APP_HOST" -e SHINE_SSO_SECRET="$SSO_SECRET" \
  -e CONVEX_TMPDIR=/app/.convex-tmp \
  -e VITE_CONVEX_URL="https://$API_HOST" -e VITE_DEJOIY_MAIL_URL=https://mail.dejoiy.com \
  node:22-bookworm bash -ec '
    npm ci --no-audit --no-fund --loglevel=error
    mkdir -p /app/.convex-tmp
    npx convex deploy -y --typecheck try
    node deploy/contabo/convex-env.mjs
    npx convex run dejoiyMail:syncDirectory || echo "(people list from Dejoiy Mail not loaded yet: needs PROVISION_ADMIN in /etc/dmail/adapter.env)"
    npx vite build --logLevel warn
  '
# keep last weeks' asset files: tabs opened before this update still load their pages instead of crashing
rsync -a --exclude index.html dist/ /var/www/shine/
cp dist/index.html /var/www/shine/index.html
find /var/www/shine/assets -type f -mtime +14 -delete 2>/dev/null || true
echo "== Check"
curl -fsS -o /dev/null -w "https://$APP_HOST -> %{http_code}\n" "https://$APP_HOST/"
curl -fsS -o /dev/null -w "https://$API_HOST/version -> %{http_code}\n" "https://$API_HOST/version"
echo "Done. Open https://mail.dejoiy.com, press Ctrl+F5 and click Chat."
