import { api } from "@/convex/_generated/api";
import { CallOverlay } from "@/components/app/CallOverlay";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationsPopover } from "@/components/app/NotificationsPopover";
import { PolicyAckGate } from "@/components/chat/PolicyAckGate";
import { ShineAIDrawer } from "@/components/app/ShineAIDrawer";
import { ShineLogo } from "@/components/ShineLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import { eventForNotificationKind, playEventSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { isEmbedded, tellMail } from "@/lib/embed";
import { useMutation, useQuery } from "convex/react";
import {
  Bot,
  Building2,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "Home", match: (p: string) => p === "/app" },
  { to: "/app/chats", icon: MessagesSquare, label: "Messages", match: (p: string) => p.startsWith("/app/chats") },
  { to: "/app/meetings", icon: Video, label: "Meetings", match: (p: string) => p.startsWith("/app/meetings") },
  { to: "/app/files", icon: FileStack, label: "Files", match: (p: string) => p.startsWith("/app/files") },
  { to: "/app/tasks", icon: FolderKanban, label: "Tasks", match: (p: string) => p.startsWith("/app/tasks") },
  { to: "/app/contacts", icon: Users, label: "Contacts", match: (p: string) => p.startsWith("/app/contacts") },
  { to: "/app/organizations", icon: Building2, label: "Organizations", match: (p: string) => p.startsWith("/app/organizations") },
  { to: "/app/tickets", icon: Ticket, label: "Access", match: (p: string) => p.startsWith("/app/tickets") },
  { to: "/app/admin", icon: ShieldCheck, label: "Admin", match: (p: string) => p.startsWith("/app/admin"), adminOnly: true },
  { to: "/app/design", icon: Palette, label: "Design", match: (p: string) => p.startsWith("/app/design") },
  { to: "/app/settings", icon: Settings, label: "Settings", match: (p: string) => p.startsWith("/app/settings") },
];

/** Items shown on mobile bottom nav (max 5) */
const MOBILE_NAV = NAV.slice(0, 5);
/** Extra items hidden behind "More" on mobile */
const MOBILE_MORE_NAV = NAV.slice(5);

