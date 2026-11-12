// Joi's read-only access to someone's own chats: the grant and Joi's fresh signature.
// Run: npm run test:joi   (bundles src/convex/lib/joiGrant.ts with esbuild, then node:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

if (!globalThis.crypto) globalThis.crypto = webcrypto; // Node 18
const out = join(mkdtempSync(join(tmpdir(), "joigrant-")), "joiGrant.mjs");
const res = await build({ entryPoints: [new URL("../src/convex/lib/joiGrant.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
writeFileSync(out, res.outputFiles[0].text);
const g = await import(pathToFileURL(out).href);

const sign = async (secret, claims) => {
  const b64 = (b) => Buffer.from(b).toString("base64url");
  const body = b64(JSON.stringify(claims));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `${body}.${b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))))}`;
};

test("a grant is read back only with this server's key", async () => {
  const key = await g.deriveGrantKey("server-only");
  const t = await g.signGrant(key, { u: "u1", s: "s1", e: "a@b.com", exp: Date.now() + 60_000 });
  assert.equal((await g.readGrant(key, t)).e, "a@b.com");
  assert.equal(await g.readGrant(await g.deriveGrantKey("other"), t), null);
});

test("Joi cannot make a grant with the shared app secret", async () => {
  const key = await g.deriveGrantKey("server-only");
  const forged = await sign("shared-joi-secret", { app: "shine", k: "grant", u: "victim", s: "s", e: "v@b.com", exp: Date.now() + 60_000 });
  assert.equal(await g.readGrant(key, forged), null);
});

test("grants expire and cannot be made to live longer than 12 hours", async () => {
  const key = await g.deriveGrantKey("k");
  assert.equal(await g.readGrant(key, await g.signGrant(key, { u: "u", s: "s", e: "e@x.in", exp: Date.now() - 1 })), null);
  assert.equal(await g.readGrant(key, await g.signGrant(key, { u: "u", s: "s", e: "e@x.in", exp: Date.now() + 13 * 3_600_000 })), null);
  assert.equal(await g.readGrant(key, "junk"), null);
  assert.equal(await g.readGrant(key, 42), null);
});

test("Joi's own signature must be fresh (2 minutes at most)", async () => {
  const now = Date.now();
  assert.equal(await g.readFreshJoiToken("s", await sign("s", { app: "shine", exp: now + 60_000 })), true);
  assert.equal(await g.readFreshJoiToken("s", await sign("s", { app: "shine", exp: now + 12 * 3_600_000 })), false); // the 12-hour widget token is not enough
  assert.equal(await g.readFreshJoiToken("s", await sign("s", { app: "mail", exp: now + 60_000 })), false);
  assert.equal(await g.readFreshJoiToken("x", await sign("s", { app: "shine", exp: now + 60_000 })), false);
  assert.equal(await g.readFreshJoiToken(undefined, await sign("s", { app: "shine", exp: now + 60_000 })), false);
});
