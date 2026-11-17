// Meeting guests: a name and an email give a pass for one meeting, and the app treats that pass as signed out.
// Run: npm run test:guests   (bundles the Convex files with esbuild, then node:test against a small fake database)
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const load = async (file) => {
  const out = join(mkdtempSync(join(tmpdir(), "guests-")), "m.mjs");
  const res = await build({ entryPoints: [new URL(`../src/convex/${file}`, import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent" });
  writeFileSync(out, res.outputFiles[0].text);
  return import(pathToFileURL(out).href);
};
const guests = await load("guests.ts");
const users = await load("users.ts");

/** Just enough of ctx.db for these functions: tables of rows, ids like "meetings:1". */
function fakeCtx(tables, signedIn = null) {
  let n = 100;
  const rows = (t) => (tables[t] ??= []);
  const query = (t) => {
    let list = rows(t);
    const q = {
      withIndex: (_name, f) => {
        const conds = [];
        const b = { eq: (field, value) => (conds.push([field, value]), b) };
        f(b);
        list = list.filter((r) => conds.every(([k, v]) => r[k] === v));
        return q;
      },
      first: async () => list[0] ?? null,
      take: async (k) => list.slice(0, k),
      collect: async () => list,
    };
    return q;
  };
  return {
    auth: { getUserIdentity: async () => (signedIn ? { subject: `${signedIn}|session` } : null) },
    db: {
      normalizeId: (t, id) => (typeof id === "string" && id.startsWith(`${t}:`) ? id : null),
      get: async (id) => Object.values(tables).flat().find((r) => r._id === id) ?? null,
      query,
      insert: async (t, doc) => { const _id = `${t}:${++n}`; rows(t).push({ _id, ...doc }); return _id; },
    },
  };
}
const meeting = (over = {}) => ({ _id: "meetings:1", roomCode: "DJM-ABC-DEF", status: "scheduled", title: "Demo", ...over });
const create = (ctx, args) => guests.createGuest._handler(ctx, args);

test("a guest joins an open meeting by its link with a name and an email", async () => {
  const tables = { meetings: [meeting()] };
  const id = await create(fakeCtx(tables), { meeting: "djm-abc-def", name: "  Asha  ", email: "Asha@Client.com " });
  const u = tables.users.find((r) => r._id === id);
  assert.equal(u.name, "Asha (Guest)");
  assert.equal(u.isAnonymous, true);
  assert.equal(u.guestEmail, "asha@client.com");
  assert.equal(u.guestMeetingId, "meetings:1");
  assert.equal(u.email, undefined, "the guest email never becomes a company address");
  // the meeting id works as well as the room code
  await create(fakeCtx(tables), { meeting: "meetings:1", name: "Ravi", email: "ravi@client.com" });
});

test("bad input, ended, locked and private meetings are refused", async () => {
  const tables = { meetings: [meeting(), meeting({ _id: "meetings:2", roomCode: "DJM-END-EDD", status: "ended" }), meeting({ _id: "meetings:3", roomCode: "DJM-LOC-KED", locked: true }),
    meeting({ _id: "meetings:4", roomCode: "DJM-PRI-VAT", openToEveryone: false, inviteEmails: ["Asha@client.com"] })] };
  const ctx = fakeCtx(tables);
  await assert.rejects(create(ctx, { meeting: "djm-abc-def", name: " ", email: "a@b.co" }), /name/);
  await assert.rejects(create(ctx, { meeting: "djm-abc-def", name: "A", email: "not-an-email" }), /email/);
  await assert.rejects(create(ctx, { meeting: "nope", name: "A", email: "a@b.co" }), /ended or the link is wrong/);
  await assert.rejects(create(ctx, { meeting: "djm-end-edd", name: "A", email: "a@b.co" }), /ended/);
  await assert.rejects(create(ctx, { meeting: "djm-loc-ked", name: "A", email: "a@b.co" }), /locked/);
  await assert.rejects(create(ctx, { meeting: "djm-pri-vat", name: "A", email: "x@client.com" }), /private/);
  // an invited email gets in (the host still admits them from the lobby, see meetings.join)
  assert.ok(await create(ctx, { meeting: "djm-pri-vat", name: "Asha", email: "asha@client.com" }));
});

test("a guest is signed out everywhere except the meeting room", async () => {
  const tables = { users: [{ _id: "users:7", name: "Asha (Guest)", isAnonymous: true, guestMeetingId: "meetings:1" }, { _id: "users:8", name: "Deepak", email: "deepak@dejoiy.com" }] };
  assert.equal(await users.getCurrentUser(fakeCtx(tables, "users:7")), null);
  assert.equal((await users.getCurrentUser(fakeCtx(tables, "users:7"), { guests: true }))?._id, "users:7");
  assert.equal((await users.getCurrentUser(fakeCtx(tables, "users:8")))?._id, "users:8");
});
