/**
 * Read-only CSV feeds of Shine's numbers for live spreadsheets (Zoho Sheet "Link External Data").
 *   GET https://convex-site.shine.dejoiy.com/feeds/<SHINE_FEED_TOKEN>/shine.csv   by 24h / 7d / 30d / 90d
 *   GET …/feeds/<token>/shine-daily.csv                                         one row a day, last 30 days
 * Counts only: never message text, names or addresses.
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

const DAY = 86_400_000;
const WINDOWS: [string, number][] = [["24h", DAY], ["7d", 7 * DAY], ["30d", 30 * DAY], ["90d", 90 * DAY]];
const TABLES = ["messages", "calls", "meetings", "users", "organizations", "conversations", "payments", "files"] as const;
type Table = (typeof TABLES)[number];

/** One page of a table by creation time: how many fall in each window, plus a few per-table extras. */
export const page = internalQuery({
  args: { table: v.string(), since: v.number(), now: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { table, since, now, cursor }) => {
    if (!(TABLES as readonly string[]).includes(table)) throw new Error("unknown table");
    const res = await ctx.db
      .query(table as Table)
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", since))
      .paginate({ cursor, numItems: 2000 });
    const counts = WINDOWS.map(() => 0);
    const days: Record<string, number> = {};
    const extra: Record<string, number[]> = {};
    const add = (key: string, i: number, n = 1) => ((extra[key] ??= WINDOWS.map(() => 0))[i] += n);
    for (const d of res.page as any[]) {
      if (table === "messages" && d.deleted) continue;
      const t = d._creationTime;
      const day = new Date(t).toISOString().slice(0, 10);
      if (t > now - 30 * DAY) days[day] = (days[day] ?? 0) + (table === "payments" ? (d.status === "paid" ? d.amount : 0) : 1);
      WINDOWS.forEach(([, span], i) => {
        if (t <= now - span) return;
        counts[i]++;
        if (table === "calls") add(d.kind === "video" ? "video" : "audio", i), d.status === "missed" && add("missed", i), d.endedAt && add("minutes", i, Math.round((d.endedAt - d.startedAt) / 60_000));
        if (table === "messages") add(d.parentId ? "replies" : "posts", i);
        if (table === "payments" && d.status === "paid") add("paid", i), add("paise", i, d.amount);
        if (table === "meetings" && d.kind === "webinar") add("webinars", i);
      });
    }
    return { counts, days, extra, cursor: res.continueCursor, done: res.isDone };
  },
});

/** Whole-table totals that need every row (people, companies, who is online now). */
export const totals = internalQuery({
  args: { table: v.string(), now: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { table, now, cursor }) => {
    const out: Record<string, number> = {};
    const bump = (k: string, n = 1) => (out[k] = (out[k] ?? 0) + n);
    if (table === "users") {
      const res = await ctx.db.query("users").paginate({ cursor, numItems: 4000 });
      for (const u of res.page as any[]) if (!u.isAnonymous) bump("people");
      return { out, cursor: res.continueCursor, done: res.isDone };
    }
    if (table === "presence") {
      const res = await ctx.db.query("presence").paginate({ cursor, numItems: 4000 });
      for (const p of res.page as any[]) if (p.updatedAt > now - 5 * 60_000 && p.status !== "offline") bump("online");
      return { out, cursor: res.continueCursor, done: res.isDone };
    }
    const res = await ctx.db.query("organizations").paginate({ cursor, numItems: 4000 });
    for (const o of res.page as any[]) {
      bump("companies");
      if (o.shineOnly) {
        bump("shineOnly");
        if ((o.paidUntil ?? 0) > now) bump("shineOnlyPaying"), bump("shineOnlySeats", o.seats ?? 0);
        else if ((o.trialEnds ?? 0) > now) bump("shineOnlyTrial");
      }
    }
    return { out, cursor: res.continueCursor, done: res.isDone };
  },
});

