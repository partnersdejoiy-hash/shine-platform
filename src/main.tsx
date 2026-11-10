import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { AccentSync } from "@/components/AccentSync";
import { StartupAnimation } from "@/components/StartupAnimation";
import { applyStoredAccent } from "@/lib/accent";
import { RequireAuth } from "@/components/RequireAuth";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { AppShell } from "@/components/app/AppShell";
import { AppDashboard } from "@/pages/AppDashboard";
import { AppChats } from "@/pages/AppChats";
import { AppMeetings } from "@/pages/AppMeetings";
import { AppFiles } from "@/pages/AppFiles";
import { AppTasks } from "@/pages/AppTasks";
import { AppContacts } from "@/pages/AppContacts";
import { AppOrganizations } from "@/pages/AppOrganizations";
import { AppTickets } from "@/pages/AppTickets";
import { AppAdmin } from "@/pages/AppAdmin";
import { AppDesignSystem } from "@/pages/AppDesignSystem";
import { AppSettings } from "@/pages/AppSettings";
import { AppChangePassword } from "@/pages/AppChangePassword";
import { MeetingRoom } from "@/components/meeting/MeetingRoom";
import { MeetHome } from "@/pages/MeetHome";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { convex } from "@/lib/convex";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import "./index.css";

// ---- SHINE theme boot -----------------------------------------------
// Priority: explicit user preference > system preference > SHINE default (dark)
function getInitialTheme(): "dark" | "light" {
  try {
    const saved = localStorage.getItem("shine-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* ignore */
  }
  // Detect OS/browser system preference
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  }
  return "dark";
}
const initialTheme = getInitialTheme();
document.documentElement.classList.toggle("dark", initialTheme !== "light");
// Listen for OS theme changes when user preference is "System"
if (typeof window !== "undefined" && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", (e) => {
    // Only react to system changes when user hasn't set an explicit preference
    const saved = localStorage.getItem("shine-theme");
    if (saved !== "dark" && saved !== "light") {
      document.documentElement.classList.toggle("dark", e.matches);
    }
  });
}
// Apply the user's stored accent color before first paint.
applyStoredAccent();

