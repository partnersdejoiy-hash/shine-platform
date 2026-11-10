import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { DEJOIY_MAIL_URL } from "@/lib/embed";
import { toneFor } from "@/lib/tone";
import { useAction } from "convex/react";
import { CalendarDays, Video } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

type Ev = { id: string; title: string; location: string; start: number; end: number; allDay: boolean };

const day = (ms: number) => {
  const d = new Date(ms), today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};
const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * The same calendar as mail.dejoiy.com (Zimbra). Shine meetings are on it too,
 * because scheduling one in Shine puts it there. Shows nothing when this
 * account has no Dejoiy Mail calendar.
 */
export function MailCalendar({ limit = 5, onEmpty }: { limit?: number; onEmpty?: React.ReactNode }) {
  const load = useAction(api.calendarLink.myCalendar);
  const [state, setState] = useState<{ connected: boolean; events: Ev[]; at: number } | null>(null);

  useEffect(() => {
    let live = true;
    load({ days: 14 })
      .then((r) => live && setState({ ...(r as { connected: boolean; events: Ev[] }), at: Date.now() }))
      .catch(() => live && setState({ connected: false, events: [], at: Date.now() }));
    return () => {
      live = false;
    };
  }, [load]);

  if (!state) return <div className="h-20 animate-pulse rounded-[22px] bg-muted" aria-label="Loading your calendar" />;
  if (!state.connected) return <>{onEmpty}</>;
  const upcoming = state.events.filter((e) => e.end > state.at).slice(0, limit);

  return (
    <div className="space-y-2">
      {upcoming.length === 0 && (
        <p className="rounded-[22px] border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
          Nothing on your calendar for the next two weeks.
        </p>
      )}
      {upcoming.map((e) => {
        const shine = /\/meet\//.test(e.location) && e.location.startsWith("https://");
        const now = e.start <= state.at + 10 * 60_000 && e.end > state.at;
        return (
          <div
            key={e.id + e.start}
            style={{ "--t": shine ? "#ff4fa3" : toneFor(e.title) } as CSSProperties}
            className="tone-card flex items-center gap-3 px-3.5 py-3"
          >
            <div className="tone-dot grid size-10 shrink-0 place-items-center rounded-2xl border-2 border-[var(--sticker-border)] text-[#121212]">
              {shine ? <Video className="size-4" /> : <CalendarDays className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{e.title}</div>
              <div className="text-xs text-muted-foreground">
                {day(e.start)} · {e.allDay ? "All day" : `${time(e.start)} – ${time(e.end)}`}
              </div>
            </div>
            {shine && (
              <Button size="sm" variant={now ? "default" : "outline"} asChild>
                <a href={e.location}>{now ? "Join now" : "Join"}</a>
              </Button>
            )}
          </div>
        );
      })}
      <a
        href={`${DEJOIY_MAIL_URL}/#/calendar`}
        target="_top"
        className="block px-1 text-xs font-semibold text-muted-foreground underline decoration-primary decoration-2 underline-offset-4"
      >
        Open the full calendar in Dejoiy Mail
      </a>
    </div>
  );
}
