import { api } from "@/convex/_generated/api";
import { CallOverlay } from "@/components/app/CallOverlay";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationsPopover } from "@/components/app/NotificationsPopover";
import { PolicyAckGate } from "@/components/chat/PolicyAckGate";
import { ShineAIDrawer } from "@/components/app/ShineAIDrawer";
import { ShineMark, ShineLogo } from "@/components/ShineLogo";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import { StatusSheet } from "@/components/app/StatusSheet";
import { IdCard } from "@/components/IdCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { eventForNotificationKind, playEventSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { presenceLabel } from "@/lib/presence";
import { isEmbedded, tellMail } from "@/lib/embed";
import { JOI_AVATAR, openJoi } from "@/lib/joi";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeftOpen,
  IdCard as IdCardIcon,
  Building2,
  CalendarDays,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  PenSquare,
  Palette,
  Search,
  Settings,
  ShieldCheck,
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
  { to: "/app/calendar", icon: CalendarDays, label: "Calendar", match: (p: string) => p.startsWith("/app/calendar") },
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


export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // large screens: the wide menu can be folded to the icon rail; remembered on this device
  const [rail, setRail] = useState(() => { try { return localStorage.getItem("shine-rail") === "1"; } catch { return false; } });
  useEffect(() => {
    if (rail) document.documentElement.dataset.rail = "1"; else delete document.documentElement.dataset.rail;
    try { localStorage.setItem("shine-rail", rail ? "1" : "0"); } catch { /* private window: the choice lasts until the page closes */ }
  }, [rail]);
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const joiToken = useAction(api.joi.widgetToken);
  const joiGrant = useAction(api.joiRead.grant);
  // Joi, DEJOIY's AI buddy, is Shine's assistant (she took over from Shine AI)
  const askJoi = () => {
    setAiOpen(false);
    void openJoi(user ?? undefined, joiToken().catch(() => null), joiGrant().catch(() => null)).then((ok) => {
      if (!ok) toast("Joi can't be reached right now. Try again in a bit.");
    });
  };
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
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

  const askJoiRef = useRef(askJoi);
  askJoiRef.current = askJoi;
  // keyboard: Cmd+K / Cmd+J for search & Joi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        askJoiRef.current();
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
  // phones: an open chat takes the whole screen (its own header and composer), like WhatsApp
  const fullChat = Boolean(conversationId);

  const startNewChat = () => {
    if (location.pathname.startsWith("/app/chats")) window.dispatchEvent(new Event("shine:new-chat"));
    else navigate("/app/chats?compose=1");
  };

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
      <nav className={embed ? "hidden" : "hidden md:flex h-full w-[68px] lgx:w-[252px] shrink-0 flex-col items-center lgx:items-stretch border-r border-border shine-rail"}>
        <div className="flex shrink-0 items-center py-3 lgx:px-5 lgx:py-4">
          <button onClick={() => navigate("/app")} className="transition-transform hover:scale-105" title="Shine">
            <ShineLogo size={38} showWordmark={false} className="lgx:hidden" />
            <ShineLogo size={34} className="hidden lgx:flex" />
          </button>
        </div>
        {/* like Dejoiy Mail's Compose */}
        <div className="hidden shrink-0 px-4 pb-4 lgx:block">
          <Button size="lg" className="w-full" onClick={startNewChat}>
            <PenSquare className="size-4" /> New chat
          </Button>
        </div>

        {/* Scrollable nav items — hidden scrollbar, smooth wheel scroll */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1 pb-2 no-scrollbar lgx:items-stretch lgx:gap-0.5 lgx:px-3">
          {filteredNav.map((n) => (
            <Tooltip key={n.to}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(n.to)}
                  className={cn(
                    "relative grid size-11 shrink-0 place-items-center rounded-2xl border-2 transition-[transform,background-color,box-shadow,color] duration-150 active:translate-x-px active:translate-y-px",
                    "lgx:flex lgx:h-11 lgx:w-full lgx:items-center lgx:justify-start lgx:gap-3.5 lgx:rounded-full lgx:border-0 lgx:px-4 lgx:shadow-none",
                    n.match(location.pathname)
                      ? "border-[var(--sticker-border)] bg-primary text-primary-foreground shadow-[3px_3px_0_var(--sticker-shadow)] lgx:font-bold"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <n.icon className="size-5" />
                  <span className="hidden text-[15px] lgx:inline">{n.label}</span>
                  {n.to === "/app/chats" && (unread ?? 0) > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-sidebar bg-foreground px-1 text-[10px] font-bold text-background lgx:static lgx:ml-auto lgx:h-auto lgx:min-w-0 lgx:border-0 lgx:bg-transparent lgx:text-[13px] lgx:text-current">
                      {unread}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="ml-2 lgx:hidden">
                {n.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Fixed bottom section: AI + user menu */}
        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border/50 pt-2 pb-2 lgx:flex-row lgx:flex-wrap lgx:justify-between lgx:px-4 lgx:pb-4 lgx:pt-3">
          <div className="hidden w-full items-center gap-2.5 lgx:flex">
            <ShineMark size={30} />
            <div className="leading-tight">
              <div className="text-[13px] font-bold">Dejoiy workspace</div>
              <div className="text-[11px] text-muted-foreground">Signed in with Dejoiy Mail</div>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setRail((v) => !v)}
                aria-expanded={!rail}
                aria-label={rail ? "Open the menu" : "Fold the menu"}
                className="hidden size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:grid"
              >
                {rail ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{rail ? "Open the menu" : "Fold the menu"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={askJoi} className="rounded-full transition-transform hover:scale-105 active:scale-95" aria-label="Ask Joi">
                <img src={JOI_AVATAR} alt="" className="size-9 rounded-full border-2 border-[var(--sticker-border)] bg-primary object-cover" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Ask Joi (⌘J)</TooltipContent>
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
              <DropdownMenuItem onClick={() => setStatusOpen(true)} className="cursor-pointer flex-col items-start gap-0.5 py-2">
                <span className="text-sm font-semibold">{user?.customStatus || "Set a status"}</span>
                <span className="text-xs text-muted-foreground">{presenceLabel(myPresence)} · change status and presence</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCardOpen(true)} className="cursor-pointer">
                <IdCardIcon className="mr-2 size-4" /> My ID card
              </DropdownMenuItem>
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
      <div className={cn("flex min-w-0 flex-1 flex-col", !embed && !fullChat && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0")}>
        {/* TOPBAR */}
        <header className={cn("flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 md:h-14 max-md:border-b-0", embed && "hidden", fullChat && "max-md:hidden")}>
          <div className="flex items-center gap-3">
            {/* Phones: your picture opens your status and profile sheet (like Zoho Cliq, WhatsApp) */}
            <button
              onClick={() => setStatusOpen(true)}
              className="md:hidden rounded-full transition-transform active:scale-95"
              aria-label="Your status and profile"
            >
              <UserAvatar user={user} presence={myPresence} size="sm" showStatus />
            </button>
            <span className="text-[26px] font-extrabold leading-none tracking-[-0.04em] md:text-lg md:tracking-[-0.03em]">{pageTitle}</span>
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
              className="hidden h-11 w-[min(520px,40vw)] items-center gap-2 rounded-full border-[1.5px] border-border bg-card pl-5 pr-1 text-sm text-muted-foreground transition-colors hover:border-[var(--sticker-border)] sm:flex"
            >
              <span className="flex-1 text-left">Find chats, people, files or messages</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              {/* the pink search key, like Dejoiy Mail's */}
              <span className="grid h-9 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
                <Search className="size-4" />
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground sm:hidden"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-[18px]" />
            </Button>
            {/* Joi: chat with her; on a chat page, her tools for that chat */}
            <button
              onClick={() => (conversationId ? setAiOpen(true) : askJoi())}
              title={conversationId ? "Joi: tools for this chat (⌘J to chat with her)" : "Ask Joi (⌘J)"}
              className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-[var(--sticker-border)] bg-primary py-0.5 pl-0.5 pr-3 text-[13px] font-extrabold text-primary-foreground transition-transform active:scale-95"
            >
              <img src={JOI_AVATAR} alt="" className="size-7 rounded-full border-[1.5px] border-[var(--sticker-border)] bg-card object-cover" />
              Joi
            </button>
            <NotificationsPopover />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* ===== MOBILE BOTTOM NAV (visible only on mobile/tablet) ===== */}
      {/* docked like a phone app's tab bar (Zoho Cliq, WhatsApp): the active tab gets a pill behind its icon */}
      <nav
        className={cn(
          "md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+8px)] z-50 rounded-[28px] border border-border/70 bg-card/85 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/70",
          (embed || fullChat) && "hidden",
        )}
        aria-label="Shine"
      >
        <div className="flex h-16 items-stretch justify-around px-1.5 py-1.5">
          {mobileFilteredNav.map((n) => (
            <button
              key={n.to}
              onClick={() => navigate(n.to)}
              aria-current={n.match(location.pathname) ? "page" : undefined}
              className={cn(
                "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] transition-colors active:scale-95",
                n.match(location.pathname) ? "bg-primary/15 font-bold text-foreground [&_svg]:text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative grid h-7 w-10 place-items-center">
                <n.icon className="size-[22px]" strokeWidth={n.match(location.pathname) ? 2.4 : 1.9} />
                {n.to === "/app/chats" && (unread ?? 0) > 0 && (
                  <span className="absolute -top-1 left-[calc(50%+6px)] grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-card bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {(unread ?? 0) > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
              <span className="truncate text-[11px] leading-none">{n.label}</span>
            </button>
          ))}
          {mobileFilteredMore.length > 0 && (
            <DropdownMenu open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] transition-colors active:scale-95",
                    mobileFilteredMore.some((n) => n.match(location.pathname)) ? "bg-primary/15 font-bold text-foreground [&_svg]:text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className="grid h-7 w-10 place-items-center">
                    <MoreHorizontal className="size-[22px]" />
                  </span>
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
                <DropdownMenuItem onClick={() => { askJoi(); setMobileMoreOpen(false); }} className="cursor-pointer gap-3">
                  <img src={JOI_AVATAR} alt="" className="size-5 rounded-full object-cover" /> Ask Joi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>

      <StatusSheet
        open={statusOpen}
        onOpenChange={setStatusOpen}
        user={user as never}
        presence={myPresence}
        isAdmin={isAdmin}
        onNavigate={navigate}
        onSignOut={handleSignOut}
        onIdCard={() => setCardOpen(true)}
      />
      {/* My ID card: from your picture (profile menu on computers, profile sheet on phones) */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm">
          <DialogTitle className="sr-only">My ID card</DialogTitle>
          {user && <IdCard person={user} />}
          <p className="text-center text-xs text-muted-foreground">Your company's admins set your role, position, employee ID and department.</p>
        </DialogContent>
      </Dialog>

      {/* GLOBAL OVERLAYS */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShineAIDrawer open={aiOpen} onOpenChange={setAiOpen} conversationId={conversationId} onChatWithJoi={askJoi} />
      <CallOverlay />
    </div>
  );
}
