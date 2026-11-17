import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * Guards authenticated routes. Also enforces the enterprise password policy:
 * users with a temporary password (mustChangePassword) are locked out of the
 * app until they set their own password on /app/change-password.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  // A meeting guest has no account: the app itself stays closed to them.
  if (user?.isAnonymous) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">You joined as a guest</h1>
          <p className="text-sm text-muted-foreground">Guests can only be in the meeting they were invited to. To use Shine, sign in with your own account.</p>
          <button type="button" className="text-sm font-medium text-primary underline-offset-2 hover:underline" onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    );
  }

  // Forced password change: block all app routes except the change page itself.
  const onChangePage = location.pathname.startsWith("/app/change-password");
  if (user?.mustChangePassword && !onChangePage) {
    return <Navigate to="/app/change-password" replace />;
  }

  return children;
}
