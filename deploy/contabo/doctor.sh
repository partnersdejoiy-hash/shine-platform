#!/usr/bin/env bash
# Checks the Shine <-> Dejoiy Mail link on this server and loads the people list now.
#   bash /opt/shine/deploy/contabo/doctor.sh
# Prints no secrets.
DMAIL_ENV=${DMAIL_ENV:-/etc/dmail/adapter.env}
ok(){ echo "  ok   $*"; }; bad(){ echo "  FIX  $*"; }
echo "== Code"
echo "  shine: $(git -C /opt/shine log --oneline -1)"
echo "  mail:  $(git -C /opt/mail-dejoiy log --oneline -1)"
grep -q "def shine_directory" /opt/mail-dejoiy/server/zimbra.py && ok "mail has the Shine directory" || bad "mail is old: cd /opt/mail-dejoiy && git pull --ff-only origin fix/dejoiy-mail-completion && bash deploy/update.sh"
echo "== Settings in $DMAIL_ENV"
for k in SHINE_SSO_SECRET PROVISION_ADMIN PROVISION_ADMIN_PASSWORD; do
  grep -q "^$k=." "$DMAIL_ENV" && ok "$k is set" || bad "$k is missing"
done
SECRET=$(grep '^SHINE_SSO_SECRET=' "$DMAIL_ENV" | tail -1 | cut -d= -f2-)
echo "== Mail answers Shine"
code=$(curl -s -o /tmp/shine-dir.json -w '%{http_code}' -H "Authorization: Bearer $SECRET" https://mail.dejoiy.com/api/shine/directory)
if [ "$code" = 200 ]; then ok "directory: $(grep -o '"email"' /tmp/shine-dir.json | wc -l) mailboxes"
else bad "directory answered $code: $(head -c 200 /tmp/shine-dir.json)"; fi
rm -f /tmp/shine-dir.json
echo "== Shine's backend can reach mail.dejoiy.com"
docker compose -p shine -f /opt/shine/deploy/contabo/docker-compose.yml exec -T backend \
  sh -c 'curl -s -o /dev/null -w "%{http_code}" https://mail.dejoiy.com/api/config' 2>/dev/null | grep -q 200 \
  && ok "yes" || bad "no: the backend container can't open https://mail.dejoiy.com (firewall or DNS inside Docker)"
echo "== Recent backend errors (last hour)"
docker compose -p shine -f /opt/shine/deploy/contabo/docker-compose.yml logs --since 1h backend 2>/dev/null \
  | grep -iE "error|panic|limit" | grep -viE "secret|key|token" | tail -15 | sed 's/^/  /' || true
echo "== Shine backend"
docker run --rm --network host -v /opt/shine:/app -w /app \
  -e CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 -e CONVEX_SELF_HOSTED_ADMIN_KEY="$(cat /etc/shine/admin-key)" \
  -e npm_config_update_notifier=false node:22-bookworm bash -c '
    echo "  DEJOIY_MAIL_URL = $(npx convex env get DEJOIY_MAIL_URL 2>&1 | tail -1)"
    echo "== Loading the people list now"
    npx convex run dejoiyMail:syncDirectory 2>&1 | grep -v "^npm notice" | tail -8
    echo "== People in Shine (email, active)"
    npx convex data users --limit 50 --format jsonLines 2>/dev/null | node -e "
      let n=0; require(\"readline\").createInterface({input:process.stdin}).on(\"line\",l=>{try{const u=JSON.parse(l);n++;console.log(\"  \"+u.email+\"  \"+(u.isActive===false?\"off\":\"on\")+\"  \"+(u.source||\"shine\"))}catch{}}).on(\"close\",()=>console.log(\"  total: \"+n))"
  '
