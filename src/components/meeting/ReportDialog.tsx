import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayName, formatDuration } from "@/lib/format";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Meeting report — attendance, activities & screen changes, Excel export.     */
/* -------------------------------------------------------------------------- */
export function ReportDialog({
  open,
  onOpenChange,
  report,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report: any;
  onDownload: () => void;
}) {
  const loading = open && !report;
  const total = report?.participants?.length ?? 0;
  const present = report?.participants?.filter((p: any) => !p.leftAt).length ?? 0;
  const screenShares =
    report?.events?.filter((e: any) => e.type.startsWith("screen_share")).length ?? 0;
  const chats = report?.chat?.filter((m: any) => m.kind !== "system").length ?? 0;
  const handRaises =
    report?.participants?.reduce((n: number, p: any) => n + (p.handRaises ?? 0), 0) ?? 0;

  const stats = [
    { label: "Attendees", value: total, sub: `${present} present` },
    { label: "Chat messages", value: chats, sub: "from meeting chat" },
    { label: "Screen shares", value: screenShares, sub: "presentations" },
    { label: "Hand raises", value: handRaises, sub: "questions" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/10 bg-[#121212] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-amber-400" />
            Meeting report
          </DialogTitle>
          <DialogDescription className="text-xs text-white/50">
            Attendance, participant activity and screen changes — exportable as an
            Excel workbook.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-white/50">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-xs">Loading meeting data…</span>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                >
                  <div className="text-xl font-bold text-amber-400">{s.value}</div>
                  <div className="mt-0.5 text-[11px] font-medium text-white/80">{s.label}</div>
                  <div className="text-[10px] text-white/40">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Room: <span className="font-mono font-semibold text-amber-400">{report.meeting.roomCode}</span>
                </span>
                <span>Duration: {formatDuration(report.durationSeconds ?? 0)}</span>
                <span>
                  Attendance rate:{" "}
                  <span className="font-semibold text-white">
                    {total ? Math.round((present / total) * 100) : 0}%
                  </span>
                </span>
              </div>
            </div>

            <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {report.events.length === 0 && (
                <p className="py-4 text-center text-xs text-white/40">No activity recorded yet.</p>
              )}
              {report.events.slice(-20).map((e: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px]"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
                  <div className="min-w-0">
                    <span className="font-medium text-white/80">
                      {e.user ? displayName(e.user) : "Someone"}
                    </span>{" "}
                    <span className="text-white/50">{e.type.replace(/_/g, " ")}</span>
                    {e.detail ? (
                      <span className="block truncate text-white/35">{e.detail}</span>
                    ) : null}
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] text-white/30">
                    {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            className="gap-1.5 bg-amber-400 text-black hover:bg-amber-400"
            onClick={onDownload}
            disabled={loading || !report}
          >
            <Download className="size-4" /> Download Excel report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
