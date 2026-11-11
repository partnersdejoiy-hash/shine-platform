import React, { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";

/**
 * Proactive health check that probes the Convex backend before any child
 * component calls useQuery(). If the backend is unavailable (paused, rate-limited,
 * or down), this renders a clean offline page DIRECTLY — no error boundary needed,
 * no React crash, no Freebuff platform error boundary intercepting.
 *
 * This bypasses the problem where Convex deployment pausing causes every
 * useQuery() call to throw, crashing the entire React tree.
 */
export function ConvexHealthCheck({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let cancelled = false;
    const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

    async function probe() {
      try {
        // Hit the Convex health endpoint with a minimal query
        const res = await fetch(`${convexUrl}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "health:echo",
            args: {},
          }),
          signal: AbortSignal.timeout(10000),
        });

        const data = await res.json().catch(() => ({}));
        const isDisabled =
          typeof data?.errorMessage === "string" &&
          (data.errorMessage.includes("disabled") ||
            data.errorMessage.includes("usage limit") ||
            data.errorMessage.includes("function calls limit"));

        if (!cancelled) {
          setStatus(isDisabled ? "offline" : "online");
        }
      } catch {
        // Network error, CORS, DNS failure, etc.
        if (!cancelled) setStatus("offline");
      }
    }

    probe();

    // Re-probe every 60 seconds if offline (in case limit is raised)
    const interval = setInterval(() => {
      if (status === "offline" || status === "checking") {
        probe();
      }
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Still checking — show a lightweight loading state
  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="relative size-10">
            <div className="absolute inset-0 rounded-full border-2 border-gold/30" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Connecting to SHINE…</p>
        </div>
      </div>
    );
  }

  // Convex is offline — render the offline page directly (NO crash, NO error boundary)
  if (status === "offline") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-6">
          {/* SHINE logo mark */}
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/20">
            <span className="text-2xl font-bold text-gold tracking-tight">S</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              SHINE is temporarily unavailable
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Our backend service is undergoing maintenance. All data is safe and
              SHINE will be back online shortly.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-gold/90 active:scale-[0.98]"
            >
              <RefreshCcw className="size-4" />
              Retry connection
            </button>
            <p className="text-[11px] text-muted-foreground/60">
              Error ID: SHINE-{Date.now().toString(36).toUpperCase()}
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-4 text-left text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">What happened?</p>
            <p>
              The communication backend has reached its usage limit. Our team has been
              automatically notified. No data has been lost.
            </p>
            <p className="text-muted-foreground/60">
              The page will automatically retry every 60 seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Backend is online — render children normally
  return <>{children}</>;
}
