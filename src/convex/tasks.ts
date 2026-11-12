import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getCurrentUser } from "./users";

const ASSIGNEE_ARGS = {
  assigneeId: v.optional(v.id("users")),
  assigneeIds: v.optional(v.array(v.id("users"))),
};

/** Normalize a task's assignee list (new multi-assignee + legacy single field). */
function resolveAssigneeIds(task: {
  assigneeId?: string | null;
  assigneeIds?: (string | null)[] | null;
}): string[] {
  if (task.assigneeIds && task.assigneeIds.length > 0) {
    return [...new Set(task.assigneeIds.filter((x): x is string => !!x))];
  }
  return task.assigneeId ? [task.assigneeId] : [];
}

/** Pick the first id as the legacy index field. */
function primaryAssignee(ids: string[]): string | undefined {
  return ids[0];
}

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const rows = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(200);
    const enriched = await Promise.all(
      rows.map(async (t) => {
        const ids = resolveAssigneeIds(t);
        const assignees = await Promise.all(ids.map((id) => ctx.db.get(id as any)));
        const creator = await ctx.db.get(t.createdBy);
        return { ...t, assignee: assignees[0] ?? null, assignees, creator };
      }),
    );
    return enriched;
  },
});

export const myTasks = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db.query("tasks").take(500);
    const mine = rows.filter(
      (t: any) =>
        t.assigneeId === me._id ||
        (t.assigneeIds ?? []).some((id: any) => String(id) === String(me._id)),
    );
    const enriched = await Promise.all(
      mine.slice(0, 100).map(async (t) => {
        const ids = resolveAssigneeIds(t);
        const assignees = await Promise.all(ids.map((id) => ctx.db.get(id as any)));
        const org = await ctx.db.get(t.orgId);
        const creator = await ctx.db.get(t.createdBy);
        return { ...t, assignee: assignees[0] ?? null, assignees, org, creator };
      }),
    );
    return enriched;
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    assigneeIds: v.optional(v.array(v.id("users"))),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const ids = [...new Set((args.assigneeIds ?? (args.assigneeId ? [args.assigneeId] : [])).map(String))] as any[];
    const id = await ctx.db.insert("tasks", {
      orgId: args.orgId,
      title: args.title.trim(),
      description: args.description,
      assigneeId: primaryAssignee(ids) as any,
      assigneeIds: ids.length > 0 ? ids : undefined,
      status: "todo",
      priority: args.priority,
      dueDate: args.dueDate,
      createdBy: me._id,
      createdAt: Date.now(),
    });
    const now = Date.now();
    for (const aid of ids) {
      if (String(aid) === String(me._id)) continue;
      await ctx.db.insert("notifications", {
        userId: aid,
        kind: "task",
        title: `New task assigned to you`,
        body: args.title.trim(),
        link: "/app/tasks",
        read: false,
        createdAt: now,
      });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    assigneeIds: v.optional(v.array(v.id("users"))),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    ),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, { taskId, ...patch }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const clean: Record<string, unknown> = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (patch.assigneeIds) {
      const ids = [...new Set(patch.assigneeIds.map(String))] as any[];
      clean.assigneeId = primaryAssignee(ids) as any;
      clean.assigneeIds = ids;
    }
    await ctx.db.patch(taskId, clean);
  },
});

export const setStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
  },
  handler: async (ctx, { taskId, status }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    await ctx.db.patch(taskId, { status });
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new ConvexError("Not authenticated");
    const task = await ctx.db.get(taskId);
    if (!task) return;
    const creator = task.createdBy === me._id;
    const ids = resolveAssigneeIds(task);
    const assignee = ids.some((id) => String(id) === String(me._id));
    if (!creator && !assignee) throw new ConvexError("Not allowed");
    await ctx.db.delete(taskId);
  },
});
