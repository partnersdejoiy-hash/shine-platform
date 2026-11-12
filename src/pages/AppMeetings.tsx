import { api } from "@/convex/_generated/api";
import { MailCalendar } from "@/components/app/MailCalendar";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { displayName, formatDuration, formatTime, meetingUrl, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ClipboardCopy,
  Clock,
  CornerDownLeft,
  Globe2,
  History,
  Loader2,
  Lock,
  Mail,
  MonitorPlay,
  Plus,
  Radio,
  Search,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { meetingSiteBase } from "@/pages/MeetHome";
import { errorMessage } from "@/lib/errors";

export function AppMeetings() {
  const { user } = useAuth();
  const { can: canPerm } = usePermission();
  const canStart = canPerm("start_meeting");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const meetings = useQuery(api.meetings.myMeetings);
  const history = useQuery(api.meetings.history);
  const directory = useQuery(api.users.directory);
  const create = useMutation(api.meetings.create);
  const cancel = useMutation(api.meetings.cancel);
  const sendInvites = useAction(api.meetingEmails.sendInviteEmails);

  const [scheduleOpen, setScheduleOpen] = useState(searchParams.get("new") === "1");
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [joinCodeQuery, setJoinCodeQuery] = useState<string | null>(null);
  const joinByCodeQuery = useQuery(
    api.meetings.detailByCode,
    joinCodeQuery ? { roomCode: joinCodeQuery } : "skip",
  );
  const [kind, setKind] = useState<"meeting" | "webinar">("meeting");
  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: defaultStart(),
    endTime: defaultStart() + 3600_000,
    password: "",
    recordingEnabled: false,
    openToEveryone: true,
  });
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") setScheduleOpen(true);
  }, [searchParams]);

  const upcoming = useMemo(() => {
    const all = [...(meetings?.hosted ?? []), ...(meetings?.attending ?? [])];
    return all.filter((m) => m.status === "scheduled" || m.status === "live");
  }, [meetings]);

  const addInviteEmail = (raw?: string) => {
    const value = (raw ?? inviteInput).trim();
    if (!value) return;
    const parts = value.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const added: string[] = [];
    for (const p of parts) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) {
        toast(`"${p}" is not a valid email`);
        continue;
      }
      if (!inviteEmails.includes(p) && !added.includes(p)) added.push(p);
    }
    if (added.length) setInviteEmails((prev) => [...prev, ...added]);
    setInviteInput("");
  };

  // Live people suggestions as the host types a name or email (like Google
  // Meet / Chat): type "deepak" → every Deepak in the company shows up.
  const inviteMatches = useMemo(() => {
    const q = inviteInput.trim().toLowerCase();
    if (!q || !directory) return [];
    const taken = new Set(inviteEmails.map((e) => e.toLowerCase()));
    return (directory as (typeof directory)[number][])
      .filter((u) => !u.isAnonymous && u.isActive !== false)
      .filter((u) => {
        const name = (u.name ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return (name.includes(q) || email.includes(q) || name.split(/\s+/).some((w) => w.startsWith(q))) &&
          !taken.has(email);
      })
      .slice(0, 6)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "",
        email: (u.email ?? "").toLowerCase(),
        image: u.image ?? null,
        designation: u.designation ?? "",
      }));
  }, [directory, inviteInput, inviteEmails]);

  const pickInvite = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setInviteEmails((prev) => (prev.includes(e) ? prev : [...prev, e]));
    setInviteInput("");
    setSuggestOpen(false);
  };

  // email → user lookup so invite chips can show the person's avatar + name.
  const directoryByEmail = useMemo(() => {
    const map = new Map<
      string,
      { _id: string; name?: string | null; email?: string | null; image?: string | null }
    >();
    for (const u of directory ?? []) {
      if (u.email) map.set(u.email.toLowerCase(), u);
    }
    return map;
  }, [directory]);

  const schedule = async () => {
    if (!form.title.trim()) {
      toast("Give the meeting a title");
      return;
    }
    setScheduling(true);
    try {
      const res = await create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startTime: form.startTime,
        endTime: form.endTime || undefined,
        password: form.password.trim() || undefined,
        inviteEmails,
        recordingEnabled: form.recordingEnabled,
        kind,
        openToEveryone: form.openToEveryone,
      });
      setScheduleOpen(false);
      setSearchParams({});
      setInviteEmails([]);
      setInviteInput("");
      // Notify every attendee by email with names + meeting details.
      sendInvites({
        meetingId: res.meetingId as any,
        title: form.title.trim(),
        slug: res.slug,
        roomCode: res.roomCode,
        startTime: form.startTime,
        endTime: form.endTime || undefined,
        password: form.password.trim() || undefined,
        hostName: user?.name ?? "Your host",
        invitees: res.invitees,
        siteUrl: meetingSiteBase(),
      })
        .then((r) => {
          if (r.sent > 0) {
            toast.success(`Meeting scheduled · ${r.sent} email invite${r.sent === 1 ? "" : "s"} sent · Room ${res.roomCode}`);
          } else {
            toast(`Meeting scheduled · Room ${res.roomCode}`);
          }
        })
        .catch(() => toast(`Meeting scheduled · Room ${res.roomCode}`));
    } catch (e) {
      toast(e instanceof Error ? errorMessage(e) : "Failed to schedule");
    } finally {
      setScheduling(false);
    }
  };

  const instant = async (k: "meeting" | "webinar" = "meeting") => {
    try {
      const res = await create({
        title:
          k === "webinar"
            ? `Instant webinar · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : `Instant meeting · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        startTime: Date.now(),
        endTime: Date.now() + 3600_000,
        kind: k,
        openToEveryone: true,
      });
      navigate(`/meet/${res.slug}/${res.roomCode}`);
    } catch (e) {
      toast(e instanceof Error ? errorMessage(e) : "Failed to start");
    }
  };

  const tryJoinCode = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 9) {
      toast("Enter the full room code, e.g. DJM-ABC-123");
      return;
    }
    setJoinCodeQuery(c);
  };

  useEffect(() => {
    if (joinCodeQuery && joinByCodeQuery) {
      setJoinOpen(false);
      setCode("");
      setJoinCodeQuery(null);
      navigate(`/meet/${joinByCodeQuery.meeting.slug ?? "meeting"}/${joinByCodeQuery.meeting.roomCode}`);
    }
  }, [joinByCodeQuery, joinCodeQuery, navigate]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Meetings</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              HD video, screen sharing, live captions and AI notes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <Search className="size-4" /> Join with code
            </Button>
            {canStart && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => instant("meeting")}>
                <Video className="size-4" /> Start instant
              </Button>
            )}
          </div>
        </div>
        {!canStart && (
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Your role can join meetings but cannot start or schedule them. Need to host?
            Request the <span className="font-medium text-foreground">start meeting</span> permission from
            Settings → Security.
          </p>
        )}

        {/* Zoho-style Meeting vs Webinar cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass hairline flex flex-col rounded-2xl p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                <Video className="size-5" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight">Meeting</div>
                <div className="text-[11px] text-muted-foreground">Interactive HD video calls</div>
              </div>
            </div>
            <p className="mt-3 flex-1 text-xs leading-5 text-muted-foreground">
              Create a meeting, invite participants, and interact through screen sharing
              and audio/video conferencing.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {canStart ? (
                <>
                  <Button variant="outline" onClick={() => instant("meeting")}>
                    <Video className="size-4" /> Meet now
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setKind("meeting"); setScheduleOpen(true); }}>
                    <CalendarClock className="size-4" /> Schedule
                  </Button>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Join-only · hosting needs the start meeting permission</span>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="glass hairline flex flex-col rounded-2xl p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                <MonitorPlay className="size-5" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight">Webinar</div>
                <div className="text-[11px] text-muted-foreground">Host broadcasts to many viewers</div>
              </div>
            </div>
            <p className="mt-3 flex-1 text-xs leading-5 text-muted-foreground">
              Organize a webinar, invite your audience, and engage with attendees by
              sharing your screen. Viewers join muted to watch and chat.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {canStart ? (
                <>
                  <Button variant="outline" onClick={() => instant("webinar")}>
                    <Radio className="size-4" /> Broadcast now
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setKind("webinar"); setScheduleOpen(true); }}>
                    <CalendarClock className="size-4" /> Schedule
                  </Button>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Join-only · hosting needs the start meeting permission</span>
              )}
            </div>
          </motion.div>
        </div>

        {/* status strip */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard icon={CalendarClock} label="Upcoming" value={upcoming.filter((m) => m.status === "scheduled").length} />
          <StatCard icon={Video} label="Live now" value={upcoming.filter((m) => m.status === "live").length} live />
          <StatCard icon={History} label="Past meetings" value={history?.length ?? 0} />
        </div>

        {/* same calendar as Dejoiy Mail: meetings scheduled here land on it, with the invites */}
        <section className="mt-6">
          <h2 className="mb-2.5 text-sm font-bold">Your calendar</h2>
          <MailCalendar limit={6} />
        </section>

        <Tabs defaultValue="upcoming" className="mt-6">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming & live</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-2.5">
            {meetings === undefined && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
            {meetings && upcoming.length === 0 && (
              <div className="glass hairline rounded-2xl p-10 text-center">
                <Video className="mx-auto mb-3 size-8 text-primary" />
                <h3 className="font-semibold">No meetings yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Start an instant meeting or schedule one for your team.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {canStart && (
                    <Button onClick={() => instant("meeting")} className="bg-primary text-primary-foreground">
                      Start instant
                    </Button>
                  )}
                  {canStart ? (
                    <Button variant="outline" onClick={() => setScheduleOpen(true)}>
                      Schedule
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setJoinOpen(true)}>
                      <Search className="size-4" /> Join with code
                    </Button>
                  )}
                </div>
              </div>
            )}
            {upcoming.map((m, i) => (
              <motion.div
                key={m._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "glass hairline card-hover flex items-center gap-4 rounded-2xl p-4",
                  m.status === "live" && "border-emerald-400/40 ring-1 ring-emerald-400/20",
                )}
              >
                <div
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-xl",
                    m.status === "live" ? "bg-emerald-400/15 text-emerald-400" : "bg-primary/12 text-primary",
                  )}
                >
                  {m.kind === "webinar" ? <MonitorPlay className="size-5" /> : <Video className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{m.title}</span>
                    {m.kind === "webinar" && (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Webinar</Badge>
                    )}
                    {m.status === "live" ? (
                      <Badge className="bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/20">
                        <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
                        LIVE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Scheduled</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {formatTime(m.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" /> {m.participantCount} attending
                    </span>
                    {m.host && <span>Host: {displayName(m.host)}</span>}
                    {m.password && (
                      <span className="flex items-center gap-1">
                        <Lock className="size-3" /> Password protected
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => { const u = new URL(meetingUrl(meetingSiteBase(), m)); navigate(u.pathname + u.search + u.hash); }}
                  >
                    {m.kind === "webinar" && m.hostId !== user?._id ? (
                      <MonitorPlay className="size-4" />
                    ) : (
                      <Video className="size-4" />
                    )}
                    {m.kind === "webinar" && m.hostId !== user?._id
                      ? "Watch"
                      : m.status === "live"
                        ? "Join"
                        : "Enter"}
                  </Button>
                  {m.hostId === user?._id && m.status === "scheduled" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => cancel({ meetingId: m._id as any }).then(() => toast("Meeting cancelled"))}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {history && history.length === 0 ? (
              <div className="glass hairline rounded-2xl p-10 text-center text-sm text-muted-foreground">
                No past meetings yet.
              </div>
            ) : (
              <div className="space-y-2">
                {(history ?? []).map((m) => (
                  <div key={m._id} className="glass hairline flex items-center gap-3 rounded-xl p-3.5">
                    <div className="grid size-9 place-items-center rounded-lg bg-accent text-muted-foreground">
                      <History className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.endTime ? timeAgo(m.endTime) : ""} · {m.endTime && m.startTime ? formatDuration(Math.max(0, (m.endTime - m.startTime) / 1000)) : ""} · Room {m.roomCode}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(meetingUrl(meetingSiteBase(), m)).catch(() => {});
                        toast("Invite link copied");
                      }}
                    >
                      <ClipboardCopy className="size-3.5" /> Link
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* SCHEDULE DIALOG */}
      <Dialog open={scheduleOpen} onOpenChange={(v) => {
        setScheduleOpen(v);
        if (!v) setSearchParams({});
      }}>
        <DialogContent className="sm:max-w-md max-h-[85dvh] flex flex-col p-0">
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-0 min-h-0">
          <DialogHeader>
            <DialogTitle>Schedule {kind === "webinar" ? "a webinar" : "a meeting"}</DialogTitle>
            <DialogDescription>Get an invite link and room code to share.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* kind toggle — Meeting vs Webinar */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/70 bg-background/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setKind("meeting");
                  if (form.title.trim() === "Webinar" || !form.title.trim()) {
                    setForm({ ...form, title: "" });
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  kind === "meeting" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Video className="size-3.5" /> Meeting
              </button>
              <button
                type="button"
                onClick={() => {
                  setKind("webinar");
                  if (!form.title.trim()) setForm({ ...form, title: "Webinar" });
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  kind === "webinar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <MonitorPlay className="size-3.5" /> Webinar
              </button>
            </div>
            {kind === "webinar" && (
              <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                Viewers join muted in watch mode — only you (and moderators) broadcast audio & video.
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={kind === "webinar" ? "All-hands webinar" : "Weekly sync"}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Agenda, links, notes…"
                className="resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <input
                  type="datetime-local"
                  value={toLocalInput(form.startTime)}
                  onChange={(e) =>
                    setForm({ ...form, startTime: new Date(e.target.value).getTime() || Date.now() })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <input
                  type="datetime-local"
                  value={toLocalInput(form.endTime)}
                  onChange={(e) =>
                    setForm({ ...form, endTime: new Date(e.target.value).getTime() || Date.now() })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Meeting password (optional)</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Leave empty for none"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invite attendees by email</Label>
              <div className="relative">
                <Input
                  value={inviteInput}
                  onChange={(e) => {
                    setInviteInput(e.target.value);
                    setSuggestOpen(true);
                    setSuggestIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (suggestOpen && inviteMatches.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSuggestIndex((i) => (i + 1) % inviteMatches.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSuggestIndex((i) => (i - 1 + inviteMatches.length) % inviteMatches.length);
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        pickInvite(inviteMatches[suggestIndex].email);
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setSuggestOpen(false);
                        return;
                      }
                    }
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addInviteEmail();
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setSuggestOpen(false), 150);
                    addInviteEmail();
                  }}
                  placeholder="name@company.com — type a name or email"
                  className="h-10"
                />

                {/* people suggestions while typing */}
                {suggestOpen && inviteMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border/80 bg-popover shadow-2xl">
                    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      People in your company
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {inviteMatches.map((p, i) => (
                        <button
                          key={p._id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickInvite(p.email);
                          }}
                          onMouseEnter={() => setSuggestIndex(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                            suggestIndex === i ? "bg-accent" : "hover:bg-accent/60",
                          )}
                        >
                          <UserAvatar user={p} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{p.name || p.email}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {p.email}
                              {p.designation ? ` · ${p.designation}` : ""}
                            </div>
                          </div>
                          <CornerDownLeft className="size-3.5 shrink-0 text-primary" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* quick-add an external email that isn't in the directory */}
                {suggestOpen && inviteMatches.length === 0 && inviteInput.includes("@") && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border/80 bg-popover p-1 shadow-2xl">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickInvite(inviteInput.trim());
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/60"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                        <Mail className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">Add {inviteInput.trim()}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">External attendee</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
              {inviteEmails.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {inviteEmails.map((email) => {
                    const person = directoryByEmail.get(email.toLowerCase());
                    return (
                      <span
                        key={email}
                        title={email}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-1 pr-2.5 text-[11px] font-medium text-primary"
                      >
                        {person ? (
                          <UserAvatar user={person} size="xs" />
                        ) : (
                          <span className="grid size-5 place-items-center rounded-full bg-primary/15">
                            <Mail className="size-3" />
                          </span>
                        )}
                        <span className="max-w-40 truncate">
                          {person ? displayName(person) : email}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInviteEmails((prev) => prev.filter((e) => e !== email))}
                          className="text-primary/60 transition-colors hover:text-primary"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Attendees are emailed the room code, time and attendee list as soon as you schedule.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/40 px-3.5 py-3 transition-colors hover:border-primary/40">
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-rose-500/12 text-rose-400">
                  <Radio className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">Record this meeting</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Recording is available to the host inside the room.
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.recordingEnabled}
                onChange={(e) => setForm({ ...form, recordingEnabled: e.target.checked })}
                className="size-4 accent-[var(--gold)]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/70">
              <span className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Globe2 className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">Open to everyone</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {form.openToEveryone
                      ? "Anyone with the link can join. Turn off for a private meeting."
                      : "Private — only invited participants can join. Admins cannot enter."}
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.openToEveryone}
                onChange={(e) => setForm({ ...form, openToEveryone: e.target.checked })}
                className="size-4 accent-[var(--gold)]"
              />
            </label>
          </div>
          </div>
          <div className="shrink-0 border-t border-border/70 px-6 py-4">
            <DialogFooter>
              <Button
                onClick={schedule}
                disabled={scheduling}
                className="bg-primary text-primary-foreground"
              >
                {scheduling ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
                {scheduling
                  ? "Scheduling…"
                  : `${kind === "webinar" ? "Schedule webinar" : "Schedule meeting"}${inviteEmails.length ? ` & invite ${inviteEmails.length}` : ""}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* JOIN BY CODE DIALOG */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a meeting</DialogTitle>
            <DialogDescription>Enter the DJM room code from your invite email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DJM-ABC-123"
              className="h-12 text-center font-mono text-lg tracking-[0.15em]"
              maxLength={11}
              onKeyDown={(e) => e.key === "Enter" && tryJoinCode()}
            />
            {joinCodeQuery && !joinByCodeQuery && (
              <p className="text-center text-xs text-muted-foreground">Looking for room…</p>
            )}
            {joinCodeQuery && joinByCodeQuery === null && (
              <p className="text-center text-xs text-destructive">Room not found</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={tryJoinCode} className="bg-primary text-primary-foreground">
              <Video className="size-4" /> Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  live,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  live?: boolean;
}) {
  return (
    <div className="glass hairline flex items-center gap-3 rounded-2xl p-4">
      <div
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          live ? "bg-emerald-400/15 text-emerald-400" : "bg-primary/12 text-primary",
        )}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <div className={cn("text-xl font-bold tabular-nums", live && "text-emerald-400")}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function defaultStart(): number {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  return d.getTime();
}

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
