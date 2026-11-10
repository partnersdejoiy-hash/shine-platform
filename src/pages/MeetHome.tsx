import { api } from "@/convex/_generated/api";
import { ShineLogo } from "@/components/ShineLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { displayName, formatTime, meetingUrl } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  ChevronDown,
  ClipboardCopy,
  Clock,
  Globe2,
  Link2,
  Loader2,
  Lock,
  MonitorPlay,
  Plus,
  Radio,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/** Production meeting links always point at the standalone meet site. */
export function meetingSiteBase(): string {
  if (typeof window === "undefined") return "https://meet.dejoiy.com";
  const host = window.location.hostname;
  // stay on whichever meet host the user is already on (meet.dejoiy.com or meets.dejoiy.com)
  if (host === "meets.dejoiy.com") return "https://meets.dejoiy.com";
  if (host.endsWith("dejoiy.com")) return "https://meet.dejoiy.com";
  return window.location.origin;
}

export function MeetHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const meetings = useQuery(api.meetings.myMeetings);
  const history = useQuery(api.meetings.history);
  const create = useMutation(api.meetings.create);

  const [code, setCode] = useState("");
  const [codeQuery, setCodeQuery] = useState<string | null>(null);
  const byCode = useQuery(api.meetings.detailByCode, codeQuery ? { roomCode: codeQuery } : "skip");
  const [creating, setCreating] = useState(false);
  const [sharedLink, setSharedLink] = useState<string | null>(null);
  const [openToEveryone, setOpenToEveryone] = useState(true);

  const upcoming = useMemo(() => {
    const all = [...(meetings?.hosted ?? []), ...(meetings?.attending ?? [])];
    return all.filter((m) => m.status === "scheduled" || m.status === "live");
  }, [meetings]);

  const instant = async (kind: "meeting" | "webinar" = "meeting") => {
    setCreating(true);
    try {
      const res = await create({
        title:
          kind === "webinar"
            ? `Instant webinar · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : `Instant meeting · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        startTime: Date.now(),
        endTime: Date.now() + 3600_000,
        kind,
        openToEveryone: openToEveryone,
      });
      navigate(`/meet/${res.slug}/${res.roomCode}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setCreating(false);
    }
  };

  const getShareableLink = async () => {
    setCreating(true);
    try {
      const res = await create({
        title: `Meeting · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        startTime: Date.now(),
        endTime: Date.now() + 3600_000,
        openToEveryone: openToEveryone,
      });
      const link = meetingUrl(meetingSiteBase(), {
        title: `Meeting · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        roomCode: res.roomCode,
        slug: res.slug,
      });
      setSharedLink(link);
      navigator.clipboard.writeText(link).catch(() => {});
      toast("Meeting link copied — share it with anyone");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const tryJoin = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 9) {
      toast("Enter the full room code, e.g. DJM-ABC-123");
      return;
    }
    setCodeQuery(c);
  };

  useEffect(() => {
    if (codeQuery && byCode) {
      setCode("");
      setCodeQuery(null);
      const u = new URL(meetingUrl(meetingSiteBase(), byCode.meeting)); navigate(u.pathname + u.search + u.hash);
    } else if (codeQuery && byCode === null) {
      toast("Room not found — check the code");
      setCodeQuery(null);
    }
  }, [codeQuery, byCode, navigate]);

  const copy = (link: string) => {
    navigator.clipboard.writeText(link).catch(() => {});
    toast("Invite link copied");
  };

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,var(--gold-soft),transparent_65%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[560px] translate-x-1/3 rounded-full bg-[radial-gradient(ellipse,var(--gold-soft),transparent_65%)] blur-3xl" />
      </div>

      {/* top bar */}
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-border/60 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* showWordmark={false} — the header renders its own "SHINE Meet" text;
              without this the logo's built-in wordmark doubled and overlapped. */}
          <ShineLogo className="size-9" showWordmark={false} />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">
              SHINE <span className="text-primary">Meet</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Powered by DEJOIY</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-xs text-muted-foreground sm:inline-flex"
            onClick={() => navigate("/app")}
          >
            Open full app
          </Button>
          {user && (
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/60 py-1 pl-1 pr-3 backdrop-blur">
              <UserAvatar user={user} size="xs" showStatus />
              <span className="hidden max-w-40 truncate text-xs font-medium sm:block">
                {displayName(user)}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* left — actions */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Badge className="mb-4 gap-1.5 border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="size-3" /> Enterprise HD meetings
              </Badge>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Premium video meetings
                <br />
                <span className="text-primary">for your company.</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Start an instant meeting, grab a link to share, or enter a room code.
                Every call is HD, encrypted and powered by SHINE — no downloads needed.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="glass hairline mt-8 rounded-2xl p-4 sm:p-5"
            >
              {/* start a new meeting */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">Start a new meeting</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Create an instant room and invite people.
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                      <Video className="size-4" />
                      New meeting
                      <ChevronDown className="size-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onClick={() => instant("meeting")} disabled={creating}>
                      {creating ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4 text-primary" />}
                      <span>
                        <span className="block">Create an instant meeting</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          Start right away and share the room
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={getShareableLink} disabled={creating}>
                      {creating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4 text-primary" />}
                      <span>
                        <span className="block">Get a link to share</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          Copy a link — join anytime
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => instant("webinar")} disabled={creating}>
                      <MonitorPlay className="size-4 text-primary" />
                      <span>
                        <span className="block">Broadcast a webinar</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          You present — everyone watches
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenToEveryone((v) => !v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenToEveryone((v) => !v);
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between gap-2 px-2 py-2 outline-none"
                    >
                      <span className="flex items-center gap-2">
                        <Globe2 className="size-4 text-primary" />
                        <span>
                          <span className="block text-sm">Open to everyone</span>
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {openToEveryone
                              ? "Anyone with the link can join"
                              : "Private — invite only"}
                          </span>
                        </span>
                      </span>
                      <Switch checked={openToEveryone} onCheckedChange={setOpenToEveryone} />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {sharedLink && (
                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Shareable link ready
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-foreground">{sharedLink}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => copy(sharedLink)}>
                      <ClipboardCopy className="size-3.5" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => navigate(sharedLink.replace(meetingSiteBase(), ""))}
                    >
                      <Video className="size-3.5" /> Join now
                    </Button>
                  </div>
                </div>
              )}

              {/* join by code */}
              <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-muted-foreground">Enter a room code</div>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="DJM-ABC-123"
                    maxLength={11}
                    className="mt-1.5 h-11 font-mono tracking-[0.12em]"
                    onKeyDown={(e) => e.key === "Enter" && tryJoin()}
                  />
                </div>
                <Button className="h-11 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={tryJoin}>
                  <Plus className="size-4" /> Join
                </Button>
              </div>
            </motion.div>
          </div>

          {/* right — today's meetings */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            <div className="glass hairline rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Today's meetings</h2>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("/app/meetings")}>
                  View all
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {meetings === undefined && (
                  <div className="py-10 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {upcoming.length === 0 && meetings !== undefined && (
                  <div className="py-10 text-center">
                    <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Video className="size-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium">Nothing scheduled</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start a new meeting above — your upcoming calls show up here.
                    </p>
                  </div>
                )}
                {upcoming.map((m) => (
                  <div
                    key={m._id}
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30"
                  >
                    <div
                      className={
                        "grid size-10 shrink-0 place-items-center rounded-xl " +
                        (m.status === "live" ? "bg-emerald-400/15 text-emerald-400" : "bg-primary/12 text-primary")
                      }
                    >
                      {m.kind === "webinar" ? <MonitorPlay className="size-4" /> : <Video className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{m.title}</span>
                        {m.kind === "webinar" && (
                          <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Webinar</Badge>
                        )}
                        {m.status === "live" && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {formatTime(m.startTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3" /> {m.participantCount}
                        </span>
                        {m.password && <Lock className="size-3" />}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => navigate(`/meet/${m._id}`)}
                    >
                      {m.kind === "webinar" && m.hostId !== user?._id ? <MonitorPlay className="size-3.5" /> : <Video className="size-3.5" />}
                      {m.status === "live" ? "Join" : m.kind === "webinar" ? "Watch" : "Enter"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* recent */}
            {history && history.length > 0 && (
              <div className="glass hairline mt-4 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Radio className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Recent</h2>
                </div>
                <div className="mt-3 space-y-1.5">
                  {history.slice(0, 4).map((m) => (
                    <div key={m._id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs hover:bg-accent/40">
                      <span className="text-muted-foreground">
                        {m.kind === "webinar" ? <MonitorPlay className="size-3.5" /> : <Video className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{m.roomCode}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-[11px] text-muted-foreground sm:flex-row sm:px-6">
          <span>
            Powered by <span className="font-semibold text-foreground">SHINE</span> · An Enterprise Collaboration Platform
          </span>
          <span>Developed by DEJOIY INDIA PRIVATE LIMITED</span>
        </div>
      </footer>
    </div>
  );
}
