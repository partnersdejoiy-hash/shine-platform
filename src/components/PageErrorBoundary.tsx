import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

/**
 * Per-module error boundary. Wraps individual pages so a crash in one module
 * (e.g. Meetings) doesn't bring down the entire SHINE application shell.
 */
export class PageErrorBoundary extends React.Component<
  { children: React.ReactNode; name?: string },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error(
      `[SHINE] Page error in ${this.props.name ?? "module"}:`,
      err,
      info?.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      const moduleName = this.props.name ?? "This section";
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-3">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500/10">
              <AlertTriangle className="size-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{moduleName} temporarily unavailable</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This section encountered an error. Other parts of SHINE are still working.
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <RefreshCcw className="size-3" /> Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
