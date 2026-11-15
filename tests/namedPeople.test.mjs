// "/invite @Riya Sen @Aman" and "/msg @Riya Sen hi": names are found whole, the longest first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = join(mkdtempSync(join(tmpdir(), "named-")), "namedPeople.mjs");
const res = await build({ entryPoints: [new URL("../src/lib/namedPeople.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
writeFileSync(out, res.outputFiles[0].text);
const { namedPeople } = await import(pathToFileURL(out).href);
const people = [
  { _id: "1", name: "Riya", email: "riya@x.in" },
  { _id: "2", name: "Riya Sen", email: "rs@x.in" },
  { _id: "3", name: "Aman", email: "aman@x.in" },
];

test("full names win over first names, and the message is what is left", () => {
  const r = namedPeople("@Riya Sen are you free?", people);
  assert.deepEqual(r.people.map((p) => p._id), ["2"]);
  assert.equal(r.rest, "are you free?");
});
test("several people, by name or email, any case", () => {
  assert.deepEqual(namedPeople("@riya sen, @aman@x.in", people).people.map((p) => p._id).sort(), ["2", "3"]);
});
test("a name inside a longer word does not count", () => {
  assert.deepEqual(namedPeople("@Amanda hi", people).people, []);
});
