// Shine on its own: what a company pays (per person, GST included) and how paid time adds up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = join(mkdtempSync(join(tmpdir(), "shineplan-")), "shinePlan.mjs");
const res = await build({ entryPoints: [new URL("../src/convex/lib/shinePlan.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
writeFileSync(out, res.outputFiles[0].text);
const { shinePrice, linkPaidSince, DAY } = await import(pathToFileURL(out).href);

test("₹29 a person a month and ₹240 a year, plus 18% GST, in paise", () => {
  assert.equal(shinePrice(1, "month"), 3422);       // ₹34.22
  assert.equal(shinePrice(10, "year"), 283200);     // ₹2,832
});
test("paid time starts after the trial, then after what is already paid", () => {
  const now = 1_800_000_000_000, trialEnds = now + 5 * DAY;
  assert.equal(linkPaidSince(now, 0, trialEnds, "month"), trialEnds + 30 * DAY);
  const paid = now + 10 * DAY;
  assert.equal(linkPaidSince(now, paid, trialEnds, "year"), paid + 365 * DAY);
  assert.equal(linkPaidSince(now, now - DAY, trialEnds, "month"), now + 30 * DAY);   // lapsed: starts today
});
