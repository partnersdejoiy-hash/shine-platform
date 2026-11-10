import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEJOIY_MAIL_URL } from "@/lib/embed";
import { toneFor } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Repeat, Trash2, Video, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Ev = {
  id: string;
  invId: string;
  title: string;
  location: string;
  start: number;
  end: number;
  allDay: boolean;
  organizer?: boolean;
  repeats?: boolean;
};

const DAY = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isShine = (e: Ev) => e.location.startsWith("https://") && /\/meet\//.test(e.location);
const toneOf = (e: Ev) => (isShine(e) ? "#ff4fa3" : toneFor(e.title));
const time = (ms: number) => format(ms, "h:mm a");
const onDay = (e: Ev, d: Date) => {
  const s = startOfDay(d).getTime();
  return e.start < s + DAY && e.end > s;
};

/**
 * The whole Dejoiy Mail (Zimbra) calendar inside Shine: a month you can page
 * through, the chosen day's events, and adding or deleting events. It is the
 * same calendar as mail.dejoiy.com, so changes show there too.
 * `compact` is the Home card: a small month with dots and the day's list.
 */
export function CalendarBoard({
  compact = false,
  onEmpty,
  startDay,
  startAdding = false,
}: {
  compact?: boolean;
  onEmpty?: React.ReactNode;
  startDay?: Date;
  startAdding?: boolean;
}) {
  const load = useAction(api.calendarLink.myCalendar);
  const [month, setMonth] = useState(() => startOfMonth(startDay ?? new Date()));
  const [picked, setPicked] = useState(() => startOfDay(startDay ?? new Date()));
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; connected: boolean; events: Ev[] } | null>(null);
  const [adding, setAdding] = useState(startAdding);

  const gridStart = useMemo(() => startOfWeek(month, { weekStartsOn: 1 }), [month]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const key = `${gridStart.getTime()}:${version}`;
  const loading = state?.key !== key;
  const refresh = () => setVersion((n) => n + 1);

  useEffect(() => {
    let live = true;
    load({ start: gridStart.getTime(), end: addDays(gridStart, 42).getTime() })
      .then((r) => live && setState({ key, ...(r as { connected: boolean; events: Ev[] }) }))
      .catch(() => live && setState({ key, connected: false, events: [] }));
    return () => {
      live = false;
    };
  }, [load, gridStart, key]);

  const go = (n: number) => {
    const next = addMonths(month, n);
    setMonth(next);
    setPicked(isSameMonth(new Date(), next) ? startOfDay(new Date()) : next);
  };
  const today = () => {
    setMonth(startOfMonth(new Date()));
    setPicked(startOfDay(new Date()));
  };

  if (!state) return <div className={cn("animate-pulse rounded-[22px] bg-muted", compact ? "h-64" : "h-[520px]")} aria-label="Loading your calendar" />;
  if (!state.connected) return <>{onEmpty ?? <NotConnected />}</>;

  const events = state.events;
  const dayEvents = events.filter((e) => onDay(e, picked));

  return (
    <div className={cn(!compact && "grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]")}>
      <section className="tone-card overflow-hidden p-3 sm:p-4" style={{ "--t": "#ff4fa3" } as CSSProperties} aria-label="Month">
        <div className="mb-3 flex items-center gap-2">
          <h3 className={cn("flex-1 font-extrabold tracking-[-0.03em]", compact ? "text-base" : "text-xl sm:text-2xl")}>
            {format(month, "MMMM yyyy")}
            {loading && <Loader2 className="ml-2 inline size-4 animate-spin text-muted-foreground" />}
          </h3>
          <Button size="sm" variant="outline" onClick={today}>
            Today
          </Button>
          <Button size="icon" variant="outline" className="size-8" onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon" variant="outline" className="size-8" onClick={() => go(1)} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {compact ? d[0] : d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const list = events.filter((e) => onDay(e, d));
            const inMonth = isSameMonth(d, month);
            const isToday = isSameDay(d, new Date());
            const isPicked = isSameDay(d, picked);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setPicked(startOfDay(d))}
                aria-pressed={isPicked}
                aria-label={`${format(d, "EEEE d MMMM")}, ${list.length} event${list.length === 1 ? "" : "s"}`}
                className={cn(
                  "flex flex-col items-stretch rounded-xl border-2 p-1 text-left transition-colors",
                  compact ? "min-h-11" : "min-h-14 sm:min-h-24",
                  isPicked ? "border-[var(--sticker-border)] bg-[#ffd6ea] text-[#121212]" : "border-transparent hover:bg-accent",
                  !inMonth && !isPicked && "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center self-center rounded-full text-xs font-bold sm:self-start",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(d, "d")}
                </span>
                {/* dots on small grids, titled chips on the full one */}
                <span className={cn("mt-auto flex flex-wrap justify-center gap-0.5 pt-1", !compact && "sm:hidden")}>
                  {list.slice(0, 3).map((e) => (
                    <i key={e.id + e.start} className="size-1.5 rounded-full" style={{ background: toneOf(e) }} />
                  ))}
                </span>
                {!compact && (
                  <span className="hidden space-y-0.5 pt-1 sm:block">
                    {list.slice(0, 3).map((e) => (
                      <span
                        key={e.id + e.start}
                        className="block truncate rounded-md border-l-4 px-1 py-px text-[11px] font-semibold"
                        style={{ borderColor: toneOf(e), background: `color-mix(in srgb, ${toneOf(e)} 22%, transparent)` }}
                      >
                        {!e.allDay && <span className="font-bold">{format(e.start, "h:mm")} </span>}
                        {e.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="block px-1 text-[11px] font-bold text-muted-foreground">+{list.length - 3} more</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className={cn("space-y-2", compact ? "mt-3" : "")} aria-label={format(picked, "EEEE d MMMM")}>
        <div className="flex items-center gap-2 px-1">
          <h3 className={cn("flex-1 font-extrabold tracking-[-0.03em]", compact ? "text-sm" : "text-lg")}>
            {isSameDay(picked, new Date()) ? "Today" : format(picked, "EEEE, d MMM")}
          </h3>
          {compact ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/app/calendar?new=1&day=${format(picked, "yyyy-MM-dd")}`}>
                <Plus className="size-3.5" /> Event
              </Link>
            </Button>
          ) : (
            !adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-3.5" /> New event
              </Button>
            )
          )}
        </div>

        {!compact && adding && <NewEvent key={picked.getTime()} day={picked} onClose={() => setAdding(false)} onSaved={refresh} />}

        {dayEvents.length === 0 && (
          <p className="rounded-[22px] border-2 border-dashed border-border p-4 text-sm text-muted-foreground">Nothing on this day.</p>
        )}
        {dayEvents.map((e) => (
          <EventRow key={e.id + e.start} e={e} canDelete={!compact} onDeleted={refresh} />
        ))}
        <a
          href={`${DEJOIY_MAIL_URL}/#/calendar`}
          target="_top"
          className="block px-1 pt-1 text-xs font-semibold text-muted-foreground underline decoration-primary decoration-2 underline-offset-4"
        >
          Open in Dejoiy Mail
        </a>
      </section>
    </div>
  );
}

function EventRow({ e, canDelete, onDeleted }: { e: Ev; canDelete: boolean; onDeleted: () => void }) {
  const remove = useAction(api.calendarLink.removeEvent);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const live = e.start <= now + 10 * 60_000 && e.end > now;
  const shine = isShine(e);

  const del = async () => {
    if (!sure) return setSure(true);
    setBusy(true);
    try {
      await remove({ invId: e.invId, title: e.title });
      toast.success("Event deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message.split("\n")[0] : "Could not delete the event.");
      setBusy(false);
      setSure(false);
    }
  };

  return (
    <div style={{ "--t": toneOf(e) } as CSSProperties} className="tone-card flex items-center gap-3 px-3.5 py-3">
      <div className="tone-dot grid size-10 shrink-0 place-items-center rounded-2xl border-2 border-[var(--sticker-border)] text-[#121212]">
        {shine ? <Video className="size-4" /> : <CalendarDays className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{e.title}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {e.allDay ? "All day" : `${time(e.start)} – ${time(e.end)}`}
          {e.repeats && <Repeat className="size-3" aria-label="Repeats" />}
          {e.location && !shine && <span className="truncate">· {e.location}</span>}
        </div>
      </div>
      {shine && (
        <Button size="sm" variant={live ? "default" : "outline"} asChild>
          <a href={e.location}>{live ? "Join now" : "Join"}</a>
        </Button>
      )}
      {canDelete && e.organizer && !e.repeats && (
        <Button
          size={sure ? "sm" : "icon"}
          variant={sure ? "destructive" : "ghost"}
          className={cn(!sure && "size-8")}
          onClick={del}
          onBlur={() => !busy && setSure(false)}
          disabled={busy}
          aria-label={`Delete ${e.title}`}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : sure ? "Delete?" : <Trash2 className="size-4" />}
        </Button>
      )}
    </div>
  );
}

function NewEvent({ day, onClose, onSaved }: { day: Date; onClose: () => void; onSaved: () => void }) {
  const add = useAction(api.calendarLink.addEvent);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(day, "yyyy-MM-dd"));
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("11:00");
  const [allDay, setAllDay] = useState(false);
  const [guests, setGuests] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim()) return setError("Give the event a title.");
    const start = allDay ? new Date(`${date}T00:00`).getTime() : new Date(`${date}T${from}`).getTime();
    const end = allDay ? start + DAY : new Date(`${date}T${to}`).getTime();
    if (!(end > start)) return setError("The event must end after it starts.");
    setBusy(true);
    setError(null);
    try {
      await add({
        title: title.trim(),
        start,
        end,
        allDay,
        guests,
        location,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      toast.success(guests.trim() ? "Event added and invites sent" : "Event added");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*Uncaught Error:\s*/s, "").split("\n")[0] : "Could not add the event.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="tone-card space-y-2.5 p-3.5" style={{ "--t": "#ffd23f" } as CSSProperties} noValidate>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-extrabold">New event</span>
        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>
      <Input autoFocus placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[#ff4fa3]" />
        All day
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-2">
          <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Starts" />
          <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Ends" />
        </div>
      )}
      <Input placeholder="Guests: emails, comma separated" value={guests} onChange={(e) => setGuests(e.target.value)} aria-label="Guests" />
      <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location" />
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy} className="flex-1">
          {busy && <Loader2 className="size-4 animate-spin" />} Save to calendar
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/app/meetings?new=1">
            <Video className="size-4" /> Shine meeting
          </Link>
        </Button>
      </div>
    </form>
  );
}

function NotConnected() {
  return (
    <p className="rounded-[22px] border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
      This account has no Dejoiy Mail calendar. Sign in to Shine with your Dejoiy Mail mailbox to see it here.
    </p>
  );
}
