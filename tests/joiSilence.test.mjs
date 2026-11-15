// When Joi cannot answer in Shine, she says why instead of going quiet (2026-11-15: she just stayed silent).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/convex/joi.ts", import.meta.url), "utf8");
test("every way of failing has a reason", () => {
  const fn = src.split("export async function askJoiOrWhy")[1].split("\n}\n")[0];
  for (const case_ of ["!url || !secret", "catch", "401", "503", "!res.ok", "empty answer"]) assert.ok(fn.includes(case_), case_);
});
test("the reply posts the reason and logs it", () => {
  const reply = src.split("export const reply = internalAction")[1].split("export const post")[0];
  assert.ok(reply.includes('console.error("Joi did not reply:"'));
  assert.ok(reply.includes("Sorry, I couldn't answer just now"));
});
