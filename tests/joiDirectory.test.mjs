// The mail directory sync must leave Joi's account alone: her picture flipped back to her mailbox's
// old one every 15 minutes because the sync marked her as a mail account (2026-11-15).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/convex/dejoiyMail.ts", import.meta.url), "utf8");
test("Joi is skipped before the directory sync writes anything", () => {
  const loop = src.split("export const applyDirectory")[1];
  const skip = loop.indexOf('if (email === joiEmail() || user?.source === "joi") continue;');
  assert.ok(skip > 0, "skip line present");
  assert.ok(skip < loop.indexOf("applyMail(ctx, user, c)") && skip < loop.indexOf('source: "dejoiy-mail"'), "skip comes before any write");
  assert.ok(loop.indexOf("seen.add(email)") < skip, "Joi is still counted as present, so she is never closed");
});
test("a mail photo never replaces Joi's, whatever her row's mark says", () => {
  assert.ok(src.includes('user.source !== "joi" && user.email !== joiEmail()'));
});
