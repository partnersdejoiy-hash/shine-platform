import { api } from "@/convex/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ShineLogo } from "@/components/ShineLogo";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errors";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Video,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@/convex/react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/app",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const providerStatus = useQuery(api.users.authProviderStatus);
  const resendTempPassword = useMutation(api.passwords.resendTempPasswordByEmail);
  const requestResetCode = useMutation(api.passwords.requestPasswordResetCode);
  const resetPasswordWithCode = useMutation(api.passwords.resetPasswordWithCode);
  const createPasswordTicket = useMutation(api.tickets.createPasswordTicket);
  const navigate = useNavigate();
  const pwEmailRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- password reset (auth page) ----
  const [resetOpen, setResetOpen] = useState(false);
  const [resetMethod, setResetMethod] = useState<"temp" | "otp" | "ticket" | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [resetNewPw, setResetNewPw] = useState("");
  const [resetConfirmPw, setResetConfirmPw] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetDone, setResetDone] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("password", {
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      });
      navigate(redirect);
    } catch (error) {
      console.error("Password sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Invalid email or password. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const currentEmail = () => pwEmailRef.current?.value.trim() ?? "";

  const handleResendTemp = async () => {
    const email = currentEmail();
    if (!email) {
      toast.error("Enter your email above, then tap resend.");
      return;
    }
    setResetBusy(true);
    try {
      await resendTempPassword({ email });
      setResetDone(
        "If an account exists for that email, a new temporary password has been emailed — check spam too. Sign in with it, then set your own password.",
      );
    } catch (err) {
      toast.error(getFriendlyError(err) || "Could not resend. Try the verification-code option instead.");
    } finally {
      setResetBusy(false);
    }
  };

  const handleRequestResetCode = async () => {
    const email = currentEmail();
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    setResetBusy(true);
    try {
      await requestResetCode({ email });
      setResetDone(
        "If an account exists for that email, a 6-digit code is on its way — enter it below with your new password.",
      );
    } catch (err) {
      toast.error(getFriendlyError(err) || "Could not send the code");
    } finally {
      setResetBusy(false);
    }
  };

  const handleResetWithCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = currentEmail();
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    if (resetNewPw.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (resetNewPw !== resetConfirmPw) {
      toast.error("The two passwords do not match.");
      return;
    }
    setResetBusy(true);
    try {
      await resetPasswordWithCode({ email, code: resetCode, newPassword: resetNewPw });
      setResetDone("Password updated successfully — sign in with your new password.");
      setResetCode("");
      setResetNewPw("");
      setResetConfirmPw("");
      setResetMethod(null);
      setResetOpen(false);
      toast.success("Password updated — sign in with your new password");
      setMode("otp");
    } catch (err) {
      toast.error(getFriendlyError(err) || "Failed to reset password");
    } finally {
      setResetBusy(false);
    }
  };

  const handleRaiseTicket = async () => {
    const email = currentEmail();
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    setResetBusy(true);
    try {
      await createPasswordTicket({ email });
      setResetDone(
        "Your password-recovery ticket has been raised with the IT & admin department. A tagged staff member will email you a temporary password — check your inbox (and spam) shortly.",
      );
    } catch (err) {
      toast.error(getFriendlyError(err) || "Could not raise the ticket");
    } finally {
      setResetBusy(false);
    }
  };

  const handleSso = async (provider: string, configured: boolean | undefined) => {
    if (configured === false || configured === undefined) {
      const keyNames =
        provider === "google"
          ? "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET"
          : provider === "microsoft-entra-id"
            ? "AUTH_MICROSOFT_ENTRA_ID_ID + AUTH_MICROSOFT_ENTRA_ID_SECRET"
            : provider === "github"
              ? "AUTH_GITHUB_ID + AUTH_GITHUB_SECRET"
              : "AUTH_APPLE_ID + AUTH_APPLE_SECRET";
      toast.info(
        `${provider === "google" ? "Google" : provider === "microsoft-entra-id" ? "Microsoft" : provider === "github" ? "GitHub" : "Apple"} SSO is not configured yet. Add ${keyNames} in the project's Keys tab and it activates automatically. Email + password or OTP work right now.`,
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signIn(provider, { redirectTo: redirect });
    } catch (error) {
      console.error(`${provider} sign-in error:`, error);
      setError(
        error instanceof Error
          ? error.message
          : `Failed to sign in with ${provider}. Verify its keys are configured.`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* ambient background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-[480px] w-[720px] rounded-full bg-[radial-gradient(ellipse,rgba(212,175,55,0.1),transparent_65%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.06),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        {/* Brand panel */}
        <div className="hidden flex-1 flex-col justify-center px-8 py-16 lg:flex xl:px-14">
          <ShineLogo size={44} />
          <h1 className="mt-12 max-w-md text-4xl font-bold leading-tight tracking-tight">
            One login to your <span className="gold-text">entire workspace.</span>
          </h1>
          <p className="mt-4 max-w-md leading-7 text-muted-foreground">
            Messages, calls, meetings, files, tasks and Shine AI — securely connected
            across every device you own.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: MessageSquareText, t: "Realtime messaging", d: "Presence, read receipts, threads and AI replies" },
              { icon: Video, t: "HD calls & meetings", d: "WebRTC-encrypted audio, video and screen sharing" },
              { icon: ShieldCheck, t: "Enterprise security", d: "SSO, device trust, audit logs and encryption" },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{f.t}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-primary" />
            SOC 2 aligned · Encrypted in transit and at rest
          </div>
        </div>

        {/* Auth card */}
        <div className="flex flex-1 items-center justify-center px-4 py-12 lg:py-0">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <ShineLogo size={40} />
            </div>

            <div className="glass-strong hairline relative rounded-3xl p-8 shadow-2xl sm:p-9">
              {step === "signIn" ? (
                mode === "otp" ? (
                <>
                  <div className="mb-7">
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-medium text-primary">
                      <Sparkles className="size-3" /> Welcome to SHINE
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Get started</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Sign in with your email — we'll send you a one-time code.
                    </p>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@company.com"
                        type="email"
                        autoComplete="email"
                        className="h-12 pl-10"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    {error && (
                      <p className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.6)]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          Continue with email <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <SsoButton
                      label="Google"
                      icon={<GoogleIcon />}
                      configured={providerStatus?.google}
                      disabled={isLoading}
                      onClick={() => handleSso("google", providerStatus?.google)}
                    />
                    <SsoButton
                      label="Microsoft"
                      icon={<MicrosoftIcon />}
                      configured={providerStatus?.microsoft}
                      disabled={isLoading}
                      onClick={() => handleSso("microsoft-entra-id", providerStatus?.microsoft)}
                    />
                    <SsoButton
                      label="GitHub"
                      icon={<GitHubIcon />}
                      configured={providerStatus?.github}
                      disabled={isLoading}
                      onClick={() => handleSso("github", providerStatus?.github)}
                    />
                    <SsoButton
                      label="Apple"
                      icon={<AppleIcon />}
                      configured={providerStatus?.apple}
                      disabled={isLoading}
                      onClick={() => handleSso("apple", providerStatus?.apple)}
                    />
                  </div>

                  <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 h-11 w-full gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => {
                      setMode("password");
                      setError(null);
                    }}
                    disabled={isLoading}
                  >
                    <KeyRound className="size-4" />
                    Sign in with password instead
                  </Button>

                  <div className="mt-6 rounded-xl border border-border/70 bg-background/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">Single sign-on (SSO)</div>
                      <ShieldCheck className="size-4 text-primary" />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                      {providerStatus &&
                      Object.values({
                        Google: providerStatus.google,
                        Microsoft: providerStatus.microsoft,
                        GitHub: providerStatus.github,
                        Apple: providerStatus.apple,
                      }).some(Boolean) ? (
                        <>
                          Configured providers are live. Add the matching{" "}
                          <code className="rounded bg-accent px-1 py-0.5 font-mono text-[10px]">AUTH_*_ID</code>{" "}
                          &amp;{" "}
                          <code className="rounded bg-accent px-1 py-0.5 font-mono text-[10px]">AUTH_*_SECRET</code>{" "}
                          keys in the Keys tab to enable the rest.
                        </>
                      ) : providerStatus ? (
                        <>
                          Add provider keys in the Keys tab — e.g.{" "}
                          <code className="rounded bg-accent px-1 py-0.5 font-mono text-[10px]">AUTH_GOOGLE_ID</code>{" "}
                          &amp;{" "}
                          <code className="rounded bg-accent px-1 py-0.5 font-mono text-[10px]">AUTH_GOOGLE_SECRET</code>{" "}
                          — and the SSO buttons activate automatically.
                        </>
                      ) : (
                        "OAuth buttons activate once provider keys are added."
                      )}
                    </p>
                  </div>
                </>
                ) : (
                  <>
                    <div className="mb-7">
                      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-medium text-primary">
                        <KeyRound className="size-3" /> SHINE password
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Sign in with your SHINE password — every employee can use
                        email + password.
                      </p>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          ref={pwEmailRef}
                          name="email"
                          placeholder="name@company.com"
                          type="email"
                          autoComplete="email"
                          className="h-12 pl-10"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          name="password"
                          placeholder="Password"
                          type="password"
                          autoComplete="current-password"
                          className="h-12 pl-10"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                          disabled={isLoading || resetBusy}
                          onClick={() => {
                            setResetOpen((v) => !v);
                            setResetDone(null);
                            setResetMethod(null);
                            setError(null);
                          }}
                        >
                          Forgot your password?
                        </button>
                      </div>
                      {resetOpen && (
                        <div className="rounded-xl border border-border/70 bg-background/50 p-3.5">
                          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold">
                            <LifeBuoy className="size-3.5 text-primary" />
                            Reset your password
                          </div>
                          {resetDone ? (
                            <div className="space-y-2">
                              <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-xs leading-5 text-foreground/90">
                                {resetDone}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 w-full text-xs"
                                onClick={() => {
                                  setResetDone(null);
                                  setResetOpen(false);
                                  setMode("otp");
                                }}
                              >
                                Back to sign in
                              </Button>
                            </div>
                          ) : resetMethod === null ? (
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 rounded-lg border border-border/80 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                                disabled={resetBusy}
                                onClick={() => setResetMethod("temp")}
                              >
                                <RefreshCw className="size-3.5 shrink-0 text-primary" />
                                <span>
                                  <span className="block font-medium text-foreground">Send me a temporary password</span>
                                  <span className="block text-[10px] text-muted-foreground">A fresh temp password is emailed — you'll set your own on first login.</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 rounded-lg border border-border/80 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                                disabled={resetBusy}
                                onClick={() => setResetMethod("otp")}
                              >
                                <Mail className="size-3.5 shrink-0 text-primary" />
                                <span>
                                  <span className="block font-medium text-foreground">Send me a verification code</span>
                                  <span className="block text-[10px] text-muted-foreground">A 6-digit code is emailed — reset your password with it directly.</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2.5 rounded-lg border border-border/80 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                                disabled={resetBusy}
                                onClick={() => setResetMethod("ticket")}
                              >
                                <Ticket className="size-3.5 shrink-0 text-primary" />
                                <span>
                                  <span className="block font-medium text-foreground">Raise a ticket for your password</span>
                                  <span className="block text-[10px] text-muted-foreground">A DJT ticket goes to the IT & admin department — they'll send you a temp password.</span>
                                </span>
                              </button>
                            </div>
                          ) : resetMethod === "temp" ? (
                            <div className="space-y-2">
                              <p className="text-[11px] leading-5 text-muted-foreground">
                                We'll email a new temporary password to your address. You'll be asked to
                                create your own on first login.
                              </p>
                              <Button
                                type="button"
                                className="h-9 w-full gap-1.5 text-xs"
                                disabled={resetBusy}
                                onClick={handleResendTemp}
                              >
                                {resetBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                                Send temporary password
                              </Button>
                              <button
                                type="button"
                                className="w-full text-center text-[11px] text-muted-foreground hover:text-primary"
                                onClick={() => setResetMethod(null)}
                              >
                                ← Back
                              </button>
                            </div>
                          ) : resetMethod === "otp" ? (
                            <div className="space-y-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 w-full gap-1.5 text-xs"
                                disabled={resetBusy}
                                onClick={handleRequestResetCode}
                              >
                                {resetBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                                Send me a verification code
                              </Button>
                              <form onSubmit={handleResetWithCode} className="space-y-2">
                                <Input
                                  value={resetCode}
                                  onChange={(e) => setResetCode(e.target.value)}
                                  placeholder="6-digit code from your email"
                                  className="h-9 text-sm"
                                  required
                                />
                                <Input
                                  value={resetNewPw}
                                  onChange={(e) => setResetNewPw(e.target.value)}
                                  placeholder="New password (8+ characters)"
                                  type="password"
                                  className="h-9 text-sm"
                                  required
                                />
                                <Input
                                  value={resetConfirmPw}
                                  onChange={(e) => setResetConfirmPw(e.target.value)}
                                  placeholder="Repeat the new password"
                                  type="password"
                                  className="h-9 text-sm"
                                  required
                                />
                                <Button
                                  type="submit"
                                  className="h-9 w-full gap-1.5 text-xs"
                                  disabled={resetBusy || !resetCode || !resetNewPw || !resetConfirmPw}
                                >
                                  {resetBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                                  Reset password with code
                                </Button>
                              </form>
                              <button
                                type="button"
                                className="w-full text-center text-[11px] text-muted-foreground hover:text-primary"
                                onClick={() => setResetMethod(null)}
                              >
                                ← Back
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] leading-5 text-muted-foreground">
                                A password-recovery ticket (DJT number) is created for the IT & admin
                                department. Tagged staff can send a temporary password straight to your email.
                              </p>
                              <Button
                                type="button"
                                className="h-9 w-full gap-1.5 text-xs"
                                disabled={resetBusy}
                                onClick={handleRaiseTicket}
                              >
                                {resetBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Ticket className="size-3.5" />}
                                Create password ticket
                              </Button>
                              <button
                                type="button"
                                className="w-full text-center text-[11px] text-muted-foreground hover:text-primary"
                                onClick={() => setResetMethod(null)}
                              >
                                ← Back
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {error && (
                        <p className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                          {error}
                        </p>
                      )}
                      <Button
                        type="submit"
                        className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.6)]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <>
                            Sign in <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </form>

                    <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
                      <span className="h-px flex-1 bg-border" /> or{" "}
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full gap-2"
                      onClick={() => {
                        setMode("otp");
                        setError(null);
                      }}
                      disabled={isLoading}
                    >
                      <Mail className="size-4" />
                      Use email verification code
                    </Button>
                  </>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("signIn");
                      setError(null);
                    }}
                    className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" /> Change email
                  </button>
                  <h2 className="text-2xl font-bold tracking-tight">Check your inbox</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{step.email}</span>
                  </p>

                  <form onSubmit={handleOtpSubmit} className="mt-7 space-y-5">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />
                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) form.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="size-12 rounded-xl border-border text-lg"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-center text-xs text-destructive">
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Verifying…
                        </>
                      ) : (
                        <>
                          Verify & continue <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Didn't get a code?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 text-primary"
                        onClick={() => {
                          setStep("signIn");
                          toast("Resend the code from the email step.");
                        }}
                      >
                        Try again
                      </Button>
                    </p>
                  </form>
                </>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you agree to SHINE's Terms & Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}

function SsoButton({
  label,
  icon,
  onClick,
  configured,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  configured?: boolean;
  disabled?: boolean;
}) {
  const unconfigured = configured === false;
  return (
    <Button
      type="button"
      variant={unconfigured ? "ghost" : "outline"}
      className={cn(
        "h-11 w-full gap-2.5 text-[13px] font-medium transition-all",
        unconfigured && "opacity-70 hover:opacity-100",
      )}
      onClick={onClick}
      disabled={disabled}
      title={unconfigured ? `${label} SSO — add its AUTH_* keys in the Keys tab to enable` : undefined}
    >
      {icon}
      {label}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="size-4 shrink-0" aria-hidden>
      <path fill="#F35325" d="M0 0h11v11H0z" />
      <path fill="#81BC06" d="M12 0h11v11H12z" />
      <path fill="#05A6F0" d="M0 12h11v11H0z" />
      <path fill="#FFBA08" d="M12 12h11v11H12z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
    </svg>
  );
}
