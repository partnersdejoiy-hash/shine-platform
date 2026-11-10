import { ShineLogo } from "@/components/ShineLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { dejoiyMailSignInUrl } from "@/lib/embed";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

/** Same-site paths only, so the token can never send someone elsewhere. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app/chats";
}

function tokenEmail(token: string): string {
  try {
    const body = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(body)).e ?? "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * /auth/dejoiy#t=<token>&next=<path>
 * Dejoiy Mail sends its signed-in user here with a short-lived token in the
 * URL fragment (never sent to any server log). We sign that person in and move on.
 */
export default function DejoiyMailSSO() {
  const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const params = useRef(new URLSearchParams(window.location.hash.slice(1)));

  useEffect(() => {
    // the token is single-purpose: drop it from the address bar and history straight away
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (started.current || isLoading) return;
    started.current = true;
    const token = params.current.get("t") ?? "";
    const next = safeNext(params.current.get("next"));
    if (!token) {
      setError("This sign-in link is missing its token.");
      return;
    }
    (async () => {
      try {
        if (isAuthenticated && user?.email?.toLowerCase() === tokenEmail(token)) {
          navigate(next, { replace: true });
          return;
        }
        if (isAuthenticated) await signOut();
        await signIn("dejoiy-mail", { token });
        navigate(next, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error:\s*/s, "").split("\n")[0] : "Could not sign you in.");
      }
    })();
  }, [isLoading, isAuthenticated, user?.email, signIn, signOut, navigate]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <ShineLogo size={56} />
        {error ? (
          <>
            <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.03em]">Couldn't sign you in</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6" asChild>
              <a href={dejoiyMailSignInUrl(safeNext(params.current.get("next")))} target="_top">
                Try again with Dejoiy Mail
              </a>
            </Button>
          </>
        ) : (
          <p className="mt-6 text-sm font-semibold text-muted-foreground" role="status">
            Signing you in with Dejoiy Mail…
          </p>
        )}
      </div>
    </div>
  );
}
