import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { displayName, timeAgo } from "@/lib/format";
import { ROLE_HIERARCHY, roleMeta } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Check,
  Loader2,
  Mail,
  MessageSquarePlus,
  Plus,
  Sparkles,
  Ticket,
  TicketCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PERMISSION_OPTIONS = [
  { id: "start_meeting", label: "Start / schedule meetings" },
  { id: "group_chat", label: "Create & join group chats" },
  { id: "group_call", label: "Start group audio / video calls" },
  { id: "invite_multiple_users", label: "Invite multiple people to meetings" },
  { id: "company_announcement", label: "Send company-wide announcements" },
  { id: "manage_employees", label: "Manage employees" },
  { id: "view_analytics", label: "View analytics" },
  { id: "system_settings", label: "System settings" },
  { id: "department_groups", label: "Manage department groups" },
  { id: "team_groups", label: "Manage team groups" },
  { id: "delete_chat", label: "Delete chats / messages for everyone" },
  { id: "all_users_mention", label: "@allS — mention every user of the app" },
];

export function AppTickets() {
  const { user } = useAuth();
  const myTickets = useQuery(api.tickets.myTickets);
  const approvalQueue = useQuery(api.tickets.approvalQueue);
  const allOrgs = useQuery(api.admin.allOrgs);
  const createTicket = useMutation(api.tickets.createTicket);
  const decideTicket = useMutation(api.tickets.decideTicket);
  const cancelTicket = useMutation(api.tickets.cancelTicket);
  const addTicketNote = useMutation(api.tickets.addTicketNote);
  const pickupTicket = useMutation(api.tickets.pickupTicket);
  const sendTempPasswordForTicket = useMutation(api.tickets.sendTempPasswordForTicket);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ kind: "permission", target: "", title: "", description: "", priority: "normal", category: "" });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"mine" | "approvals">("mine");

  const myId = user?._id as string | undefined;

  async function submit() {
    if (!form.target.trim()) {
      toast.error("Please choose what you are requesting");
      return;
    }
    setBusy(true);
    try {
      const res = await createTicket({
        kind: form.kind as any,
        target: form.target.trim(),
        title: form.title.trim() || undefined,
        description: form.description.trim() || undefined,
        priority: form.priority as any,
        category: form.category.trim() || undefined,
      });
      toast.success(`Ticket ${res.ticketNumber} created — forwarded up the approval chain`);
      setCreateOpen(false);
      setForm({ kind: "permission", target: "", title: "", description: "", priority: "normal", category: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create ticket");
    } finally {
      setBusy(false);
    }
  }

  const roleOf = (role?: string | null) => roleMeta(role);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Ticket className="size-5 text-primary" /> Access requests
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Enterprise ticketing — request a permission or promotion, and it climbs the role
              hierarchy until the Super Admin has the final word.
            </p>
          </div>
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New request
          </Button>
        </div>

        {/* how it works strip */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <HowCard step="1" title="Raise the ticket" text="You request a permission or role with a reason. A DJT ticket number is issued instantly." />
          <HowCard step="2" title="Forwarded upward" text="Every role above you approves in order — your manager chain, then admins, then Super Admin last." />
          <HowCard step="3" title="Final word" text="Only the Super Admin can close a ticket with final approval. Every decision is audited." />
        </div>

        {/* pending approval banner */}
        {(approvalQueue?.length ?? 0) > 0 && (
          <button
            onClick={() => setTab("approvals")}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-left transition-colors hover:bg-primary/15"
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <TicketCheck className="size-4" />
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-amber-400 text-[9px] font-bold text-black">
                {approvalQueue?.length}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {approvalQueue?.length} ticket{approvalQueue?.length === 1 ? "" : "s"} need your approval
              </div>
              <div className="text-xs text-muted-foreground">
                A request has climbed the hierarchy and is now waiting on you — tap to review.
              </div>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-primary" />
          </button>
        )}

        <div className="mt-6 flex gap-2">
          <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>
            My requests ({myTickets?.length ?? "…"})
          </TabBtn>
          <TabBtn active={tab === "approvals"} onClick={() => setTab("approvals")}>
            Needs my approval ({approvalQueue?.length ?? "…"})
          </TabBtn>
        </div>

        {tab === "mine" && (
          <div className="mt-4 space-y-3">
            {myTickets === undefined ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : myTickets.length === 0 ? (
              <Card className="border-border/70 shadow-none">
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <div className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Ticket className="size-6" />
                  </div>
                  <p className="text-sm font-medium">No tickets yet</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Need access to something your role doesn't include? Raise a request — it goes
                    straight to the approval chain, and the Super Admin always has the final word.
                  </p>
                  <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" /> Raise a request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myTickets.map((t) => (
                <TicketRow
                  key={t._id}
                  t={t}
                  myId={myId}
                  canDecide={false}
                  onAddNote={async (text) => {
                    try {
                      await addTicketNote({ ticketId: t._id as any, text });
                      toast.success("Note added");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                  onCancel={
                    t.status === "pending" || t.status === "in_progress"
                      ? () =>
                          cancelTicket({ ticketId: t._id as any })
                            .then(() => toast.success(`Ticket ${t.ticketNumber} cancelled`))
                            .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                      : undefined
                  }
                />
              ))
            )}
          </div>
        )}

        {tab === "approvals" && (
          <div className="mt-4 space-y-3">
            {approvalQueue === undefined ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : approvalQueue.length === 0 ? (
              <Card className="border-border/70 shadow-none">
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  Nothing is waiting on your approval right now.
                </CardContent>
              </Card>
            ) : (
              approvalQueue.map((t) => {
                const isReviewer = ["super_admin", "dejoiy_admin", "admin"].includes(user?.role as string);
                const atTurn = t.status !== "rejected" && t.status !== "cancelled" && t.status !== "resolved" && String((t.approverChain ?? [])[t.currentLevel ?? 0]) === String(myId);
                const canDecide = (t.status === "pending" || t.status === "in_progress") && (atTurn || (isReviewer && (t.status === "pending" || t.status === "in_progress")));
                return (
                  <TicketRow
                    key={t._id}
                    t={t}
                    myId={myId}
                    canDecide={canDecide}
                    onDecide={async (approve, comment) => {
                      try {
                        const res = await decideTicket({ ticketId: t._id as any, approve, comment: comment || undefined });
                        toast.success(
                          res.status === "approved"
                            ? `Ticket ${t.ticketNumber} fully approved 🎉`
                            : res.status === "rejected"
                              ? "Ticket rejected"
                              : `Forwarded to level ${(res.level ?? 0) + 1} of ${(t.approverChain ?? []).length}`,
                        );
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    onAddNote={async (text) => {
                      try {
                        await addTicketNote({ ticketId: t._id as any, text });
                        toast.success("Note added");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    onPickup={async () => {
                      try {
                        await pickupTicket({ ticketId: t._id as any });
                        toast.success(`Ticket ${t.ticketNumber} picked up`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                    onSendTemp={async () => {
                      try {
                        await sendTempPasswordForTicket({ ticketId: t._id as any });
                        toast.success(`Temp password emailed — ticket resolved`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise an access request</DialogTitle>
            <DialogDescription>
              Your request gets a DJT ticket number and is forwarded up the role hierarchy. The
              final approval always rests with the Super Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">What are you requesting?</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v, target: "" })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permission">A permission</SelectItem>
                  <SelectItem value="role">A role promotion</SelectItem>
                  <SelectItem value="org_update">Update organization</SelectItem>
                  <SelectItem value="general">Something else</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.kind === "permission" && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Permission</Label>
                <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a permission…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_OPTIONS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.kind === "role" && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Target role</Label>
                <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose a role…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_HIERARCHY.slice()
                      .reverse()
                      .map((h) => (
                        <SelectItem key={h.role} value={h.role}>
                          {h.label} ({h.employeeIdPrefix}###)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.kind === "org_update" && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Organization</Label>
                <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose an organization…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(allOrgs ?? []).map((o: any) => (
                      <SelectItem key={o._id} value={o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.kind === "general" && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Request subject</Label>
                <Input
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                  placeholder="e.g. Laptop access to the analytics dashboard"
                  className="h-10"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Short summary"
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Low</SelectItem>
                    <SelectItem value="normal">🔵 Normal</SelectItem>
                    <SelectItem value="high">🟡 High</SelectItem>
                    <SelectItem value="urgent">🟠 Urgent</SelectItem>
                    <SelectItem value="critical">🔴 Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it_support">IT Support</SelectItem>
                    <SelectItem value="access_request">Access Request</SelectItem>
                    <SelectItem value="password_reset">Password Reset</SelectItem>
                    <SelectItem value="account_issue">Account Issue</SelectItem>
                    <SelectItem value="security">Security Incident</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="meeting">Meeting/Calling</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="general">General Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Why do you need it?</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Explain your justification — approvers will read this."
                className="min-h-20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="gap-1.5 bg-primary text-primary-foreground" disabled={busy || !form.target.trim()} onClick={submit}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
              Raise ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HowCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="glass hairline rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {step}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border/80 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TicketRow({
  t,
  myId,
  canDecide,
  onDecide,
  onCancel,
  onAddNote,
  onPickup,
  onSendTemp,
}: {
  t: any;
  myId?: string;
  canDecide: boolean;
  onDecide?: (approve: boolean, comment: string) => Promise<void>;
  onCancel?: () => void;
  onAddNote?: (text: string) => Promise<void>;
  onPickup?: () => Promise<void>;
  onSendTemp?: () => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | boolean>(null);
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [pickupBusy, setPickupBusy] = useState(false);
  const chain: any[] = t.chain ?? [];
  const level = t.currentLevel ?? 0;
  const statusCls =
    t.status === "pending" || t.status === "new"
      ? "bg-amber-500/15 text-amber-400"
      : t.status === "in_progress" || t.status === "open" || t.status === "assigned"
        ? "bg-sky-500/15 text-sky-400"
        : t.status === "approved" || t.status === "resolved"
          ? "bg-emerald-500/15 text-emerald-400"
          : t.status === "rejected" || t.status === "cancelled"
            ? "bg-rose-500/15 text-rose-400"
            : t.status === "escalated"
              ? "bg-orange-500/15 text-orange-400"
              : t.status === "reopened"
                ? "bg-purple-500/15 text-purple-400"
                : t.status === "waiting_for_user" || t.status === "waiting_for_approval"
                  ? "bg-zinc-500/15 text-zinc-400"
                  : "bg-accent text-muted-foreground";
  const priorityCls = !t.priority || t.priority === "normal"
    ? "hidden"
    : t.priority === "critical"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : t.priority === "urgent"
        ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
        : t.priority === "high"
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  const isOpen = t.status === "pending" || t.status === "new" || t.status === "in_progress" || t.status === "open" || t.status === "assigned" || t.status === "reopened" || t.status === "escalated";
  const isPassword = t.kind === "password";

  return (
    <div className="glass hairline rounded-2xl p-4">
      <div className="flex flex-wrap items-start gap-3">
        <UserAvatar user={t.requester} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
              {t.ticketNumber}
            </span>
            <span className="text-sm font-semibold">{t.title}</span>
            <Badge className={statusCls}>{t.status?.replace(/_/g, " ")}</Badge>
            {t.priority && t.priority !== "normal" && (
              <Badge variant="outline" className={cn("text-[10px] capitalize", priorityCls)}>
                {t.priority}
              </Badge>
            )}
            {t.category && (
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">{t.category}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {t.requester ? displayName(t.requester as any) : "Unknown"}
              {t.requester?.employeeId ? ` · ${t.requester.employeeId}` : ""}
            </span>
            <span>·</span>
            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px]">{t.kind}</span>
            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px]">{t.target}</span>
            <span>·</span>
            <span>{timeAgo(t.createdAt)}</span>
          </div>
          {t.description && (
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{t.description}</p>
          )}
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={onCancel}>
            <X className="size-3.5" /> Cancel
          </Button>
        )}
        {(canDecide && onDecide) || (isOpen && onPickup) || (isPassword && isOpen && onSendTemp) ? (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {isPassword && isOpen && onSendTemp && (
              <Button
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={pickupBusy}
                onClick={async () => {
                  setPickupBusy(true);
                  await onSendTemp();
                  setPickupBusy(false);
                }}
              >
                <Mail className="size-3.5" /> Send temp password
              </Button>
            )}
            {isOpen && onPickup && t.status === "pending" && !isPassword && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs text-muted-foreground"
                disabled={pickupBusy}
                onClick={async () => {
                  setPickupBusy(true);
                  await onPickup();
                  setPickupBusy(false);
                }}
              >
                <Check className="size-3.5" /> Pick up
              </Button>
            )}
            {canDecide && onDecide && (
              <>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment (optional)"
                  className="h-8 w-52 rounded-md border border-input bg-background px-2.5 text-xs outline-none transition-colors focus:border-primary/50"
                />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(true);
                      await onDecide(true, comment);
                      setBusy(null);
                    }}
                  >
                    <Check className="size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs text-muted-foreground"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(false);
                      await onDecide(false, comment);
                      setBusy(null);
                    }}
                  >
                    <X className="size-3.5" /> Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* teammate notes — requester + approvers can collaborate */}
      {(t.notes ?? []).length > 0 && (
        <div className="mt-3 space-y-1.5 border-l border-border/60 pl-3">
          {(t.notes ?? []).map((n: any, i: number) => (
            <div key={i} className="flex flex-wrap items-start gap-2 text-[11px] text-muted-foreground">
              <MessageSquarePlus className="mt-0.5 size-3 shrink-0 text-primary" />
              <span className="font-medium text-foreground/80">{n.author?.name ?? "Teammate"}</span>
              <span className="flex-1">{n.text}</span>
              <span className="shrink-0">{timeAgo(n.at)}</span>
            </div>
          ))}
        </div>
      )}
      {onAddNote && isOpen && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for teammates…"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs outline-none transition-colors focus:border-primary/50"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={noteBusy || !note.trim()}
            onClick={async () => {
              setNoteBusy(true);
              await onAddNote(note.trim());
              setNote("");
              setNoteBusy(false);
            }}
          >
            <MessageSquarePlus className="size-3.5" /> Add note
          </Button>
        </div>
      )}

      {/* approval chain */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Approval chain
        </span>
        {chain.map((approver: any, i: number) => {
          const acted = t.decisions?.find((d: any) => String(d.approverId) === String(approver?._id));
          const isCurrent = t.status === "pending" && i === level && String(approver?._id) === String(myId);
          const isWaiting = t.status === "pending" && i === level;
          return (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[10px] text-muted-foreground">→</span>}
              <span
                title={`${approver?.name ?? "?"}${acted ? ` · ${acted.action}${acted.comment ? " · " + acted.comment : ""}` : ""}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  acted?.action === "approved" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                  acted?.action === "rejected" && "border-rose-500/40 bg-rose-500/10 text-rose-400",
                  isCurrent && "border-primary/60 bg-primary/15 font-semibold text-primary",
                  isWaiting && "border-amber-500/40 bg-amber-500/10 text-amber-400",
                  !acted && !isWaiting && "border-border/70 bg-background/40 text-muted-foreground",
                )}
              >
                {approver?.name ?? "?"}
                {isCurrent && <Sparkles className="size-2.5" />}
              </span>
            </span>
          );
        })}
      </div>

      {/* decisions */}
      {(t.decisions ?? []).length > 0 && (
        <div className="mt-3 space-y-1.5 border-l border-border/60 pl-3">
          {(t.decisions ?? []).map((d: any, i: number) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  d.action === "approved" ? "bg-emerald-400" : d.action === "rejected" ? "bg-rose-400" : "bg-primary",
                )}
              />
              <span className="font-medium text-foreground/80">{d.approver?.name ?? "Approver"}</span>
              <span>{d.action}</span>
              {d.comment && <span className="italic">“{d.comment}”</span>}
              <span>· {timeAgo(d.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
