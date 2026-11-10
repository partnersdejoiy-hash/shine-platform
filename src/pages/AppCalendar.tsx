import { CalendarBoard } from "@/components/app/CalendarBoard";
import { useSearchParams } from "react-router";

/** Shine's calendar page: the full Dejoiy Mail (Zimbra) calendar. */
export function AppCalendar() {
  const [params] = useSearchParams();
  const day = params.get("day");
  const startDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00`) : undefined;
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
          Your Dejoiy Mail calendar. Events you add here show in mail.dejoiy.com too.
        </p>
        <CalendarBoard startDay={startDay} startAdding={params.get("new") === "1"} />
      </div>
    </div>
  );
}
