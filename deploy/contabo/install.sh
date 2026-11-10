#!/usr/bin/env bash
# Puts Shine on the Dejoiy Mail server (run as root). Safe to run again; later updates use update.sh.
#   git clone https://github.com/partnersdejoiy-hash/shine-platform /opt/shine
#   bash /opt/shine/deploy/contabo/install.sh
# Needs three DNS A records pointing at this server first (the script checks):
#   app.shine.dejoiy.com, convex.shine.dejoiy.com, convex-site.shine.dejoiy.com
set -euo pipefail
APP_HOST=${APP_HOST:-app.shine.dejoiy.com}
API_HOST=${API_HOST:-convex.shine.dejoiy.com}
SITE_HOST=${SITE_HOST:-convex-site.shine.dejoiy.com}
DIR=${DIR:-/opt/shine}
DMAIL_ENV=${DMAIL_ENV:-/etc/dmail/adapter.env}
HERE="$DIR/deploy/contabo"
mkdir -p /etc/shine /var/www/shine /var/www/acme
chmod 700 /etc/shine

echo "== DNS"
SERVER_IP=$(curl -fsS4 --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
for h in "$APP_HOST" "$API_HOST" "$SITE_HOST"; do
  ip=$(getent ahostsv4 "$h" | awk 'NR==1{print $1}' || true)
  if [ "$ip" != "$SERVER_IP" ]; then
    echo "Stop: $h points to '${ip:-nothing}', this server is $SERVER_IP."
    echo "Add an A record for it -> $SERVER_IP, wait a few minutes, then run this again."; exit 1
  fi
  echo "$h -> $ip ok"
done

echo "== Docker"
command -v rsync >/dev/null || { apt-get update -qq && apt-get install -y -qq rsync; }
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq docker.io docker-compose-v2 rsync
  systemctl enable --now docker
fi

echo "== Secrets"
if [ ! -f /etc/shine/convex.env ]; then
  cat > /etc/shine/convex.env <<CONF
CONVEX_CLOUD_ORIGIN=https://$API_HOST
CONVEX_SITE_ORIGIN=https://$SITE_HOST
INSTANCE_NAME=shine
INSTANCE_SECRET=$(openssl rand -hex 32)
CONF
  chmod 600 /etc/shine/convex.env
fi
# one shared secret: Dejoiy Mail signs chat sign-ins with it, Shine checks them
if ! grep -q '^SHINE_SSO_SECRET=' "$DMAIL_ENV"; then
  cp "$DMAIL_ENV" "/root/adapter.env.bak.$(date +%s)"
  { echo "SHINE_ORIGIN=https://$APP_HOST"; echo "SHINE_SSO_SECRET=$(openssl rand -hex 32)"; } >> "$DMAIL_ENV"
  systemctl restart dmail
fi
SSO_SECRET=$(grep '^SHINE_SSO_SECRET=' "$DMAIL_ENV" | tail -1 | cut -d= -f2-)

echo "== Backend (Convex)"
docker compose -p shine -f "$HERE/docker-compose.yml" --env-file /etc/shine/convex.env up -d
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:3210/version >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:3210/version >/dev/null || { echo "Backend did not start: docker compose -p shine logs backend"; exit 1; }
if [ ! -s /etc/shine/admin-key ]; then
  docker compose -p shine -f "$HERE/docker-compose.yml" exec -T backend ./generate_admin_key.sh | tail -1 > /etc/shine/admin-key
  chmod 600 /etc/shine/admin-key
fi

echo "== HTTPS certificate"
CONF=/etc/nginx/sites-available/shine
if [ ! -f /etc/letsencrypt/live/shine/fullchain.pem ]; then
  # port 80 only until the certificate exists
  sed -n '/^map /p;/^server {/,/^}/{p;/^}/q}' "$HERE/nginx-shine.conf" | sed "s/__APP__/$APP_HOST/;s/__API__/$API_HOST/;s/__SITE__/$SITE_HOST/" > "$CONF"
  ln -sf "$CONF" /etc/nginx/sites-enabled/shine
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/acme --cert-name shine -d "$APP_HOST" -d "$API_HOST" -d "$SITE_HOST" \
    --non-interactive --agree-tos --register-unsafely-without-email
fi
sed "s/__APP__/$APP_HOST/g;s/__API__/$API_HOST/g;s/__SITE__/$SITE_HOST/g" "$HERE/nginx-shine.conf" > "$CONF"
ln -sf "$CONF" /etc/nginx/sites-enabled/shine
nginx -t && systemctl reload nginx

echo "== App (functions + web build)"
APP_HOST=$APP_HOST API_HOST=$API_HOST SSO_SECRET=$SSO_SECRET FIRST=1 bash "$HERE/update.sh"
