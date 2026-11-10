import type { CSSProperties } from "react";
import { api } from "@/convex/_generated/api";
import { conversationTitle, type ConversationItem } from "@/components/chat/ConversationList";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { displayName, formatBytes, formatTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toneFor } from "@/lib/tone";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarClock,
  FileStack,
  Hash,
  MessageSquare,
  Phone,
  PhoneMissed,
  Plus,
  Sparkles,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-rose-500/15 text-rose-400" },
  high: { label: "High", cls: "bg-amber-400/15 text-amber-400" },
  medium: { label: "Medium", cls: "bg-sky-400/15 text-sky-400" },
  low: { label: "Low", cls: "bg-zinc-400/15 text-zinc-400" },
};

export function AppDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const conversations = useQuery(api.conversations.list);
  const callHistory = useQuery(api.calls.history);
  const meetings = useQuery(api.meetings.myMeetings);
  const myTasks = useQuery(api.tasks.myTasks);
  const filesData = useQuery(api.files.myFiles);
  const presenceAll = useQuery(api.users.presenceAll);
  const setTaskStatus = useMutation(api.tasks.setStatus);

  const presenceMap = useMemo(() => {
    const map: Record<string, NonNullable<typeof presenceAll>[number]> = {};
    for (const p of presenceAll ?? []) map[p.userId] = p;
    return map;
  }, [presenceAll]);

  const recentChats = (conversations ?? []).slice(0, 5);
  const missed = (callHistory ?? []).filter((c) => c.status === "missed").slice(0, 4);
  const recentCalls = (callHistory ?? []).slice(0, 3);
  const upcoming = useMemo(
    () =>
      [...(meetings?.hosted ?? []), ...(meetings?.attending ?? [])].filter(
        (m) => m.status === "scheduled" || m.status === "live",
      ).slice(0, 4),
    [meetings],
  );
  const tasks = (myTasks ?? []).slice(0, 5);
  const totalBytes = filesData?.totalBytes ?? 0;
  const unreadTotal = (conversations ?? []).reduce((s, c) => s + c.unread, 0);
  const announcements = (conversations ?? []).filter(
    (c) => c.conversation.kind === "channel" && c.conversation.channelKind === "announcement",
  );
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const quick = [
    { label: "New chat", icon: MessageSquare, to: "/app/chats", primary: true },
    { label: "Start meeting", icon: Video, to: "/app/meetings" },
    { label: "Upload file", icon: FileStack, to: "/app/files" },
    { label: "Add task", icon: Plus, to: "/app/tasks" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5 sm:p-6">
        {/* header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-400" />
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
              {greeting}, {user?.name?.split(" ")[0] ?? "there"} <span className="inline-block">👋</span>
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {unreadTotal > 0
                ? `You have ${unreadTotal} unread message${unreadTotal > 1 ? "s" : ""} across your workspace.`
                : "You're all caught up. Here's what's happening."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <Button
                key={q.label}
                variant={q.primary ? "default" : "outline"}
                                onClick={() => navigate(q.to)}
              >
                <q.icon className="size-4" /> {q.label}
              </Button>
            ))}
          </div>
        </div>

        {/* stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={MessageSquare}
            label="Conversations"
            tone="#ff4fa3"
            value={String((conversations ?? []).length)}
            sub={`${unreadTotal} unread`}
            onClick={() => navigate("/app/chats")}
          />
          <Stat
            icon={Video}
            label="Meetings"
            tone="#4da3ff"
            value={String(upcoming.length)}
            sub={upcoming.some((m) => m.status === "live") ? "One is live now" : "scheduled"}
            onClick={() => navigate("/app/meetings")}
            live={upcoming.some((m) => m.status === "live")}
          />
          <Stat
            icon={FileStack}
            label="Storage"
            tone="#3ddc84"
            value={formatBytes(totalBytes)}
            sub="across your files"
            onClick={() => navigate("/app/files")}
          />
          <Stat
            icon={Zap}
            label="Tasks"
            tone="#ffd23f"
            value={String(tasks.length)}
            sub={`${tasks.filter((t) => t.status === "done").length} done`}
            onClick={() => navigate("/app/tasks")}
          />
        </div>

        {/* grid */}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* recent chats */}
          <section className="lg:col-span-2">
            <SectionHeader title="Recent conversations" to="/app/chats" />
            <div className="space-y-2">
              {recentChats.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No conversations yet — start one to see it here.
                </div>
              )}
              {recentChats.map((c) => (
                <button
                  key={c.conversation._id}
                  onClick={() => navigate(`/app/chats/${c.conversation._id}`)}
                  style={{ "--t": toneFor(c.members.find((m) => m._id !== user?._id)?._id ?? c.conversation._id, c.conversation.kind) } as CSSProperties}
                  className={cn("tone-card flex min-h-[72px] w-full items-center gap-3 px-3.5 py-3 text-left", c.unread > 0 && "is-unread")}
                >
                  {c.conversation.kind === "channel" ? (
                    <div className="tone-dot grid size-10 shrink-0 place-items-center rounded-2xl border-2 border-[var(--sticker-border)] text-[#121212]">
                      <Hash className="size-4" />
                    </div>
                  ) : (
                    <UserAvatar
                      user={c.members.find((m) => m._id !== user?._id) ?? undefined}
                      presence={presenceMap[(c.members.find((m) => m._id !== user?._id) ?? { _id: "" })._id]}
                      size="md"
                      showStatus
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[15px]", c.unread > 0 ? "font-extrabold" : "font-semibold")}>
                        {conversationTitle(c as ConversationItem, user?._id)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {c.lastMessage
                          ? `${c.lastMessage.senderId === user?._id ? "You: " : ""}${
                              c.lastMessage.kind === "file"
                                ? "📎 Shared a file"
                                : c.lastMessage.kind === "voice"
                                  ? "🎤 Voice message"
                                  : c.lastMessage.body
                            }`
                          : "Say hello 👋"}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-[11px] font-bold text-background">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* right column */}
          <div className="space-y-5">
            {/* announcements */}
            <section>
              <SectionHeader title="Announcements" to="/app/chats" />
              <div className="glass hairline space-y-2 rounded-2xl p-3.5">
                {announcements.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Create an <span className="font-medium text-foreground">Announcement channel</span> in
                    an organization to broadcast updates.
                  </p>
                )}
                {announcements.slice(0, 2).map((a) => (
                  <button
                    key={a.conversation._id}
                    onClick={() => navigate(`/app/chats/${a.conversation._id}`)}
                    className="w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Sparkles className="size-3" /> #{a.conversation.name}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {a.lastMessage?.body}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* upcoming meetings */}
            <section>
              <SectionHeader title="Upcoming meetings" to="/app/meetings" />
              <div className="glass hairline space-y-2 rounded-2xl p-3.5">
                {upcoming.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing scheduled. Plan your next sync.</p>
                )}
                {upcoming.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => navigate(`/app/meetings/${m._id}`)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <div
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        m.status === "live" ? "bg-emerald-400/15 text-emerald-400" : "bg-primary/12 text-primary",
                      )}
                    >
                      <Video className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{m.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {m.status === "live" ? "Live now" : formatTime(m.startTime)}
                      </div>
                    </div>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>

            {/* missed calls */}
            <section>
              <SectionHeader title="Missed calls" to="/app/chats" />
              <div className="glass hairline space-y-2 rounded-2xl p-3.5">
                {missed.length === 0 && (
                  <p className="text-xs text-muted-foreground">No missed calls. 🎉</p>
                )}
                {missed.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => navigate(`/app/chats/${c.conversationId}`)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/12 text-rose-400">
                      <PhoneMissed className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">
                        {c.other ? displayName(c.other) : "Unknown"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.kind === "video" ? "Video call" : "Audio call"} · {timeAgo(c.startedAt)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* tasks */}
        <section className="mt-6">
          <SectionHeader title="Your tasks" to="/app/tasks" />
          <div className="glass hairline overflow-hidden rounded-2xl">
            {tasks.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No tasks assigned to you. Ask Shine AI to extract action items from a chat.
              </div>
            )}
            {tasks.map((t, i) => (
              <div
                key={t._id}
                className={cn(
                  "flex items-center gap-3 p-3.5",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <button
                  onClick={() =>
                    setTaskStatus({
                      taskId: t._id as any,
                      status: t.status === "done" ? "todo" : "done",
                    }).catch(() => {})
                  }
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    t.status === "done"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/60",
                  )}
                >
                  {t.status === "done" && <span className="text-[10px]">✓</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-sm",
                      t.status === "done" && "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </div>
                  {t.org && <div className="text-[11px] text-muted-foreground">{t.org.name}</div>}
                </div>
                {t.priority && (
                  <Badge className={PRIORITY_META[t.priority]?.cls}>
                    {PRIORITY_META[t.priority]?.label}
                  </Badge>
                )}
                {t.dueDate && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* storage meter */}
        {totalBytes > 0 && (
          <section className="mt-6">
            <div className="glass hairline rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileStack className="size-4 text-primary" /> Workspace storage
                </div>
                <span className="text-xs text-muted-foreground">{formatBytes(totalBytes)} of 1 TB</span>
              </div>
              <Progress value={Math.min(100, (totalBytes / 1024 ** 4) * 100)} className="mt-3 h-2" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
  live,
  tone,
}: {
  tone: string;
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
  live?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      style={{ "--t": tone } as CSSProperties}
      className="tone-card card-hover flex flex-col items-start gap-3 p-4 text-left"
    >
      <div className="tone-dot grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-[var(--sticker-border)] text-[#121212] shadow-[2px_2px_0_var(--sticker-shadow)]">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-2xl font-extrabold tracking-[-0.03em] tabular-nums">
          {value}
          {live && <span className="ml-2 align-middle text-xs font-bold text-emerald-500">● live</span>}
        </div>
        <div className="text-sm font-bold">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
    </motion.button>
  );
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  const navigate = useNavigate();
  return (
    <div className="mb-2.5 flex items-center justify-between px-0.5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <button
        onClick={() => navigate(to)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        View all <ArrowUpRight className="size-3.5" />
      </button>
    </div>
  );
}
