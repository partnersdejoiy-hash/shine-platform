// The pass Shine gives a person for one call or meeting room: a standard HS256 JWT in LiveKit's shape.
// Run: node --test tests/liveKitToken.test.mjs   (bundles src/convex/lib/liveKitToken.ts with esbuild)
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { jwtVerify } from "jose";

const out = join(mkdtempSync(join(tmpdir(), "lktoken-")), "liveKitToken.mjs");
const res = await build({ entryPoints: [new URL("../src/convex/lib/liveKitToken.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
writeFileSync(out, res.outputFiles[0].text);
const { liveKitToken, TOKEN_HOURS } = await import(pathToFileURL(out).href);
const secret = "0123456789abcdef0123456789abcdef";

test("signed with the API secret and lets one person into one room", async () => {
  const token = await liveKitToken("APIabc", secret, { room: "call:k1", identity: "user1", name: "Riya Sen", canPublish: true });
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "APIabc" });
  assert.equal(payload.sub, "user1");
  assert.equal(payload.name, "Riya Sen");
  assert.deepEqual(payload.video, { room: "call:k1", roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true });
  assert.ok(payload.exp - payload.nbf <= TOKEN_HOURS * 3600 + 10);
});

test("another secret does not accept it, and a webinar viewer cannot send video", async () => {
  const token = await liveKitToken("APIabc", secret, { room: "meeting:m1", identity: "u2", name: "Viewer", canPublish: false });
  await assert.rejects(jwtVerify(token, new TextEncoder().encode("wrong-secret-wrong-secret-wrong!!")));
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  assert.equal(payload.video.canPublish, false);
});

test("names with non-English letters survive", async () => {
  const token = await liveKitToken("APIabc", secret, { room: "call:k2", identity: "u3", name: "दीपक शर्मा", canPublish: true });
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  assert.equal(payload.name, "दीपक शर्मा");
});
