import { ShineLogo } from "@/components/ShineLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { dejoiyMailSignInUrl } from "@/lib/embed";
import { Lock, Mail, MessageSquareText, ShieldCheck, Video } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/app") {
  return returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : fallback;
}

/**
 * Shine sign-in. Accounts live in Dejoiy Mail (Zimbra), so the only way in is
 * "Continue with Dejoiy Mail": mail.dejoiy.com signs the person in (or asks
 * for their mailbox password) and sends them back here signed in.
 */
export default function AuthPage({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
                Use your Dejoiy Mail account. If you're already signed in to your inbox, you go straight in.
              </p>
              <Button asChild size="lg" className="mt-7 w-full">
                <a href={dejoiyMailSignInUrl(redirect)}>
                  <Mail className="size-4" /> Continue with Dejoiy Mail
                </a>
              </Button>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="size-3.5 text-primary" />
                Your password is checked by Dejoiy Mail. Shine never sees it.
              </p>
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              No mailbox yet? Ask your company admin to create one in Dejoiy Mail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
