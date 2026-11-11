import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePresenceActions } from "@/hooks/use-presence-heartbeat";
import { PRESENCE_CHOICES, STATUS_PRESETS, presenceLabel, type PresenceChoice, type PresenceLike } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronRight, LogOut, Settings, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { _id: string; name?: string | null; email?: string | null; image?: string | null; customStatus?: string | null; presenceChoice?: string | null } | null;
  presence: PresenceLike | null;
  isAdmin: boolean;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}

/**
 * Your profile sheet (tap your picture): your written status, like WhatsApp's,
 * and how you show up, like Gmail's. Both show in Shine and in Dejoiy Mail.
 */
export function StatusSheet({ open, onOpenChange, user, presence, isAdmin, onNavigate, onSignOut }: Props) {
  const mobile = useIsMobile();
  const { setChoice, setStatusText } = usePresenceActions();
  const [text, setText] = useState(user?.customStatus ?? "");
  const [saving, setSaving] = useState(false);
  const choice = (user?.presenceChoice as PresenceChoice | undefined) ?? "auto";
  useEffect(() => {
    if (open) setText(user?.customStatus ?? "");
  }, [open, user?.customStatus]);

  const saveText = async (value: string) => {
    setSaving(true);
    try {
      await setStatusText(value);
      setText(value);
      toast.success(value ? "Status updated" : "Status cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your status");
    }
    setSaving(false);
  };
  const go = (to: string) => {
    onOpenChange(false);
    onNavigate(to);
  };
  const changed = text.trim() !== (user?.customStatus ?? "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        onOpenAutoFocus={(e) => e.preventDefault() /* no keyboard popping up on phones */}
        className={cn("flex flex-col gap-0 overflow-y-auto p-0", mobile ? "max-h-[92dvh] rounded-t-[28px]" : "w-[380px] sm:max-w-[380px]")}
      >
        {mobile && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />}
        <SheetHeader className="flex-row items-center gap-3.5 space-y-0 px-5 pb-4 pt-4 text-left">
          <UserAvatar user={user ?? undefined} presence={presence} size="xl" showStatus />
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg font-extrabold">{user?.name ?? "You"}</SheetTitle>
            <SheetDescription className="truncate text-[13px]">{user?.email}</SheetDescription>
            <div className="mt-0.5 text-[13px] font-semibold text-foreground">{presenceLabel(presence)}</div>
          </div>
        </SheetHeader>

        {/* written status */}
        <section className="border-t border-border/70 px-5 py-4" aria-labelledby="status-h">
          <h3 id="status-h" className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Status
          </h3>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveText(text.trim());
            }}
          >
            <div className="relative flex-1">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 140))}
                placeholder="What's your status?"
                aria-label="Your status"
                className="h-11 rounded-full pr-9"
                maxLength={140}
              />
              {text && (
                <button
                  type="button"
                  onClick={() => (user?.customStatus ? void saveText("") : setText(""))}
                  className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent"
                  aria-label="Clear status"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button type="submit" className="h-11 rounded-full px-5" disabled={saving || !changed}>
              Save
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => void saveText(p)}
                className={cn(
                  "rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                  user?.customStatus === p ? "border-[var(--sticker-border)] bg-accent font-bold" : "border-border hover:bg-accent",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">Colleagues see it in Shine and in Dejoiy Mail.</p>
        </section>

        {/* presence */}
        <section className="border-t border-border/70 px-2 py-3" aria-labelledby="presence-h">
          <h3 id="presence-h" className="mb-1 px-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
            Show me as
          </h3>
          <div role="radiogroup" aria-labelledby="presence-h">
            {PRESENCE_CHOICES.map((o) => (
              <button
                key={o.value}
                role="radio"
                aria-checked={choice === o.value}
                onClick={() => setChoice(o.value).catch(() => toast.error("Couldn't change that"))}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className={cn("size-3 shrink-0 rounded-full", o.dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
                {choice === o.value && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </div>
        </section>

        <nav className="border-t border-border/70 px-2 py-2" aria-label="Account">
          {[
            { to: "/app/settings", icon: Settings, label: "Settings" },
            { to: "/app/organizations", icon: Building2, label: "Organizations" },
            ...(isAdmin ? [{ to: "/app/admin", icon: ShieldCheck, label: "Admin console" }] : []),
          ].map((l) => (
            <button key={l.to} onClick={() => go(l.to)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[15px] hover:bg-accent">
              <l.icon className="size-5 text-muted-foreground" />
              <span className="flex-1 text-left">{l.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
          <button
            onClick={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[15px] text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-5" /> Sign out
          </button>
        </nav>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </SheetContent>
    </Sheet>
  );
}
