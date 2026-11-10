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
const vars = {
  ...keys,
  SITE_URL: process.env.SHINE_APP_URL,
  DEJOIY_MAIL_SSO_SECRET: process.env.SHINE_SSO_SECRET,
};
for (const [name, value] of Object.entries(vars)) {
  if (!value) throw new Error(`${name} is empty`);
  execFileSync("npx", ["convex", "env", "set", "--", name, value], { stdio: ["ignore", "ignore", "inherit"] });
  console.log("set", name);
}
