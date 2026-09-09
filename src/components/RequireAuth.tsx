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
  const { isLoading, isAuthenticated, user } = useAuth();
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

  // Forced password change: block all app routes except the change page itself.
  const onChangePage = location.pathname.startsWith("/app/change-password");
  if (user?.mustChangePassword && !onChangePage) {
    return <Navigate to="/app/change-password" replace />;
  }

  return children;
}
