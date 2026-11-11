#!/usr/bin/env bash
# Connects Joi (her backend on Oracle) to Shine and Dejoiy Mail on this server. Run as root:
#   bash /opt/shine/deploy/contabo/connect-joi.sh
# It asks for the two app secrets from Joi's admin page (joi-ai.dejoiy.com/?view=admin → Connect your app:
# "Shine" and "Dejoiy Mail"). They are read hidden and written only to root-only env files.
set -euo pipefail
JOI=${JOI_API_URL:-https://joi-api.130-210-33-30.sslip.io}
DMAIL_ENV=${DMAIL_ENV:-/etc/dmail/adapter.env}

read -rsp "Shine app secret (Joi admin → Shine): " SHINE; echo
read -rsp "Dejoiy Mail app secret (Joi admin → Dejoiy Mail): " MAIL; echo
[ -n "$SHINE" ] && [ -n "$MAIL" ] || { echo "Both secrets are needed."; exit 1; }

umask 077
printf 'JOI_API_URL=%s\nJOI_APP_SECRET=%s\n' "$JOI" "$SHINE" > /etc/shine/joi.env
sed -i '/^JOI_API_URL=/d;/^JOI_APP_SECRET=/d' "$DMAIL_ENV"
printf 'JOI_API_URL=%s\nJOI_APP_SECRET=%s\n' "$JOI" "$MAIL" >> "$DMAIL_ENV"
unset SHINE MAIL

echo "==> Dejoiy Mail"
systemctl restart dmail
echo "==> Shine (pushes the Joi settings to Shine's backend)"
bash "$(dirname "$0")/update.sh"
echo "Done: Joi answers in Shine and Dejoiy Mail through $JOI"
