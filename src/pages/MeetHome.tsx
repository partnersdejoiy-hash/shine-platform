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
import { dejoiyMailSignInUrl } from "@/lib/embed";
import { displayName, formatTime, meetingUrl } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ClipboardCopy,
  Clock,
  DoorOpen,
  Globe2,
  Link2,
  Loader2,
  Lock,
  MessageSquareText,
  Mic,
  MonitorPlay,
  MonitorUp,
  PhoneOff,
  Plus,
  Radio,
  UserRoundPlus,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

/** Production meeting links always point at the standalone meet site. */
export function meetingSiteBase(): string {
  if (typeof window === "undefined") return "https://meet.dejoiy.com";
  const host = window.location.hostname;
  // stay on whichever meet host the user is already on (meet.dejoiy.com or meets.dejoiy.com)
  if (host === "meets.dejoiy.com") return "https://meets.dejoiy.com";
  if (host.endsWith("dejoiy.com")) return "https://meet.dejoiy.com";
  return window.location.origin;
}

/** The full Shine app lives on its own host; elsewhere (dev) it is the same site. */
function appUrl(path: string): string {
  if (typeof window !== "undefined" && window.location.hostname.endsWith("dejoiy.com")) return `https://app.shine.dejoiy.com${path}`;
  return path;
}

/**
 * Arriving from the Shine app with ?sso=1: the person was signed in there, so sign them in here
 * through Dejoiy Mail without asking (Dejoiy Mail asks for its password only when needed).
 */
export function useMailSignInFromApp(isLoading: boolean, signedIn: boolean, returnTo: string) {
  useEffect(() => {
    if (isLoading || signedIn || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("sso") !== "1") return;
    q.delete("sso");
    const back = `${returnTo}${q.toString() ? `?${q}` : ""}`;
    window.location.replace(dejoiyMailSignInUrl(back));
  }, [isLoading, signedIn, returnTo]);
}

/* Four real things Shine Meet does, drawn as the tiles of a call. */
const TILES = [
  { icon: UserRoundPlus, label: "Guests join with a link", tone: "bg-[#ff4fa3]" },
  { icon: DoorOpen, label: "Waiting room", tone: "bg-[#4da3ff]" },
  { icon: MonitorUp, label: "Share your screen", tone: "bg-[#ffd23f]" },
  { icon: MessageSquareText, label: "Chat stays after the call", tone: "bg-[#3ddc84]" },
];

