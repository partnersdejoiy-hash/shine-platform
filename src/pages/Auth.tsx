import { ShineLogo } from "@/components/ShineLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { dejoiyMailSignInUrl } from "@/lib/embed";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquareText, ShieldCheck, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate, useSearchParams } from "react-router";
import { errorMessage } from "@/lib/errors";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/app") {
  return returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : fallback;
}

/**
 * Shine sign-in. Accounts live in Dejoiy Mail (Zimbra), so the only way in is
 * "Continue with Dejoiy Mail" (mail.dejoiy.com signs the person in and sends
 * them back), or the same email + password as the mailbox, typed right here
 * and checked by Dejoiy Mail.
 */
export default function AuthPage({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading, isAuthenticated, signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter your full Dejoiy Mail address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError(null);
    try {
      // Dejoiy Mail accounts first; companies on Shine alone have their own Shine password
      await signIn("dejoiy-mail-password", { email: email.trim(), password }).catch(async (mailErr) => {
        await signIn("password", { email: email.trim().toLowerCase(), password }).catch(() => {
          throw mailErr;
        });
      });
      navigate(redirect);
    } catch (err) {
      const raw = err instanceof Error ? errorMessage(err) : "";
      setError(raw.replace(/^.*Uncaught Error:\s*/s, "").split("\n")[0].replace(/\s*at .*$/, "") || "Could not sign you in. Try again.");
      setBusy(false);
    }
  };
  const navigate = useNavigate();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(redirect);
  }, [isLoading, isAuthenticated, navigate, redirect]);

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row">
        <div className="hidden flex-1 flex-col justify-center px-8 py-16 lg:flex xl:px-14">
          <ShineLogo size={44} />
          <h1 className="mt-12 max-w-md text-5xl font-extrabold leading-[1.02] tracking-[-0.04em]">
            One login to your <span className="gold-text">entire workspace.</span>
          </h1>
          <p className="mt-4 max-w-md leading-7 text-muted-foreground">
            Messages, calls, meetings, files and tasks, signed in with the same account as your Dejoiy Mail inbox.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: MessageSquareText, t: "Realtime messaging", d: "Presence, read receipts, threads and replies" },
              { icon: Video, t: "Calls & meetings", d: "Audio, video and screen sharing" },
              { icon: ShieldCheck, t: "Your mail account", d: "Admins and access come from Dejoiy Mail" },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl border-2 border-[var(--sticker-border)] bg-primary text-primary-foreground">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{f.t}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-12 lg:py-0">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <ShineLogo size={44} />
            </div>
            <div className="rounded-[28px] border-2 border-[var(--sticker-border)] bg-card p-8 shadow-[6px_6px_0_var(--sticker-shadow)] sm:p-9">
              <h2 className="text-3xl font-extrabold tracking-[-0.04em]">Sign in to Shine</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use your Dejoiy Mail account: the same email and password as your inbox.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Email</span>
                  <Input
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl text-base"
                    disabled={busy}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Password</span>
                  <span className="relative block">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your Dejoiy Mail password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-2xl pr-12 text-base"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                </label>
                {error && (
                  <p role="alert" className="rounded-2xl border-[1.5px] border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Sign in
                </Button>
              </form>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href={dejoiyMailSignInUrl(redirect)}>
                  <Mail className="size-4" /> Continue with Dejoiy Mail
                </a>
              </Button>
              <p className="mt-5 text-xs text-muted-foreground">
                Dejoiy Mail passwords are checked by Dejoiy Mail and never stored in Shine. Forgot it? Reset it from{" "}
                <a href="https://mail.dejoiy.com" className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
                  Dejoiy Mail
                </a>
                .
              </p>
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              No mailbox yet? Ask your company admin to create one in Dejoiy Mail.
            </p>
            <ShineSignup open={searchParams.get("signup") === "1"} onDone={async (em, pw) => {
              await signIn("password", { email: em, password: pw });
              navigate("/app/settings?tab=billing");
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A company without Dejoiy Mail starts Shine on its own: work email, password, then the emailed code. */
function ShineSignup({ open: startOpen, onDone }: { open: boolean; onDone: (email: string, password: string) => Promise<void> }) {
  const start = useMutation(api.shineOnly.startSignup);
  const finish = useMutation(api.shineOnly.finishSignup);
  const [open, setOpen] = useState(startOpen);
  const [step, setStep] = useState<"form" | "code">("form");
  const [f, setF] = useState({ name: "", company: "", email: "", password: "", code: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = (e: unknown) => (e instanceof Error ? errorMessage(e) : "").replace(/^.*Uncaught (Convex)?Error:\s*/s, "").split("\n")[0] || "Something went wrong. Try again.";
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "form") {
        await start({ name: f.name, company: f.company, email: f.email, password: f.password });
        setStep("code");
      } else {
        await finish({ email: f.email, code: f.code });
        await onDone(f.email.trim().toLowerCase(), f.password);
      }
    } catch (err) {
      setError(clean(err));
    } finally {
      setBusy(false);
    }
  };
  const field = (key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold">{label}</span>
      <Input {...props} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="h-12 rounded-2xl text-base" disabled={busy} />
    </label>
  );
  if (!open)
    return (
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Want Shine without Dejoiy Mail?{" "}
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
          Start Shine for your company
        </button>{" "}
        · ₹29 a person a month, 11 days free
      </p>
    );
  return (
    <div className="mt-6 rounded-[28px] border-2 border-[var(--sticker-border)] bg-card p-8 shadow-[6px_6px_0_var(--sticker-shadow)] sm:p-9">
      <h2 className="text-2xl font-extrabold tracking-[-0.04em]">Start Shine for your company</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Shine on its own, without Dejoiy Mail: 11 days free, then ₹29 a person a month (+GST). Use your work email; colleagues join
        with the same domain.
      </p>
      <form onSubmit={go} className="mt-6 space-y-3" noValidate>
        {step === "form" ? (
          <>
            {field("name", "Your name", { autoComplete: "name", placeholder: "Priya Nair" })}
            {field("company", "Company", { autoComplete: "organization", placeholder: "Acme Pvt Ltd" })}
            {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email", placeholder: "priya@acme.in" })}
            {field("password", "Choose a password", { type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" })}
          </>
        ) : (
          <>
            <p className="text-sm">We sent a 6-digit code to <b>{f.email}</b>. It works for 30 minutes.</p>
            {field("code", "Code", { inputMode: "numeric", autoComplete: "one-time-code", placeholder: "123456", maxLength: 6 })}
          </>
        )}
        {error && (
          <p role="alert" className="rounded-2xl border-[1.5px] border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {step === "form" ? "Send me the code" : "Create my Shine"}
        </Button>
        {step === "code" && (
          <button type="button" className="w-full text-xs font-semibold text-muted-foreground hover:underline" onClick={() => setStep("form")}>
            Change details
          </button>
        )}
      </form>
    </div>
  );
}
