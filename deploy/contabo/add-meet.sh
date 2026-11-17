#!/usr/bin/env bash
# Moves Shine Meet to meet.dejoiy.com on this server (run once as root, after the DNS change):
#   bash /opt/shine/deploy/contabo/add-meet.sh
# Checks that meet.dejoiy.com points here, adds it to Shine's nginx site and HTTPS certificate,
# then redeploys so meeting links from Shine and Dejoiy Mail use it.
set -euo pipefail
APP_HOST=${APP_HOST:-app.shine.dejoiy.com}
API_HOST=${API_HOST:-convex.shine.dejoiy.com}
SITE_HOST=${SITE_HOST:-convex-site.shine.dejoiy.com}
MEET_HOST=${MEET_HOST:-meet.dejoiy.com}
HERE=$(cd "$(dirname "$0")" && pwd)
CONF=/etc/nginx/sites-available/shine

echo "== DNS"
SERVER_IP=$(curl -fsS4 --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
ip=$(getent ahostsv4 "$MEET_HOST" | awk 'NR==1{print $1}' || true)
if [ "$ip" != "$SERVER_IP" ]; then
  echo "Stop: $MEET_HOST points to '${ip:-nothing}', this server is $SERVER_IP."
  echo "Change its A record to $SERVER_IP, wait a few minutes, then run this again."; exit 1
fi
echo "$MEET_HOST -> $ip ok"

echo "== nginx"
cp "$CONF" "$CONF.before-meet"
sed "s/__APP__/$APP_HOST/g;s/__API__/$API_HOST/g;s/__SITE__/$SITE_HOST/g;s/__MEET__/$MEET_HOST/g" "$HERE/nginx-shine.conf" > "$CONF"
if ! nginx -t; then cp "$CONF.before-meet" "$CONF"; echo "nginx config failed; the old one is back."; exit 1; fi
systemctl reload nginx

echo "== HTTPS certificate (adds $MEET_HOST)"
certbot certonly --webroot -w /var/www/acme --cert-name shine --expand \
  -d "$APP_HOST" -d "$API_HOST" -d "$SITE_HOST" -d "$MEET_HOST" --non-interactive --agree-tos --register-unsafely-without-email
systemctl reload nginx

echo "== Redeploy (meeting links now use https://$MEET_HOST)"
bash "$HERE/update.sh"
curl -fsS -o /dev/null -w "https://$MEET_HOST -> %{http_code}\n" "https://$MEET_HOST/"
echo "Done. Open https://$MEET_HOST"
