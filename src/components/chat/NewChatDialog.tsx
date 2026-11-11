import type { CSSProperties } from "react";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toneFor } from "@/lib/tone";
import { useMutation, useQuery } from "convex/react";
import { CornerDownLeft, Hash, Loader2, MessageCircle, Search, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export function NewChatDialog({
  open,
  onOpenChange,
  preselectUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preselectUserId?: string | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { can } = usePermission();
  const colleagues = useQuery(api.users.directory);
  // plus supervisors at other companies on Shine you're allowed to reach
  const supervisors = useQuery(api.reach.supervisors);
  const directory = useMemo(
    () => (colleagues ? [...colleagues, ...((supervisors ?? []) as unknown as typeof colleagues)] : colleagues),
    [colleagues, supervisors],
  );
  const myOrgs = useQuery(api.orgs.myOrgs);
  const openDirect = useMutation(api.conversations.openDirectChat);
  const createGroup = useMutation(api.conversations.createGroupChat);
  const createChannel = useMutation(api.conversations.createChannel);
  const canGroup = can("group_chat") || can("department_groups") || can("team_groups");

  const [tab, setTab] = useState<"direct" | "group" | "channel">("direct");
  const [q, setQ] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>(preselectUserId ? [preselectUserId] : []);
  const [groupName, setGroupName] = useState("");
  const [chanName, setChanName] = useState("");
  const [chanDesc, setChanDesc] = useState("");
  const [chanKind, setChanKind] = useState<"channel" | "broadcast" | "announcement">("channel");
  const [chanPrivate, setChanPrivate] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  // Group/channel policies
  const [whoCanSend, setWhoCanSend] = useState<"everyone" | "admins">("everyone");
  const [whoCanManageMembers, setWhoCanManageMembers] = useState<"everyone" | "admins">("everyone");
  const [whoCanEditInfo, setWhoCanEditInfo] = useState<"everyone" | "admins">("everyone");

  useEffect(() => {
    if (open) {
      setTab(preselectUserId ? "direct" : "direct");
      setSelected(preselectUserId ? [preselectUserId] : []);
      setQ("");
      setSuggestOpen(false);
      setSuggestIndex(0);
      setGroupName("");
      setChanName("");
      setWhoCanSend("everyone");
      setWhoCanManageMembers("everyone");
      setWhoCanEditInfo("everyone");
      if (myOrgs?.[0]) setOrgId(myOrgs[0]._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectUserId]);

  // Live people suggestions — only appear once you start typing (type "deep"
  // → every Deepak shows up). Excludes people already selected for a group.
  const people = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query || !directory) return [];
    return (directory ?? [])
      .filter((u) => u._id !== user?._id && !u.isAnonymous)
      .filter((u) => !selected.includes(u._id))
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query) ||
          (u.name ?? "").toLowerCase().split(/\s+/).some((w) => w.startsWith(query)),
      )
      .slice(0, 6);
  }, [directory, q, user?._id, selected]);

  const startDirect = async (userId: string) => {
    setBusy(true);
    try {
      const convId = await openDirect({ userId: userId as any });
      onOpenChange(false);
      navigate(`/app/chats/${convId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not start chat");
    } finally {
      setBusy(false);
    }
  };

  const handlePeopleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestOpen && people.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestIndex((i) => (i + 1) % people.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestIndex((i) => (i - 1 + people.length) % people.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickPerson(people[suggestIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestOpen(false);
        return;
      }
    }
  };

  const pickPerson = (p: PeopleSuggestion) => {
    if (tab === "direct") {
      startDirect(p._id);
      return;
    }
    // group tab → add as a member chip
    setSelected((prev) => (prev.includes(p._id) ? prev : [...prev, p._id]));
    setQ("");
    setSuggestOpen(false);
    setSuggestIndex(0);
  };

  const createNewGroup = async () => {
    if (selected.length < 1 || !groupName.trim()) {
      toast("Add members and a group name");
      return;
    }
    setBusy(true);
    try {
      const convId = await createGroup({
        name: groupName.trim(),
        memberIds: selected as any,
        policies: {
          whoCanSend,
          whoCanManageMembers,
          whoCanEditInfo,
        },
      });
      onOpenChange(false);
      navigate(`/app/chats/${convId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create group");
    } finally {
      setBusy(false);
    }
  };

  const createNewChannel = async () => {
    if (!orgId || !chanName.trim()) {
      toast("Choose an organization and a channel name");
      return;
    }
    setBusy(true);
    try {
      const convId = await createChannel({
        orgId: orgId as any,
        name: chanName.trim(),
        description: chanDesc.trim() || undefined,
        channelKind: chanKind,
        isPrivate: chanPrivate,
        policies: {
          whoCanSend,
          whoCanManageMembers,
          whoCanEditInfo,
        },
      });
      onOpenChange(false);
      navigate(`/app/chats/${convId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create channel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold tracking-[-0.03em]">Start a chat</DialogTitle>
          <DialogDescription>Pick what kind, then who.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          {/* three colour cards instead of tabs, like Dejoiy Mail's label colours */}
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-none border-0 bg-transparent p-0">
            {([
              ["direct", "One person", "#ff4fa3", MessageCircle],
              ["group", "A few people", "#ffd23f", Users],
              ["channel", "Whole team", "#4da3ff", Hash],
            ] as const).map(([value, hint, tone, Icon]) => (
              <TabsTrigger
                key={value}
                value={value}
                disabled={value !== "direct" && !canGroup}
                style={{ "--t": tone } as CSSProperties}
                className="tone-card h-auto flex-col items-start gap-2 rounded-[20px] p-3 text-left text-foreground data-[state=active]:border-2 data-[state=active]:border-[var(--sticker-border)] data-[state=active]:bg-[color-mix(in_oklch,var(--t)_38%,var(--card))] data-[state=active]:text-foreground data-[state=active]:shadow-[3px_3px_0_var(--sticker-shadow)] dark:data-[state=active]:bg-[color-mix(in_oklch,var(--t)_38%,var(--card))] dark:data-[state=active]:text-foreground"
              >
                <span className="tone-dot grid size-9 place-items-center rounded-xl border-2 border-[var(--sticker-border)] text-[#121212]">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-extrabold capitalize">{value}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{hint}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {!canGroup && (
            <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Your role only includes private chat. Group chats and channels require a
              permission — request it from <span className="font-medium text-foreground">Settings → Security</span>.
            </p>
          )}

          <TabsContent value="direct" className="mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSuggestOpen(true);
                  setSuggestIndex(0);
                }}
                onFocus={() => q.trim() && setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                onKeyDown={handlePeopleKeyDown}
                placeholder="Search people — type a name…"
                className="h-10 pl-9"
              />
              {suggestOpen && people.length > 0 && (
                <PeopleDropdown
                  people={people}
                  index={suggestIndex}
                  busy={busy}
                  onHover={setSuggestIndex}
                  onPick={pickPerson}
                />
              )}
            </div>
            {!q.trim() && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Type a name or email — matching teammates appear here, e.g. “deepak”.
              </p>
            )}
            {q.trim() && suggestOpen && people.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No people found for “{q.trim()}”.</p>
            )}
          </TabsContent>

          <TabsContent value="group" className="mt-3 space-y-3">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="h-10"
            />
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const u = (directory ?? []).find((p) => p._id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                    >
                      <UserAvatar user={u} size="xs" />
                      {displayName(u)}
                      <button
                        type="button"
                        onClick={() => setSelected((prev) => prev.filter((s) => s !== id))}
                        className="text-primary/60 transition-colors hover:text-primary"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSuggestOpen(true);
                  setSuggestIndex(0);
                }}
                onFocus={() => q.trim() && setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                onKeyDown={handlePeopleKeyDown}
                placeholder={selected.length === 0 ? "Add members — type a name…" : "Add more members…"}
                className="h-10 pl-9"
              />
              {suggestOpen && people.length > 0 && (
                <PeopleDropdown
                  people={people}
                  index={suggestIndex}
                  busy={busy}
                  onHover={setSuggestIndex}
                  onPick={pickPerson}
                />
              )}
            </div>
            {q.trim() && suggestOpen && people.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">No people found for “{q.trim()}”.</p>
            )}
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={createNewGroup}
              disabled={busy || !groupName.trim() || selected.length === 0}
            >
              <Users className="size-4" /> Create group
            </Button>
          </TabsContent>

          <TabsContent value="channel" className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select organization…" />
                </SelectTrigger>
                <SelectContent>
                  {myOrgs?.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!myOrgs || myOrgs.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  Create an organization first (Organizations page) to make channels.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Channel name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={chanName}
                  onChange={(e) => setChanName(e.target.value)}
                  placeholder="launch-team"
                  className="h-10 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Input
                value={chanDesc}
                onChange={(e) => setChanDesc(e.target.value)}
                placeholder="What's this channel about?"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["channel", "broadcast", "announcement"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setChanKind(k)}
                  style={{ "--t": k === "announcement" ? "#ff8a3d" : k === "broadcast" ? "#b892ff" : "#4da3ff" } as CSSProperties}
                  className={cn("tone-card p-3 text-left text-xs", chanKind === k && "is-active")}
                >
                  <div className="font-semibold capitalize">{k}</div>
                  <div className="mt-0.5 text-[10px] opacity-70">
                    {k === "announcement" ? "Only admins post" : k === "broadcast" ? "One-way updates" : "Open discussion"}
                  </div>
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={chanPrivate}
                onCheckedChange={(c) => setChanPrivate(!!c)}
              />
              Private channel (invite only)
            </label>
            <PolicySelector
              whoCanSend={whoCanSend}
              setWhoCanSend={setWhoCanSend}
              whoCanManageMembers={whoCanManageMembers}
              setWhoCanManageMembers={setWhoCanManageMembers}
              whoCanEditInfo={whoCanEditInfo}
              setWhoCanEditInfo={setWhoCanEditInfo}
            />
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={createNewChannel}
              disabled={busy || !chanName.trim() || !orgId}
            >
              <Hash className="size-4" /> Create channel
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface PeopleSuggestion {
  _id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  designation?: string | null;
  customStatus?: string | null;
  department?: string | null;
}

function PolicySelector({
  whoCanSend,
  setWhoCanSend,
  whoCanManageMembers,
  setWhoCanManageMembers,
  whoCanEditInfo,
  setWhoCanEditInfo,
}: {
  whoCanSend: "everyone" | "admins";
  setWhoCanSend: (v: "everyone" | "admins") => void;
  whoCanManageMembers: "everyone" | "admins";
  setWhoCanManageMembers: (v: "everyone" | "admins") => void;
  whoCanEditInfo: "everyone" | "admins";
  setWhoCanEditInfo: (v: "everyone" | "admins") => void;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-accent/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Shield className="size-3" /> Group policies
      </div>
      <PolicyRow label="Who can send messages" value={whoCanSend} onChange={setWhoCanSend} />
      <PolicyRow label="Who can manage members" value={whoCanManageMembers} onChange={setWhoCanManageMembers} />
      <PolicyRow label="Who can edit group info" value={whoCanEditInfo} onChange={setWhoCanEditInfo} />
    </div>
  );
}

function PolicyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "everyone" | "admins";
  onChange: (v: "everyone" | "admins") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(value === "everyone" ? "admins" : "everyone")}
        className={cn(
          "rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors",
          value === "admins"
            ? "bg-primary/15 text-primary"
            : "bg-accent text-muted-foreground",
        )}
      >
        {value === "everyone" ? "Everyone" : "Admins only"}
      </button>
    </div>
  );
}

function PeopleDropdown({
  people,
  index,
  busy,
  onHover,
  onPick,
}: {
  people: PeopleSuggestion[];
  index: number;
  busy: boolean;
  onHover: (i: number) => void;
  onPick: (p: PeopleSuggestion) => void;
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border/80 bg-popover shadow-2xl">
      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        People in your company
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {people.map((p, i) => (
          <button
            key={p._id}
            type="button"
            disabled={busy}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(p);
            }}
            onMouseEnter={() => onHover(i)}
            style={{ "--t": toneFor(p._id) } as CSSProperties}
            className={cn("tone-card mb-1.5 flex w-full items-center gap-3 px-3 py-2.5 text-left", index === i && "is-active")}
          >
            <UserAvatar user={p} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{displayName(p)}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {p.customStatus || p.email || ""}
                {p.designation || p.department ? ` · ${p.designation || p.department}` : ""}
              </div>
            </div>
            <CornerDownLeft className="size-3.5 shrink-0 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
