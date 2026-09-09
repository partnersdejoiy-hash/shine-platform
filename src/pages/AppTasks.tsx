import { api } from "@/convex/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/convex/react";
import { motion } from "framer-motion";
import { Check, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const COLUMNS = [
  { key: "todo", label: "To do", accent: "text-zinc-400", dot: "bg-zinc-400" },
  { key: "in_progress", label: "In progress", accent: "text-sky-400", dot: "bg-sky-400" },
  { key: "done", label: "Done", accent: "text-emerald-400", dot: "bg-emerald-400" },
] as const;

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface TaskRow {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  priority?: string;
  dueDate?: number;
  assignee?: { _id: string; name?: string | null; image?: string | null } | null;
  assignees?: ({ _id: string; name?: string | null; image?: string | null } | null)[];
  org?: { _id: string; name: string } | null;
}

export function AppTasks() {
  const { user } = useAuth();
  const orgs = useQuery(api.orgs.myOrgs);
  const directory = useQuery(api.users.directory);

  const [orgId, setOrgId] = useState<string>("");
  const orgTasks = useQuery(api.tasks.listByOrg, orgId ? { orgId: orgId as any } : "skip");
  const myTasks = useQuery(api.tasks.myTasks);

  const tasks = useMemo(() => {
    const pool = (orgId ? orgTasks ?? [] : myTasks ?? []) as unknown as TaskRow[];
    return [...pool].sort(
      (a, b) =>
        (PRIORITY_ORDER[b.priority ?? "low"] ?? 9) - (PRIORITY_ORDER[a.priority ?? "low"] ?? 9),
    );
  }, [orgId, orgTasks, myTasks]);

  const create = useMutation(api.tasks.create);
  const setStatus = useMutation(api.tasks.setStatus);
  const remove = useMutation(api.tasks.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigneeIds: [] as string[],
    priority: "medium",
    dueDate: "",
  });

  const [createOrgId, setCreateOrgId] = useState("");

  const openCreate = () => {
    const effective = orgId || orgs?.[0]?._id || "";
    setCreateOrgId(effective);
    setForm({ title: "", description: "", assigneeIds: [], priority: "medium", dueDate: "" });
    setCreateOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim() || !createOrgId) {
      toast("Add a title and pick an organization");
      return;
    }
    await create({
      orgId: createOrgId as any,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assigneeIds: form.assigneeIds.length > 0 ? (form.assigneeIds as any) : undefined,
      priority: form.priority as any,
      dueDate: form.dueDate ? new Date(form.dueDate).getTime() : undefined,
    });
    setCreateOpen(false);
    if (!orgId) setOrgId(createOrgId);
  };

  const move = (taskId: string, dir: -1 | 1) => {
    const idx = COLUMNS.findIndex((c) => c.key === "todo");
    const current = tasks.find((t) => t._id === taskId)?.status ?? "todo";
    const ci = COLUMNS.findIndex((c) => c.key === current);
    const next = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, ci + dir))];
    setStatus({ taskId: taskId as any, status: next.key }).catch(() => {});
  };

  if (orgs === undefined) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="glass hairline max-w-md rounded-2xl p-10 text-center">
          <h2 className="text-lg font-semibold">Tasks need an organization</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an organization first, then manage kanban boards for your team.
          </p>
          <Button
            className="mt-5 bg-primary text-primary-foreground"
            onClick={() => (window.location.href = "/app/organizations")}
          >
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {orgId ? "Organization board" : "Assigned to you"} · {tasks.length} tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Board: my tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">My tasks</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o._id} value={o._id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCreate}>
            <Plus className="size-4" /> New task
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-6xl flex-1 gap-4 md:grid-cols-3" style={{ minHeight: 0 }}>
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="flex min-h-0 flex-col rounded-2xl border border-border/70 bg-card/40">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("size-2 rounded-full", col.dot)} />
                  {col.label}
                  <Badge className="bg-accent text-muted-foreground">{colTasks.length}</Badge>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
                {colTasks.map((t, i) => (
                  <motion.div
                    key={t._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    className="group glass hairline rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium", t.status === "done" && "text-muted-foreground line-through")}>
                        {t.title}
                      </p>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {col.key !== "todo" && (
                          <button onClick={() => move(t._id, -1)} className="text-xs text-muted-foreground hover:text-foreground">
                            ←
                          </button>
                        )}
                        {col.key !== "done" && (
                          <button onClick={() => move(t._id, 1)} className="text-xs text-muted-foreground hover:text-foreground">
                            →
                          </button>
                        )}
                        <button
                          onClick={() => remove({ taskId: t._id as any }).catch(() => toast("Only creator/assignee can delete"))}
                          className="text-xs text-muted-foreground hover:text-rose-400"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {t.assignees && t.assignees.length > 0 ? (
                          <div className="flex items-center">
                            <div className="flex -space-x-1.5">
                              {t.assignees.slice(0, 3).map((a) =>
                                a ? (
                                  <span key={a._id} className="rounded-full ring-2 ring-background">
                                    <UserAvatar user={a} size="xs" />
                                  </span>
                                ) : null,
                              )}
                            </div>
                            {t.assignees.length > 3 && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                +{t.assignees.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Unassigned</span>
                        )}
                        {t.dueDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      {t.priority && (
                        <Badge
                          className={cn(
                            "text-[9px]",
                            t.priority === "urgent" && "bg-rose-500/15 text-rose-400",
                            t.priority === "high" && "bg-amber-400/15 text-amber-400",
                            t.priority === "medium" && "bg-sky-400/15 text-sky-400",
                            t.priority === "low" && "bg-zinc-400/15 text-zinc-400",
                          )}
                        >
                          {t.priority}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
                {colTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Add a task to a board and assign it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Organization</Label>
              <Select value={createOrgId} onValueChange={setCreateOrgId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ship the Q3 report"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Details…"
                className="resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assignees</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 w-full justify-start gap-2 text-sm font-normal"
                    >
                      <Users className="size-3.5 text-muted-foreground" />
                      {form.assigneeIds.length === 0
                        ? "Unassigned"
                        : `${form.assigneeIds.length} assigned`}
                      <Check className="ml-auto size-3.5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="max-h-64 w-72 overflow-y-auto p-2">
                    <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Assign to (multiple)
                    </div>
                    {directory?.map((u) => {
                      const checked = form.assigneeIds.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm({
                                ...form,
                                assigneeIds: checked
                                  ? form.assigneeIds.filter((id) => id !== u._id)
                                  : [...form.assigneeIds, u._id],
                              })
                            }
                            className="size-3.5 accent-[#D4AF37]"
                          />
                          <UserAvatar user={u} size="xs" />
                          <span className="truncate text-xs">{displayName(u)}</span>
                        </label>
                      );
                    })}
                  </PopoverContent>
                </Popover>
                {form.assigneeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {form.assigneeIds.map((id) => {
                      const u = directory?.find((d) => d._id === id);
                      return (
                        <span
                          key={id}
                          className="flex items-center gap-1 rounded-full bg-accent py-0.5 pl-1 pr-1 text-[10px]"
                        >
                          <UserAvatar user={u} size="xs" />
                          <span className="max-w-28 truncate">{u ? displayName(u) : "…"}</span>
                          <button
                            onClick={() =>
                              setForm({
                                ...form,
                                assigneeIds: form.assigneeIds.filter((x) => x !== id),
                              })
                            }
                            className="grid size-3.5 place-items-center rounded-full transition-colors hover:bg-rose-500/30"
                            title="Remove"
                          >
                            <X className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Due date</Label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} className="bg-primary text-primary-foreground">
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
