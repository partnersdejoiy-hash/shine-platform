#!/usr/bin/env bash
# Creates the upload key for the SHINE Android app (run it yourself on a computer with Java's keytool),
# and prints what to paste into the GitHub secrets and android/shine/fingerprints.json.
# Keep the .jks file and its password safe, private and backed up. Never commit them.
set -euo pipefail
out="${1:-shine-upload.jks}"
[ -e "$out" ] && { echo "$out already exists: keep using it (a new key cannot update apps signed with the old one)."; exit 1; }
read -rsp "Choose a keystore password (6+ characters): " pass; echo
keytool -genkeypair -v -keystore "$out" -storepass "$pass" -keypass "$pass" -alias shine -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Dejoiy India Private Limited, O=Dejoiy India Private Limited, L=New Delhi, C=IN" >/dev/null 2>&1
echo; echo "1) GitHub secret SHINE_KEYSTORE_PASSWORD: the password you just typed"
echo "2) GitHub secret SHINE_UPLOAD_KEYSTORE_BASE64:"; base64 -w0 "$out" 2>/dev/null || base64 "$out"; echo
echo "3) Upload key SHA-256 (for android/shine/fingerprints.json):"
keytool -list -v -keystore "$out" -storepass "$pass" -alias shine | grep "SHA256:" | sed 's/.*SHA256: //'
