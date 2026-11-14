// SHINE Android app links: node --test tests/assetlinks.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assetlinks, PACKAGE } from "../android/shine/assetlinks.mjs";

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0")).join(":");

test("no fingerprints yet: the site publishes an empty list", () => {
  assert.deepEqual(assetlinks('{"sha256": []}'), []);
  assert.deepEqual(assetlinks("{}"), []);
  assert.deepEqual(assetlinks(readFileSync(new URL("../android/shine/fingerprints.json", import.meta.url), "utf8")), []);
});
test("fingerprints become one statement for the SHINE app, in capitals", () => {
  const out = assetlinks(JSON.stringify({ sha256: [FP] }));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(out[0].target.package_name, PACKAGE);
  assert.equal(PACKAGE, "com.dejoiy.shine");
  assert.deepEqual(out[0].target.sha256_cert_fingerprints, [FP.toUpperCase()]);
});
test("a wrong entry stops the build instead of publishing it", () => {
  assert.throws(() => assetlinks('{"sha256": ["AB:CD"]}'), /not a SHA-256 fingerprint/);
  assert.throws(() => assetlinks("not json"));
});
test("the Android project and the manifest agree on the app", () => {
  const twa = JSON.parse(readFileSync(new URL("../android/shine/twa-manifest.json", import.meta.url), "utf8"));
  const web = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(twa.packageId, PACKAGE); assert.equal(twa.host, "app.shine.dejoiy.com");
  assert.equal(twa.name, "SHINE"); assert.equal(web.name, "SHINE"); assert.equal(web.short_name, "SHINE");
  for (const [size, purpose] of [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]])
    assert.ok(web.icons.some((i) => i.sizes === size && i.purpose === purpose && i.type === "image/png"), `${size} ${purpose}`);
});