const cell = (x: unknown) => {
  const s = x === null || x === undefined ? "" : String(x);
  const safe = /^[=+@]/.test(s) || (/^-/.test(s) && Number.isNaN(Number(s))) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export const build = internalAction({
  args: { name: v.string() },
  handler: async (ctx, { name }): Promise<string> => {
    const now = Date.now();
    const scan = async (table: Table) => {
      const sum = { counts: WINDOWS.map(() => 0), days: {} as Record<string, number>, extra: {} as Record<string, number[]> };
      let cursor: string | null = null;
      for (let i = 0; i < 500; i++) {
        const r: any = await ctx.runQuery(internal.feeds.page, { table, since: now - 90 * DAY, now, cursor });
        r.counts.forEach((n: number, j: number) => (sum.counts[j] += n));
        for (const [d, n] of Object.entries(r.days as Record<string, number>)) sum.days[d] = (sum.days[d] ?? 0) + n;
        for (const [k, arr] of Object.entries(r.extra as Record<string, number[]>)) arr.forEach((n, j) => ((sum.extra[k] ??= WINDOWS.map(() => 0))[j] += n));
        if (r.done) break;
        cursor = r.cursor;
      }
      return sum;
    };
    const whole = async (table: string) => {
      const out: Record<string, number> = {};
      let cursor: string | null = null;
      for (let i = 0; i < 500; i++) {
        const r: any = await ctx.runQuery(internal.feeds.totals, { table, now, cursor });
        for (const [k, n] of Object.entries(r.out as Record<string, number>)) out[k] = (out[k] ?? 0) + n;
        if (r.done) break;
        cursor = r.cursor;
      }
      return out;
    };
    if (name === "shine-daily") {
      const [msg, calls, meet, users, pay] = await Promise.all([scan("messages"), scan("calls"), scan("meetings"), scan("users"), scan("payments")]);
      const rows: unknown[][] = [["Date (UTC)", "Messages", "Calls", "Meetings", "New people", "Payments (₹)"]];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * DAY).toISOString().slice(0, 10);
        rows.push([d, msg.days[d] ?? 0, calls.days[d] ?? 0, meet.days[d] ?? 0, users.days[d] ?? 0, (pay.days[d] ?? 0) / 100]);
      }
      return csv(rows);
    }
    const s: Record<string, Awaited<ReturnType<typeof scan>>> = {};
    for (const t of TABLES) s[t] = await scan(t);
    const [people, orgs, online] = [await whole("users"), await whole("organizations"), await whole("presence")];
    const x = (t: Table, k: string) => s[t].extra[k] ?? WINDOWS.map(() => 0);
    const rows: unknown[][] = [
      ["Metric", ...WINDOWS.map(([k]) => k)],
      ["Messages sent", ...s.messages.counts],
      ["  new posts", ...x("messages", "posts")],
      ["  thread replies", ...x("messages", "replies")],
      ["Conversations started", ...s.conversations.counts],
      ["Files shared", ...s.files.counts],
      ["Calls", ...s.calls.counts],
      ["  video", ...x("calls", "video")],
      ["  voice", ...x("calls", "audio")],
      ["  missed", ...x("calls", "missed")],
      ["Call minutes", ...x("calls", "minutes")],
      ["Meetings created", ...s.meetings.counts],
      ["  webinars", ...x("meetings", "webinars")],
      ["New people", ...s.users.counts],
      ["New companies", ...s.organizations.counts],
      ["Payments received", ...x("payments", "paid")],
      ["Money received (₹)", ...x("payments", "paise").map((p) => p / 100)],
      [],
      ["Right now"],
      ["People on Shine", people.people ?? 0],
      ["Online in the last 5 minutes", online.online ?? 0],
      ["Companies", orgs.companies ?? 0],
      ["Shine-only companies", orgs.shineOnly ?? 0],
      ["  paying", orgs.shineOnlyPaying ?? 0],
      ["  on free trial", orgs.shineOnlyTrial ?? 0],
      ["  paid seats", orgs.shineOnlySeats ?? 0],
      ["Updated (UTC)", new Date(now).toISOString().slice(0, 16).replace("T", " ")],
    ];
    return csv(rows);
  },
});
