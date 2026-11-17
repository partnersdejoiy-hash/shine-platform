import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Video } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";

const GUEST_KEY = "shine-guest-for";
const read = () => { try { return sessionStorage.getItem(GUEST_KEY); } catch { return null; } };
const write = (v: string) => { try { sessionStorage.setItem(GUEST_KEY, v); } catch { /* private mode: fine */ } };

/**
 * Meeting links for everyone: signed-in people go straight in (with the usual password rules);
 * anyone else types a name and an email and joins as a guest, with no account and no password.
 * A guest pass works for one meeting, so a guest who opens a different meeting's link starts over.
 */
export function MeetingGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
  const { id, code } = useParams();
  const location = useLocation();
  const meeting = code ?? id ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // a guest from another meeting: drop that pass and show the form for this one
  const otherMeetingGuest = !!user?.isAnonymous && read() !== meeting;
  useEffect(() => { if (otherMeetingGuest) void signOut(); }, [otherMeetingGuest, signOut]);

  if (isLoading || otherMeetingGuest) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (isAuthenticated && user) {
    if (user.mustChangePassword) return <Navigate to="/app/change-password" replace />;
    return children;
  }

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Type your name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Type a valid email address.");
    setBusy(true);
    try {
      write(meeting);
      await signIn("meeting-guest", { meeting, name: name.trim(), email: email.trim() });
    } catch (err) {
      const text = String((err as { data?: unknown })?.data ?? (err as Error)?.message ?? "");
      setError(text && !text.includes("Server Error") ? text.replace(/^.*Uncaught ConvexError: /, "").split("\n")[0] : "Could not join. Check the link and try again.");
      setBusy(false);
    }
  };

  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={join} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm" noValidate>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Video className="size-5" /></span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Join the meeting</h1>
            <p className="text-sm text-muted-foreground">No Shine account needed.</p>
          </div>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Your name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" autoFocus required />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Your email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" required />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Join meeting"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Others in the meeting see your name. Have a Shine account?{" "}
          <Link className="font-medium text-primary underline-offset-2 hover:underline" to={`/auth?returnTo=${returnTo}`}>Sign in</Link>
        </p>
      </form>
    </main>
  );
}