const PRESENCE_OPTIONS = [
  { value: "online", label: "Online", dot: "bg-emerald-400" },
  { value: "away", label: "Away", dot: "bg-amber-400" },
  { value: "busy", label: "Busy", dot: "bg-rose-500" },
  { value: "invisible", label: "Invisible", dot: "bg-zinc-500" },
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const bootstrapSuperAdmin = useMutation(api.users.bootstrapSuperAdmin);
  const bootstrapDejoiyMembership = useMutation(api.users.bootstrapDejoiyMembership);
  const autoJoinDomains = useMutation(api.orgs.autoJoinByEmailDomain);
  const presenceAll = useQuery(api.users.presenceAll);

  const notifications = useQuery(api.notifications.list);
  const prevNotif = useRef<string | null>(null);

  usePresenceHeartbeat();

  useEffect(() => {
    if (user?._id) {
      bootstrapSuperAdmin().catch(() => {});
      bootstrapDejoiyMembership().catch(() => {});
      autoJoinDomains().catch(() => {});
    }
  }, [user?._id, bootstrapSuperAdmin, bootstrapDejoiyMembership, autoJoinDomains]);

  // keyboard: Cmd+K / Cmd+J for search & AI
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // new notification → sound + desktop notification
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    const first = notifications[0]?._id ?? null;
    if (prevNotif.current !== null && first !== prevNotif.current) {
      const prefs = user?.notificationPrefs;
      const soundOn = prefs?.sound !== false;
      const desktopOn = prefs?.desktop !== false;
      if (soundOn) {
        playEventSound(
          eventForNotificationKind(notifications[0]?.kind),
          user?.soundPrefs,
          user?.customSoundUrl,
        );
      }
      if (desktopOn && document.hidden && "Notification" in window && Notification.permission === "granted") {
        const n = notifications[0];
        new Notification(n.title, { body: n.body ?? "", tag: n._id });
      }
    }
    prevNotif.current = first;
  }, [notifications, user?.notificationPrefs]);

  const active = NAV.find((n) => n.match(location.pathname));
  const pageTitle = active?.label ?? "SHINE";

  const myPresence = useMemo(
    () => presenceAll?.find((p) => p.userId === user?._id) ?? null,
    [presenceAll, user?._id],
  );

  const isAdmin =
    user?.role === "super_admin" ||
    user?.role === "dejoiy_admin" ||
    user?.role === "admin" ||
    user?.role === "super_it" ||
    user?.role === "it";

  const chatMatch = location.pathname.match(/^\/app\/chats\/(.+)/);
  const conversationId = chatMatch ? chatMatch[1] : null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const unread = useQuery(api.conversations.totalUnread);
  // Inside Dejoiy Mail's chat panel: no Shine navigation, and the mail page gets the unread count.
  const embed = useMemo(() => isEmbedded(), []);
  useEffect(() => {
    if (embed && unread !== undefined) tellMail({ type: "shine:unread", count: unread });
  }, [embed, unread]);

  const filteredNav = NAV.filter((n) => !n.adminOnly || isAdmin);
  const mobileFilteredNav = MOBILE_NAV.filter((n) => !n.adminOnly || isAdmin);
  const mobileFilteredMore = MOBILE_MORE_NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <PolicyAckGate />

      {/* ===== DESKTOP NAV RAIL (hidden on mobile & tablet) ===== */}
      <nav className={embed ? "hidden" : "hidden md:flex h-full w-[68px] shrink-0 flex-col items-center border-r border-border/70 bg-sidebar"}>
        <div className="flex shrink-0 items-center py-3">
          <button
            onClick={() => navigate("/app")}
            className="transition-transform hover:scale-105"
            title="SHINE"
          >
            <ShineLogo size={38} showWordmark={false} />
          </button>
        </div>

        {/* Scrollable nav items — hidden scrollbar, smooth wheel scroll */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1 pb-2 no-scrollbar">
          {filteredNav.map((n) => (
            <Tooltip key={n.to}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(n.to)}
                  className={cn(
                    "relative grid size-11 shrink-0 place-items-center rounded-2xl border-2 transition-[transform,background-color,box-shadow,color] duration-150 active:translate-x-px active:translate-y-px",
                    n.match(location.pathname)
                      ? "border-[var(--sticker-border)] bg-primary text-primary-foreground shadow-[3px_3px_0_var(--sticker-shadow)]"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <n.icon className="size-5" />
                  {n.to === "/app/chats" && (unread ?? 0) > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-sidebar bg-foreground px-1 text-[10px] font-bold text-background">
                      {unread}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="ml-2">
                {n.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Fixed bottom section: AI + user menu */}
        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border/50 pt-2 pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 text-muted-foreground"
                onClick={() => setAiOpen(true)}
              >
                <Bot className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Shine AI (⌘J)</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative">
                <UserAvatar user={user} presence={myPresence} size="sm" showStatus />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-64">
              <DropdownMenuLabel className="flex items-center gap-3 p-3">
                <UserAvatar user={user} presence={myPresence} size="md" showStatus />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{user?.name ?? "You"}</div>
                  <div className="truncate text-xs text-muted-foreground">{user?.email ?? "Guest account"}</div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Presence</DropdownMenuLabel>
              <PresenceSelector />
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/app/settings")} className="cursor-pointer">
                <Settings className="mr-2 size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/app/organizations")} className="cursor-pointer">
                <Building2 className="mr-2 size-4" /> Organizations
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/app/admin")} className="cursor-pointer">
                  <ShieldCheck className="mr-2 size-4" /> Admin console
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* MAIN — pb-14 on mobile for bottom nav, pb-0 on desktop */}
      <div className={cn("flex min-w-0 flex-1 flex-col", !embed && "pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0")}>
        {/* TOPBAR */}
        <header className={cn("glass flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4", embed && "hidden")}>
          <div className="flex items-center gap-3">
            {/* Mobile logo (no rail on mobile) */}
            <button
              onClick={() => navigate("/app")}
              className="md:hidden transition-transform hover:scale-105"
              title="SHINE"
            >
              <ShineLogo size={28} showWordmark={false} />
            </button>
            <span className="text-lg font-extrabold tracking-[-0.03em]">{pageTitle}</span>
            <Badge
              variant="outline"
              className="hidden gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-emerald-400" /> Realtime
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 w-72 items-center gap-2 rounded-full border-[1.5px] border-border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-[var(--sticker-border)] sm:flex"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left text-xs">Search everything…</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground sm:hidden"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-[18px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground"
              onClick={() => setAiOpen(true)}
              title="Shine AI (⌘J)"
            >
              <Sparkles className="size-[18px]" />
            </Button>
            <NotificationsPopover />
            {/* Mobile user avatar (replaces rail bottom section) */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative">
                    <UserAvatar user={user} presence={myPresence} size="sm" showStatus />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-3 p-3">
                    <UserAvatar user={user} presence={myPresence} size="md" showStatus />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{user?.name ?? "You"}</div>
                      <div className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <PresenceSelector />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/settings")} className="cursor-pointer">
                    <Settings className="mr-2 size-4" /> Settings
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/app/admin")} className="cursor-pointer">
                      <ShieldCheck className="mr-2 size-4" /> Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* ===== MOBILE BOTTOM NAV (visible only on mobile/tablet) ===== */}
      <nav className={cn("md:hidden fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 rounded-[26px] border-2 border-[var(--sticker-border)] bg-card shadow-[4px_4px_0_var(--sticker-shadow)]", embed && "hidden")}>
        <div className="flex h-16 items-center justify-around px-1.5">
          {mobileFilteredNav.map((n) => (
            <button
              key={n.to}
              onClick={() => navigate(n.to)}
              className={cn(
                "relative flex min-w-[52px] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 transition-colors active:scale-95",
                n.match(location.pathname)
                  ? "bg-accent font-bold text-foreground [&_svg]:text-primary"
                  : "text-muted-foreground",
              )}
            >
              <n.icon className="size-5" />
              <span className="text-[11px] leading-none">{n.label}</span>
              {n.to === "/app/chats" && (unread ?? 0) > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-sidebar bg-foreground px-1 text-[10px] font-bold text-background">
                  {unread}
                </span>
              )}
            </button>
          ))}
          {mobileFilteredMore.length > 0 && (
            <DropdownMenu open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex min-w-[52px] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 transition-colors active:scale-95",
                    mobileFilteredMore.some((n) => n.match(location.pathname))
                      ? "bg-accent font-bold text-foreground [&_svg]:text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <MoreHorizontal className="size-5" />
                  <span className="text-[11px] leading-none">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
                {mobileFilteredMore.map((n) => (
                  <DropdownMenuItem
                    key={n.to}
                    onClick={() => { navigate(n.to); setMobileMoreOpen(false); }}
                    className={cn(
                      "cursor-pointer gap-3",
                      n.match(location.pathname) && "text-primary font-medium",
                    )}
                  >
                    <n.icon className="size-4" />
                    {n.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setAiOpen(true); setMobileMoreOpen(false); }} className="cursor-pointer gap-3">
                  <Bot className="size-4" /> Shine AI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>

      {/* GLOBAL OVERLAYS */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShineAIDrawer open={aiOpen} onOpenChange={setAiOpen} conversationId={conversationId} />
      <CallOverlay />
    </div>
  );
}

function PresenceSelector() {
  const { setStatus } = usePresenceHeartbeat();
  const [value, setValue] = useState("online");
  return (
    <DropdownMenuRadioGroup
      value={value}
      onValueChange={(v) => {
        setValue(v);
        setStatus(v as (typeof PRESENCE_OPTIONS)[number]["value"]);
      }}
    >
      {PRESENCE_OPTIONS.map((o) => (
        <DropdownMenuRadioItem key={o.value} value={o.value} className="cursor-pointer">
          <span className={cn("mr-2 size-2 rounded-full", o.dot)} />
          {o.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
