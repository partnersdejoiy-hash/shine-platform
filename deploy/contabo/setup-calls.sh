#!/usr/bin/env bash
# Voice and video calls and meetings through a media server (open source LiveKit) on this server,
# so calls work on mobile data and office networks and meetings hold many people. Run as root, once:
#   bash /opt/shine/deploy/contabo/setup-calls.sh
# Safe to run again: keeps the keys it made, rewrites the config, restarts only the media server.
# Opens two ports: 7881/tcp and 7882/udp (camera and mic). Signalling goes through nginx at
# https://app.shine.dejoiy.com/livekit, so no new DNS name or certificate is needed.
set -euo pipefail
APP_HOST=${APP_HOST:-app.shine.dejoiy.com}
API_HOST=${API_HOST:-convex.shine.dejoiy.com}
SITE_HOST=${SITE_HOST:-convex-site.shine.dejoiy.com}
DIR=${DIR:-/opt/shine}
HERE="$DIR/deploy/contabo"
ENV=/etc/shine/livekit.env
CONF=/etc/shine/livekit.yaml

echo "== Keys"
if [ ! -f "$ENV" ]; then
  umask 077
  printf 'LIVEKIT_URL=wss://%s/livekit\nLIVEKIT_API_KEY=API%s\nLIVEKIT_API_SECRET=%s\n' \
    "$APP_HOST" "$(openssl rand -hex 8)" "$(openssl rand -hex 32)" > "$ENV"
  echo "made $ENV"
else
  echo "kept $ENV"
fi
# shellcheck disable=SC1090
. "$ENV"

echo "== Media server config"
SERVER_IP=$(curl -fsS4 --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
umask 077
cat > "$CONF" <<EOF
# written by setup-calls.sh; edit that script instead
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  node_ip: $SERVER_IP
  use_external_ip: false
keys:
  $LIVEKIT_API_KEY: $LIVEKIT_API_SECRET
room:
  empty_timeout: 300
logging:
  level: info
EOF
chmod 644 "$CONF"   # the container reads it as its own user
echo "media goes to $SERVER_IP, ports 7881/tcp and 7882/udp"

echo "== Firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 7881/tcp >/dev/null && ufw allow 7882/udp >/dev/null && echo "ufw: opened 7881/tcp, 7882/udp"
else
  echo "ufw is not on here. If the server has another firewall (Contabo panel), open 7881/tcp and 7882/udp there."
fi

echo "== nginx (adds /livekit to the app host)"
NGINX=/etc/nginx/sites-available/shine
BACKUP="$NGINX.before-calls.$(date +%s)"
cp "$NGINX" "$BACKUP"
sed "s/__APP__/$APP_HOST/g;s/__API__/$API_HOST/g;s/__SITE__/$SITE_HOST/g" "$HERE/nginx-shine.conf" > "$NGINX"
if ! nginx -t 2>/dev/null; then cp "$BACKUP" "$NGINX"; echo "Stop: the new nginx config did not pass nginx -t; the old one is back."; nginx -t; exit 1; fi
systemctl reload nginx

echo "== Start the media server"
cd "$DIR"
docker compose -p shine --profile calls -f deploy/contabo/docker-compose.yml --env-file /etc/shine/convex.env up -d livekit
docker compose -p shine --profile calls -f deploy/contabo/docker-compose.yml --env-file /etc/shine/convex.env restart livekit >/dev/null
sleep 3
curl -fsS -o /dev/null -w "media server -> %{http_code}\n" http://127.0.0.1:7880/ || { echo "The media server did not start:"; docker logs --tail 30 shine-livekit-1; exit 1; }

echo "== Tell Shine to use it (runs the normal update)"
FIRST=1 bash "$HERE/update.sh"
echo "Calls now go through the media server. Start a call in Shine on two devices to check."