// Global error handler — catch errors before React mounts or in async code
window.addEventListener("error", (e) => {
  console.error("[SHINE] Global error:", e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[SHINE] Unhandled rejection:", e.reason);
});

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const DejoiyMailSSO = lazy(() => import("./pages/DejoiyMailSSO.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page.
 *  SECURITY: never expose stack traces or internal details to end users.
 *  Technical details go only to the console (server-side logs in prod).
 */
/** Detects whether an error is caused by Convex being unavailable or paused. */
function isConvexOfflineError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("deployment has been disabled") ||
    msg.includes("usage limit") ||
    msg.includes("function calls limit") ||
    msg.includes("convex deployment paused") ||
    msg.includes("shared hosting") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("convex")
  );
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string; isConvexDown: boolean }
> {
  state = { hasError: false, errorMsg: "", isConvexDown: false };
  static getDerivedStateFromError(err: Error) {
    return {
      hasError: true,
      errorMsg: err?.message ?? String(err ?? "Unknown error"),
      isConvexDown: isConvexOfflineError(err),
    };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error("[SHINE] Runtime error:", err, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      if (this.state.isConvexDown) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
            <div className="max-w-md text-center space-y-5">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-500/10">
                <svg className="size-8 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold">SHINE is temporarily unavailable</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The backend service has reached its usage limit. Our team has been notified.
                  Please try again in a few minutes.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Try again
                </button>
                <p className="text-[11px] text-muted-foreground/50">
                  Error ID: SHINE-{Date.now().toString(36).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                SHINE encountered an unexpected error. Please try refreshing the page.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Refresh page
            </button>
            <p className="text-[11px] text-muted-foreground/50">
              Error ID: SHINE-{Date.now().toString(36).toUpperCase()}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Self-hosted API — no Convex dependency

// Standalone meeting site: meet.dejoiy.com / meets.dejoiy.com show the
// Google-Meet-style home. The integrated app keeps its own shell.
const IS_MEET_HOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "meet.dejoiy.com" ||
    window.location.hostname === "meets.dejoiy.com" ||
    (window.location.hostname === "localhost" && new URLSearchParams(window.location.search).get("meet") === "1"));

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
    <RootErrorBoundary>
      <StartupAnimation />
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
        <AccentSync />
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route
                path="/"
                element={IS_MEET_HOST ? <Navigate to="/meet" replace /> : <Landing />}
              />
              <Route path="/home" element={<Landing />} />
              <Route path="/auth" element={<AuthPage redirectAfterAuth={IS_MEET_HOST ? "/meet" : "/app"} />} />
              <Route path="/auth/dejoiy" element={<DejoiyMailSSO />} />
              {/* Forced password change (temp password users are locked out until they set a new one) */}
              <Route
                path="/app/change-password"
                element={
                  <RequireAuth>
                    <AppChangePassword />
                  </RequireAuth>
                }
              />
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<PageErrorBoundary name="Dashboard"><AppDashboard /></PageErrorBoundary>} />
                <Route path="chats" element={<PageErrorBoundary name="Messages"><AppChats /></PageErrorBoundary>} />
                <Route path="chats/:id" element={<PageErrorBoundary name="Messages"><AppChats /></PageErrorBoundary>} />
                <Route path="meetings" element={<PageErrorBoundary name="Meetings"><AppMeetings /></PageErrorBoundary>} />
                <Route path="files" element={<PageErrorBoundary name="Files"><AppFiles /></PageErrorBoundary>} />
                <Route path="tasks" element={<PageErrorBoundary name="Tasks"><AppTasks /></PageErrorBoundary>} />
                <Route path="contacts" element={<PageErrorBoundary name="Contacts"><AppContacts /></PageErrorBoundary>} />
                <Route path="organizations" element={<PageErrorBoundary name="Organizations"><AppOrganizations /></PageErrorBoundary>} />
                <Route path="tickets" element={<PageErrorBoundary name="Access Tickets"><AppTickets /></PageErrorBoundary>} />
                <Route path="admin" element={<PageErrorBoundary name="Admin Console"><AppAdmin /></PageErrorBoundary>} />
                <Route path="design" element={<PageErrorBoundary name="Design"><AppDesignSystem /></PageErrorBoundary>} />
                <Route path="settings" element={<PageErrorBoundary name="Settings"><AppSettings /></PageErrorBoundary>} />
              </Route>
              <Route
                path="/app/meetings/:id"
                element={
                  <RequireAuth>
                    <MeetingRoom />
                  </RequireAuth>
                }
              />
              {/* Standalone meeting site (meet.dejoiy.com) */}
              <Route
                path="/meet"
                element={
                  <RequireAuth>
                    <MeetHome />
                  </RequireAuth>
                }
              />
              <Route
                path="/meet/:id"
                element={
                  <RequireAuth>
                    <MeetingRoom />
                  </RequireAuth>
                }
              />
              {/* Stable shareable link: /meet/<title-slug>/<room-code> */}
              <Route
                path="/meet/:slug/:code"
                element={
                  <RequireAuth>
                    <MeetingRoom />
                  </RequireAuth>
                }
              />
              {/* meets.dejoiy.com aliases the standalone meet site */}
              <Route
                path="/meets"
                element={
                  <RequireAuth>
                    <MeetHome />
                  </RequireAuth>
                }
              />
              <Route
                path="/meets/:id"
                element={
                  <RequireAuth>
                    <MeetingRoom />
                  </RequireAuth>
                }
              />
              <Route
                path="/meets/:slug/:code"
                element={
                  <RequireAuth>
                    <MeetingRoom />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" richColors />
    </RootErrorBoundary>
    </ConvexAuthProvider>
  </StrictMode>,
);
