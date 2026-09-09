import { api } from "@/convex/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@/convex/react";
import { Bell, BellOff, CalendarClock, CheckCheck, MessageSquare, Phone, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

const KIND_ICON: Record<string, React.ElementType> = {
  message: MessageSquare,
  call: Phone,
  meeting: CalendarClock,
  org_invite: Users,
  task: CheckCheck,
};

export function NotificationsPopover() {
  const navigate = useNavigate();
  const notifications = useQuery(api.notifications.list);
  const unread = useQuery(api.notifications.unreadCount);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [open, setOpen] = useState(false);

  const go = (link?: string | null, id?: string) => {
    if (id) markRead({ notificationId: id as any }).catch(() => {});
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9 text-muted-foreground">
          <Bell className="size-[18px]" />
          {(unread ?? 0) > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="size-4 text-primary" /> Notifications
            {(unread ?? 0) > 0 && (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/20">{unread}</Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => markAllRead().catch(() => {})}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <BellOff className="size-6" />
              <p className="text-sm">You're all caught up</p>
              <p className="text-xs">New messages and events will appear here.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? MessageSquare;
              return (
                <button
                  key={n._id}
                  onClick={() => go(n.link, n._id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                    !n.read && "bg-primary/4",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
                      n.read ? "bg-accent text-muted-foreground" : "bg-primary/12 text-primary",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    )}
                    {!n.read && (
                      <span className="mt-1 inline-block size-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border px-4 py-2 text-center">
          <Button variant="link" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("/app/settings")}>
            Notification settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
