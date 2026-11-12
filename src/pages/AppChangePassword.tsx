import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShineLogo } from "@/components/ShineLogo";
import { useMutation } from "convex/react";
import { KeyRound, Loader2, Lock, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

export function AppChangePassword() {
  const navigate = useNavigate();
  const setMyPassword = useMutation(api.passwords.setMyPassword);
  const setMyPasswordWithCode = useMutation(api.passwords.setMyPasswordWithCode);
  const resendMyTempPassword = useMutation(api.passwords.resendMyTempPassword);
  const requestTempAuthCode = useMutation(api.passwords.requestTempAuthCode);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [helpBusy, setHelpBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (next !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (codeMode) {
        await setMyPasswordWithCode({ code, newPassword: next });
      } else {
        await setMyPassword({ currentPassword: current, newPassword: next });
      }
      toast.success("Password updated — welcome to SHINE");
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? errorMessage(err) : "Failed to update password");
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setHelpBusy(true);
    try {
      const res = await resendMyTempPassword();
      if (res.emailSent) {
        toast.success("A new temporary password has been emailed to you.");
      } else {
        toast.error("Email delivery failed — contact your administrator.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Failed to resend");
    } finally {
      setHelpBusy(false);
    }
  };

  const handleSendCode = async () => {
    setHelpBusy(true);
    try {
      const res = await requestTempAuthCode();
      setCodeSent(true);
      setCodeMode(true);
      setCode("");
      if (res.emailSent) {
        toast.success("A 6-digit verification code has been emailed to you.");
      } else {
        toast.error("Email delivery failed — contact your administrator.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? errorMessage(err) : "Failed to send code");
    } finally {
      setHelpBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <ShineLogo className="size-12" />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Set a new password
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your administrator issued a temporary password. For security you must create your own
              before continuing.
            </p>
          </div>
        </div>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="size-4 text-primary" /> Password compliance
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Minimum 8 characters · the last 5 passwords can never be reused · never share your
              password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4">
              {codeMode ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="code" className="text-xs text-muted-foreground">
                    Verification code
                  </Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code from your email"
                  />
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="current" className="text-xs text-muted-foreground">
                    Temporary password
                  </Label>
                  <Input
                    id="current"
                    type="password"
                    required
                    autoFocus
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    placeholder="The password sent to your email"
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="next" className="text-xs text-muted-foreground">
                  New password
                </Label>
                <Input
                  id="next"
                  type="password"
                  required
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="Create a new password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirm" className="text-xs text-muted-foreground">
                  Confirm new password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat the new password"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="h-11 w-full gap-2" disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                Update password &amp; continue
              </Button>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-primary" />
                Account security is enforced by SHINE's enterprise password policy.
              </div>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                {showHelp ? "Hide help" : "Didn't receive your temporary password?"}
              </button>

              {showHelp && (
                <div className="mt-3 grid gap-2 rounded-xl border border-border/70 bg-accent p-3 text-left">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 justify-start gap-2"
                    disabled={helpBusy}
                    onClick={handleResend}
                  >
                    {helpBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5 text-primary" />
                    )}
                    Resend the temporary password email
                  </Button>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 justify-start gap-2"
                    disabled={helpBusy}
                    onClick={handleSendCode}
                  >
                    {helpBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-primary" />
                    )}
                    Send me a verification code instead
                  </Button>
                  {codeSent && (
                    <p className="text-[11px] text-muted-foreground">
                      Check your inbox — enter the code above in the form and set your new password.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
