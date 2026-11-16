// Sets Shine's backend settings on the self-hosted Convex (run by install.sh inside a node container).
// Sign-in keys are made once and kept in /etc/shine/auth-keys.json, so sessions survive redeploys.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const KEYS = "/etc/shine/auth-keys.json";
let keys;
if (existsSync(KEYS)) keys = JSON.parse(readFileSync(KEYS, "utf8"));
else {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  keys = {
    JWT_PRIVATE_KEY: (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " "),
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...jwk }] }),
  };
  writeFileSync(KEYS, JSON.stringify(keys), { mode: 0o600 });
}
// Live spreadsheet feeds (src/convex/feeds.ts): one secret link part, made once and kept like the sign-in keys
const FEED = "/etc/shine/feed-token";
if (!existsSync(FEED)) writeFileSync(FEED, (await import("node:crypto")).randomBytes(24).toString("base64url") + "\n", { mode: 0o600 });
const vars = {
  ...keys,
  SHINE_FEED_TOKEN: readFileSync(FEED, "utf8").trim(),
  SITE_URL: process.env.SHINE_APP_URL,
  DEJOIY_MAIL_SSO_SECRET: process.env.SHINE_SSO_SECRET,
  DEJOIY_MAIL_URL: "https://mail.dejoiy.com",
};
for (const [name, value] of Object.entries(vars)) {
  if (!value) throw new Error(`${name} is empty`);
  execFileSync("npx", ["convex", "env", "set", "--", name, value], { stdio: ["ignore", "ignore", "inherit"] });
  console.log("set", name);
}
// Joi in Shine (optional): from /etc/shine/joi.env, see deploy/contabo/README.md
// Calls through the media server (optional): from /etc/shine/livekit.env, written by setup-calls.sh
for (const name of ["JOI_API_URL", "JOI_APP_SECRET", "JOI_EMAIL", "JOI_SHINE_ORG", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "DEJOIY_PAY_KEY_ID", "DEJOIY_PAY_KEY_SECRET", "DEJOIY_PAY_WEBHOOK_SECRET"]) {
  const value = process.env[name];
  if (!value) continue;
  execFileSync("npx", ["convex", "env", "set", "--", name, value], { stdio: ["ignore", "ignore", "inherit"] });
  console.log("set", name);
}