function CallVisual() {
  const still = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-[460px]" aria-hidden="true">
      <motion.div
        className="sticker rounded-[28px] bg-[#121212] p-3"
        initial={{ rotate: still ? 0 : -6, y: still ? 0 : 24, opacity: 0 }}
        animate={{ rotate: -3, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 14 }}
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#fbf3f8]">
            <span className="size-2 animate-pulse rounded-full bg-[#3ddc84]" /> Live
          </span>
          <span className="font-mono text-[11px] text-[#c9b8c6]">meet.dejoiy.com</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {TILES.map(({ icon: Icon, label, tone }, i) => (
            <motion.div
              key={label}
              className={`relative flex aspect-[4/3] flex-col justify-between rounded-2xl border-2 border-[#121212] p-3 text-[#121212] ${tone}`}
              initial={{ scale: still ? 1 : 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 160, damping: 16 }}
            >
              <span className="grid size-10 place-items-center rounded-full border-2 border-[#121212] bg-[#fffbf7]">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-extrabold leading-tight tracking-tight">{label}</span>
            </motion.div>
          ))}
        </div>
        <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-[#2a1e2e] px-3 py-2">
          {[Mic, Video, MonitorUp].map((Icon, i) => (
            <span key={i} className="grid size-9 place-items-center rounded-full bg-[#3a2840] text-[#fbf3f8]"><Icon className="size-4" /></span>
          ))}
          <span className="grid size-9 place-items-center rounded-full bg-[#ff4fa3] text-[#121212]"><PhoneOff className="size-4" /></span>
        </div>
      </motion.div>
      <motion.span
        className="sticker-pop absolute -left-2 -top-5 -rotate-6 rounded-full bg-[#ffd23f] px-3 py-1.5 text-xs font-extrabold text-[#121212] sm:-left-6"
        animate={still ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        no downloads
      </motion.span>
      <motion.span
        className="sticker absolute -bottom-4 -right-2 rotate-3 rounded-full bg-[#fffbf7] px-3 py-1.5 text-xs font-extrabold text-[#121212] sm:-right-6"
        animate={still ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      >
        works in the browser
      </motion.span>
    </div>
  );
}

export function MeetHome() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  // a meeting guest has no account: on this page they are signed out
  const signedIn = !!user && !user.isAnonymous;
  useMailSignInFromApp(isLoading, signedIn, "/meet");
  const meetings = useQuery(api.meetings.myMeetings, signedIn ? {} : "skip");
  const history = useQuery(api.meetings.history, signedIn ? {} : "skip");
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
      toast(e instanceof Error ? errorMessage(e) : "Failed to start");
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
      toast("Meeting link copied. Share it with anyone.");
    } catch (e) {
      toast(e instanceof Error ? errorMessage(e) : "Failed to create link");
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
      toast("Room not found. Check the code.");
      setCodeQuery(null);
    }
  }, [codeQuery, byCode, navigate]);

  const copy = (link: string) => {
    navigator.clipboard.writeText(link).catch(() => {});
    toast("Invite link copied");
  };

  if (signedIn && user?.mustChangePassword) return <Navigate to="/app/change-password" replace />;

  const joinByCode = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Got a room code?</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="DJM-ABC-123"
          maxLength={11}
          className="mt-1.5 h-12 border-2 border-[#121212] bg-[#fffbf7] font-mono text-base tracking-[0.14em]"
          onKeyDown={(e) => e.key === "Enter" && tryJoin()}
        />
      </label>
      <Button className="sticker h-12 gap-1.5 rounded-xl bg-[#121212] px-5 text-[#fbf3f8] hover:bg-[#2a1e2e]" onClick={tryJoin}>
        Join <ArrowRight className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      {/* top bar */}
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <ShineLogo className="size-9" showWordmark={false} />
          <span className="text-lg font-extrabold tracking-tight">
            SHINE <span className="rounded-md bg-[#ff4fa3] px-1.5 text-[#121212]">Meet</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {signedIn && user ? (
            <>
              <a className="hidden text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:block" href={appUrl("/app")}>
                Open Shine
              </a>
              <div className="sticker flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3">
                <UserAvatar user={user} size="xs" showStatus />
                <span className="hidden max-w-40 truncate text-xs font-bold sm:block">{displayName(user)}</span>
              </div>
            </>
          ) : (
            <a className="sticker rounded-full bg-card px-4 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5" href={dejoiyMailSignInUrl("/meet")}>
              Sign in
            </a>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
              <span className="sticker-pop inline-block -rotate-2 rounded-full bg-card px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                Shine Meet by DEJOIY
              </span>
              <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-6xl">
                Meet anyone.
                <br />
                <span className="gold-text">No app, no account.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                Open the link, type your name and you are in. Your team signs in with Dejoiy Mail; guests just need a name, an email and a phone number.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="sticker mt-8 space-y-5 rounded-3xl bg-card p-5 sm:p-6"
            >
              {signedIn ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-lg font-extrabold tracking-tight">Start a meeting</div>
                      <div className="text-sm text-muted-foreground">An instant room, a link to share, or a webinar.</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="sticker-pop h-12 gap-1.5 rounded-xl bg-[#ff4fa3] px-5 text-base font-extrabold text-[#121212] hover:bg-[#ff6bb3]">
                          <Video className="size-5" />
                          New meeting
                          <ChevronDown className="size-4 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuItem onClick={() => instant("meeting")} disabled={creating}>
                          {creating ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4 text-primary" />}
                          <span>
                            <span className="block">Create an instant meeting</span>
                            <span className="block text-[11px] font-normal text-muted-foreground">Start right away and share the room</span>
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={getShareableLink} disabled={creating}>
                          {creating ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4 text-primary" />}
                          <span>
                            <span className="block">Get a link to share</span>
                            <span className="block text-[11px] font-normal text-muted-foreground">Copy a link, join any time</span>
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => instant("webinar")} disabled={creating}>
                          <MonitorPlay className="size-4 text-primary" />
                          <span>
                            <span className="block">Broadcast a webinar</span>
                            <span className="block text-[11px] font-normal text-muted-foreground">You present, everyone watches</span>
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
                                {openToEveryone ? "Anyone with the link can join" : "Private: invited people only"}
                              </span>
                            </span>
                          </span>
                          <Switch checked={openToEveryone} onCheckedChange={setOpenToEveryone} />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {sharedLink && (
                    <div className="flex flex-col gap-2 rounded-2xl border-2 border-[#121212] bg-[#ffe3f1] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider">Your link is ready</div>
                        <div className="mt-0.5 truncate font-mono text-xs">{sharedLink}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="h-9 gap-1 border-2 border-[#121212] text-xs font-bold" onClick={() => copy(sharedLink)}>
                          <ClipboardCopy className="size-3.5" /> Copy
                        </Button>
                        <Button size="sm" className="h-9 gap-1 bg-[#121212] text-xs font-bold text-[#fbf3f8] hover:bg-[#2a1e2e]" onClick={() => navigate(sharedLink.replace(meetingSiteBase(), ""))}>
                          <Video className="size-3.5" /> Join now
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="border-t-2 border-dashed border-border pt-5">{joinByCode}</div>
                </>
              ) : (
                <>
                  {joinByCode}
                  <div className="flex flex-col gap-3 border-t-2 border-dashed border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Want to host a meeting? Sign in with your Dejoiy Mail.</p>
                    <a href={dejoiyMailSignInUrl("/meet")} className="sticker-pop inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#ff4fa3] px-5 text-sm font-extrabold text-[#121212] transition-transform hover:-translate-y-0.5">
                      <Plus className="size-4" /> Host a meeting
                    </a>
                  </div>
                </>
              )}
            </motion.div>
          </div>

          <CallVisual />
        </section>

        {signedIn && (
          <section className="mt-16 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="sticker rounded-3xl bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                  <CalendarClock className="size-5 text-primary" /> Coming up
                </h2>
                <a className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={appUrl("/app/meetings")}>
                  View all
                </a>
              </div>
              <div className="mt-4 space-y-2.5">
                {meetings === undefined && (
                  <div className="py-10 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {upcoming.length === 0 && meetings !== undefined && (
                  <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center">
                    <p className="text-base font-extrabold">Nothing scheduled</p>
                    <p className="mt-1 text-sm text-muted-foreground">Start a meeting above. Your upcoming calls show up here.</p>
                  </div>
                )}
                {upcoming.map((m) => (
                  <div key={m._id} className="card-hover flex items-center gap-3 rounded-2xl border-2 border-[#121212] bg-background p-3">
                    <div
                      className={
                        "grid size-11 shrink-0 place-items-center rounded-xl border-2 border-[#121212] " +
                        (m.status === "live" ? "bg-[#3ddc84] text-[#121212]" : "bg-[#ffe3f1] text-[#121212]")
                      }
                    >
                      {m.kind === "webinar" ? <MonitorPlay className="size-5" /> : <Video className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{m.title}</span>
                        {m.kind === "webinar" && <Badge className="bg-primary/15 text-foreground hover:bg-primary/15">Webinar</Badge>}
                        {m.status === "live" && (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600">
                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {formatTime(m.startTime)}</span>
                        <span className="flex items-center gap-1"><Users className="size-3" /> {m.participantCount}</span>
                        {m.password && <Lock className="size-3" />}
                      </div>
                    </div>
                    <Button size="sm" className="h-9 gap-1 rounded-lg bg-[#121212] text-xs font-bold text-[#fbf3f8] hover:bg-[#2a1e2e]" onClick={() => navigate(`/meet/${m._id}`)}>
                      {m.kind === "webinar" && m.hostId !== user?._id ? <MonitorPlay className="size-3.5" /> : <Video className="size-3.5" />}
                      {m.status === "live" ? "Join" : m.kind === "webinar" ? "Watch" : "Enter"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticker rounded-3xl bg-[#1d1420] p-5 text-[#fbf3f8] sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <Radio className="size-5 text-[#ff4fa3]" /> Recent
              </h2>
              {history && history.length > 0 ? (
                <div className="mt-4 space-y-1">
                  {history.slice(0, 5).map((m) => (
                    <div key={m._id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm hover:bg-[#2a1e2e]">
                      {m.kind === "webinar" ? <MonitorPlay className="size-4 text-[#c9b8c6]" /> : <Video className="size-4 text-[#c9b8c6]" />}
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#c9b8c6]">{m.roomCode}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#c9b8c6]">Meetings you have been in show up here.</p>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t-2 border-[#121212] bg-[#121212] py-5 text-[#c9b8c6]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs sm:flex-row sm:px-8">
          <span>
            <span className="font-extrabold text-[#fbf3f8]">SHINE Meet</span> on meet.dejoiy.com
          </span>
          <span>Made by DEJOIY INDIA PRIVATE LIMITED</span>
        </div>
      </footer>
    </div>
  );
}
