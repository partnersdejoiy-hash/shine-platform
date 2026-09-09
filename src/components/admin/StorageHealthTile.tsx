import { cn } from "@/lib/utils";
import { probeSelfHostedStorage } from "@/lib/upload";
import { UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * "File storage" tile for the Admin console → System health tab.
 *
 * Probes the self-hosted storage API (GET /api/storage/ping → MinIO) once on
 * mount and surfaces the exact backend state + latency. Falls back gracefully
 * to "API unreachable — using Convex storage" so operators always know which
 * backend is actually backing uploads.
 */
export function StorageHealthTile({ bytes }: { bytes: number }) {
  const [state, setState] = useState<{ ok: boolean | null; detail: string }>({
    ok: null,
    detail: "probing…",
  });

  useEffect(() => {
    let mounted = true;
    probeSelfHostedStorage()
      .then((res) => {
        if (!mounted) return;
        if (res === null) {
          setState({ ok: false, detail: "API unreachable — using Convex storage" });
        } else {
          setState({ ok: res.ok, detail: `${res.detail} · ${res.latencyMs}ms` });
        }
      })
      .catch(() => {
        if (mounted) setState({ ok: false, detail: "probe failed" });
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="glass hairline rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">File storage</span>
        <span
          className={cn(
            "size-2 rounded-full",
            state.ok === null
              ? "animate-pulse bg-amber-400"
              : state.ok
                ? "bg-emerald-400"
                : "bg-rose-400",
          )}
        />
      </div>
      <div className="mt-2 text-lg font-bold tabular-nums">
        {formatBytesLocal(bytes)}
      </div>
      <div
        className={cn(
          "mt-0.5 flex items-center gap-1 text-[10px]",
          state.ok === null
            ? "text-muted-foreground"
            : state.ok
              ? "text-emerald-400"
              : "text-rose-400",
        )}
      >
        {state.ok === false && <UploadCloud className="size-3" />}
        {state.detail}
      </div>
    </div>
  );
}

function formatBytesLocal(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
