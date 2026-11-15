// The look ids the page offers are the ones the server accepts, and unknown ids fall back to the default.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/lib/chatLook.ts", import.meta.url), "utf8");
const ids = (name) => [...src.split(`export const ${name} = [`)[1].split("] as const")[0].matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
test("every background on offer has its pattern in the stylesheet", () => {
  for (const id of ids("CHAT_PAPERS")) assert.ok(css.includes(`.chat-paper-${id} {`), id);
});
test("ids are unique and the default background exists", () => {
  for (const name of ["CHAT_TONES", "CHAT_PAPERS"]) assert.equal(new Set(ids(name)).size, ids(name).length);
  assert.ok(ids("CHAT_PAPERS").includes("dots"));
});
test("every theme uses a colour and a background that exist", () => {
  const themes = [...src.split("export const CHAT_THEMES = [")[1].split("] as const")[0].matchAll(/tone: "([a-z]+)", paper: "([a-z]+)"/g)];
  assert.ok(themes.length >= 10);
  for (const [, tone, paper] of themes) assert.ok(ids("CHAT_TONES").includes(tone) && ids("CHAT_PAPERS").includes(paper), tone + " " + paper);
});
test("the server checks both lists before saving", () => {
  const server = readFileSync(new URL("../src/convex/conversations.ts", import.meta.url), "utf8");
  assert.ok(server.includes("!CHAT_TONE_IDS.includes(tone)") && server.includes("!CHAT_PAPER_IDS.includes(paper)"));
});
