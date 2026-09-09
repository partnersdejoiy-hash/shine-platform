import { api } from "@/convex/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/convex/react";
import { motion } from "framer-motion";
import {
  Building2,
  Hash,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ROLE_META: Record<string, { label: string; cls: string }> = {
  owner: { label: "Owner", cls: "bg-primary/15 text-primary" },
  admin: { label: "Admin", cls: "bg-sky-400/15 text-sky-400" },
  member: { label: "Member", cls: "bg-zinc-400/15 text-zinc-400" },
};

export function AppOrganizations() {
  const { user } = useAuth();
  const orgs = useQuery(api.orgs.myOrgs);
  const createOrg = useMutation(api.orgs.create);
  const inviteMember = useMutation(api.orgs.invite);
  const setRole = useMutation(api.orgs.setMemberRole);
  const removeMember = useMutation(api.orgs.removeMember);
  const createTeam = useMutation(api.orgs.createTeam);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", domain: "" });
  const [domainDraft, setDomainDraft] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [teamName, setTeamName] = useState("");

  const detail = useQuery(
    api.orgs.orgDetail,
    selectedOrg ? { orgId: selectedOrg as any } : "skip",
  );
  const updateOrg = useMutation(api.orgs.update);

  const current = useMemo(() => orgs?.find((o) => o._id === selectedOrg) ?? orgs?.[0] ?? null, [orgs, selectedOrg]);
  const effectiveOrg = selectedOrg ?? current?._id ?? null;

  const canManage = detail && (detail.myRole === "owner" || detail.myRole === "admin");

  const submitCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const id = await createOrg({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        domain: form.domain.trim() || undefined,
      });
      setCreateOpen(false);
      setForm({ name: "", description: "", domain: "" });
      setSelectedOrg(id as unknown as string);
      setDomainDraft(form.domain.trim().toLowerCase());
      toast("Organization created");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Creation failed");
    }
  };

  const submitDomain = async () => {
    if (!effectiveOrg) return;
    setSavingDomain(true);
    try {
      await updateOrg({ orgId: effectiveOrg as any, domain: domainDraft.trim() || undefined });
      toast("Domain updated — matching emails join automatically");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDomain(false);
    }
  };

  const submitInvite = async () => {
    if (!effectiveOrg || !invite.email.trim()) return;
    try {
      await inviteMember({
        orgId: effectiveOrg as any,
        email: invite.email.trim(),
        role: invite.role as any,
      });
      setInviteOpen(false);
      setInvite({ email: "", role: "member" });
      toast("Member added");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invite failed");
    }
  };

  const submitTeam = async () => {
    if (!effectiveOrg || !teamName.trim()) return;
    await createTeam({ orgId: effectiveOrg as any, name: teamName.trim() });
    setTeamOpen(false);
    setTeamName("");
    toast("Team created");
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Organizations</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Departments, teams, channels, roles and permissions.
            </p>
          </div>
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create organization
          </Button>
        </div>

        {/* org picker */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          {(orgs ?? []).map((o) => (
            <button
              key={o._id}
              onClick={() => {
                setSelectedOrg(o._id);
                setDomainDraft(o.domain ?? "");
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                effectiveOrg === o._id
                  ? "border-primary/50 bg-primary/8 text-primary"
                  : "border-border/80 hover:border-primary/30",
              )}
            >
              <div className="grid size-7 place-items-center rounded-lg bg-primary/12 text-primary">
                <Building2 className="size-4" />
              </div>
              {o.name}
              <Badge className={ROLE_META[o.myRole]?.cls}>{ROLE_META[o.myRole]?.label}</Badge>
            </button>
          ))}
          {(orgs ?? []).length === 0 && (
            <div className="glass hairline w-full rounded-2xl p-10 text-center">
              <Building2 className="mx-auto mb-3 size-8 text-primary" />
              <h3 className="font-semibold">No organizations yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Create an organization to unlock team channels, roles and project boards.
              </p>
              <Button className="mt-4 bg-primary text-primary-foreground" onClick={() => setCreateOpen(true)}>
                Create your first organization
              </Button>
            </div>
          )}
        </div>

        {detail && (
          <div className="mt-6 space-y-6">
            {/* overview */}
            <div className="glass hairline grid gap-4 rounded-2xl p-5 sm:grid-cols-3">
              <Info tile="Members" value={String(detail.members.length)} icon={Users} />
              <Info tile="Teams" value={String(detail.teams.length)} icon={Users} />
              <Info tile="Channels" value={String(detail.channels.length)} icon={Hash} />
            </div>

            {/* actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!canManage}>
                <UserPlus className="size-4" /> Invite member
              </Button>
              <Button variant="outline" onClick={() => setTeamOpen(true)} disabled={!canManage}>
                <Plus className="size-4" /> New team
              </Button>
            </div>

            {/* domain */}
            {canManage && (
              <section className="glass hairline rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                      <ShieldCheck className="size-4 text-primary" /> Company domain
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Set a domain and every user who signs in with an email ending in
                      @<span className="font-medium text-foreground/80">{domainDraft || "company.com"}</span>{" "}
                      is automatically added as a member — no invite needed. Domain names are unique across organizations.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Input
                      value={domainDraft}
                      onChange={(e) => setDomainDraft(e.target.value)}
                      placeholder="company.com"
                      className="h-9 w-44 font-mono text-xs"
                      disabled={savingDomain}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5"
                      disabled={savingDomain}
                      onClick={submitDomain}
                    >
                      {savingDomain ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                      Save
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {/* members */}
            <section>
              <h2 className="mb-2.5 px-0.5 text-sm font-semibold">Members · {detail.members.length}</h2>
              <div className="glass hairline overflow-hidden rounded-2xl">
                {detail.members.map((m, i) => (
                  <div
                    key={m._id}
                    className={cn("flex items-center gap-3 p-3.5", i > 0 && "border-t border-border/60")}
                  >
                    <UserAvatar user={m} size="md" showStatus />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{displayName(m)}</span>
                        {m._id === user?._id && <Badge className="bg-accent text-muted-foreground">You</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.designation || m.department || m.email}
                      </div>
                    </div>
                    {canManage && m.orgRole !== "owner" ? (
                      <Select
                        value={m.orgRole}
                        onValueChange={(v) =>
                          setRole({ orgId: effectiveOrg as any, userId: m._id as any, role: v as any }).catch(() => {})
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={ROLE_META[m.orgRole]?.cls}>{ROLE_META[m.orgRole]?.label}</Badge>
                    )}
                    {canManage && m.orgRole !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => removeMember({ orgId: effectiveOrg as any, userId: m._id as any }).catch(() => {})}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* teams */}
            <section>
              <h2 className="mb-2.5 px-0.5 text-sm font-semibold">Teams</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {detail.teams.map((t) => (
                  <div key={t._id} className="glass hairline card-hover rounded-2xl p-4">
                    <div className="flex items-center gap-2">
                      <div className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
                        <Users className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {t.memberCount} members
                        </div>
                      </div>
                    </div>
                    {t.description && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                ))}
                {detail.teams.length === 0 && (
                  <p className="text-sm text-muted-foreground">No teams yet.</p>
                )}
              </div>
            </section>

            {/* channels */}
            <section>
              <h2 className="mb-2.5 px-0.5 text-sm font-semibold">Channels</h2>
              <div className="flex flex-wrap gap-2.5">
                {detail.channels.map((c) => (
                  <a
                    key={c._id}
                    href={`/app/chats/${c._id}`}
                    className="flex items-center gap-2 rounded-xl border border-border/80 px-3.5 py-2 text-sm transition-colors hover:border-primary/40"
                  >
                    <Hash className="size-4 text-primary" /> {c.name}
                    {c.channelKind && c.channelKind !== "channel" && (
                      <Badge className="bg-accent text-muted-foreground">{c.channelKind}</Badge>
                    )}
                  </a>
                ))}
                {detail.channels.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Create channels from the Messages page.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* create org dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>Set up a workspace for your company or team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Company name"
              className="h-10"
            />
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does your team do?"
              className="resize-none"
              rows={2}
            />
            <Input
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              placeholder="Company domain (e.g. company.com)"
              className="h-10"
            />
            {form.domain.trim() && (
              <p className="text-[11px] leading-4 text-muted-foreground">
                Anyone signing in with an @{form.domain.trim().toLowerCase().replace(/^@/, "")} email
                is automatically added as a member.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitCreate} disabled={!form.name.trim()} className="bg-primary text-primary-foreground">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>Add someone from your workspace by email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder="teammate@company.com"
              type="email"
              className="h-10"
            />
            <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={submitInvite} className="bg-primary text-primary-foreground">
              <UserPlus className="size-4" /> Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* team dialog */}
      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>Group people into a functional team.</DialogDescription>
          </DialogHeader>
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Platform Engineering"
            className="h-10"
          />
          <DialogFooter>
            <Button onClick={submitTeam} disabled={!teamName.trim()} className="bg-primary text-primary-foreground">
              Create team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ tile, value, icon: Icon }: { tile: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{tile}</div>
      </div>
    </div>
  );
}
