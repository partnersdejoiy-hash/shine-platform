import { ShineLogo } from "@/components/ShineLogo";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { dejoiyMailSignInUrl } from "@/lib/embed";
import { useMailSignInFromApp } from "@/pages/MeetHome";
import { ArrowRight, Loader2, Mail, Phone, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router";

const GUEST_KEY = "shine-guest-for";
const read = () => { try { return sessionStorage.getItem(GUEST_KEY); } catch { return null; } };
const write = (v: string) => { try { sessionStorage.setItem(GUEST_KEY, v); } catch { /* private mode: fine */ } };

/**
 * Meeting links for everyone: signed-in people go straight in (with the usual password rules);
 * anyone else types a name, an email and a phone number and joins as a guest, with no account
 * and no password. The meeting chat shows those details to the people in the meeting.
 * A guest pass works for one meeting, so a guest who opens a different meeting's link starts over.
 */
export function MeetingGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
  const { id, code } = useParams();
  const location = useLocation();
  const meeting = code ?? id ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // a guest from another meeting: drop that pass and show the form for this one
  const otherMeetingGuest = !!user?.isAnonymous && read() !== meeting;
  useEffect(() => { if (otherMeetingGuest) void signOut(); }, [otherMeetingGuest, signOut]);
  // arriving from the Shine app (?sso=1): sign in through Dejoiy Mail instead of asking
  useMailSignInFromApp(isLoading, isAuthenticated && !otherMeetingGuest, location.pathname);
  const fromApp = new URLSearchParams(location.search).get("sso") === "1";

  if (isLoading || otherMeetingGuest || (fromApp && !isAuthenticated)) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
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
    if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s().-]/g, ""))) return setError("Type a valid phone number, e.g. +91 98765 43210.");
    setBusy(true);
    try {
      write(meeting);
      await signIn("meeting-guest", { meeting, name: name.trim(), email: email.trim(), phone: phone.trim() });
    } catch (err) {
      const text = String((err as { data?: unknown })?.data ?? (err as Error)?.message ?? "");
      setError(text && !text.includes("Server Error") ? text.replace(/^.*Uncaught ConvexError: /, "").split("\n")[0] : "Could not join. Check the link and try again.");
      setBusy(false);
    }
  };

  const field = "h-12 border-2 border-[#121212] bg-[#fffbf7] pl-10 text-base";
  return (
    <main className="relative flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center gap-2.5 px-4 sm:px-8">
        <ShineLogo className="size-9" showWordmark={false} />
        <span className="text-lg font-extrabold tracking-tight">
          SHINE <span className="rounded-md bg-[#ff4fa3] px-1.5 text-[#121212]">Meet</span>
        </span>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <form onSubmit={join} className="sticker w-full max-w-md space-y-5 rounded-3xl bg-card p-6 sm:p-8" noValidate>
          <div>
            <span className="sticker-pop inline-block -rotate-2 rounded-full bg-[#ffd23f] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#121212]">
              You're invited
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-4xl">
              Hop into <span className="gold-text">the call.</span>
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              No Shine account needed. People in the meeting see your name, and your email and phone appear in the meeting chat so the host can reach you.
            </p>
          </div>
          <div className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Your name</span>
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" placeholder="Your name" autoFocus required />
            </label>
            <label className="relative block">
              <span className="sr-only">Your email</span>
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" placeholder="you@company.com" required />
            </label>
            <label className="relative block">
              <span className="sr-only">Your phone number</span>
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className={field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="+91 98765 43210" required />
            </label>
          </div>
          {error && <p role="alert" className="rounded-xl border-2 border-[#d4183d] bg-[#ffe3e8] px-3 py-2 text-sm font-semibold text-[#9b1030]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="sticker-pop flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff4fa3] text-base font-extrabold text-[#121212] transition-transform hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <>Join meeting <ArrowRight className="size-5" /></>}
          </button>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span className="h-0.5 flex-1 bg-border" /> or <span className="h-0.5 flex-1 bg-border" />
          </div>
          <a
            href={dejoiyMailSignInUrl(`${location.pathname}${location.search}`)}
            className="sticker flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#121212] text-sm font-bold text-[#fbf3f8] transition-transform hover:-translate-y-0.5"
          >
            <Mail className="size-4" /> Continue with Dejoiy Mail
          </a>
        </form>
      </div>
    </main>
  );
}
