import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShineLogo } from "@/components/ShineLogo";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Mandatory policy acknowledgement gate.
 *
 * Rendered on top of the app shell. While any mandatory published policy has
 * not been acknowledged at its current version, the user cannot continue
 * using the application — the overlay blocks the whole workspace.
 */
export function PolicyAckGate() {
  const pending = useQuery(api.policies.pendingAcks);
  const acknowledge = useMutation(api.policies.acknowledgePolicy);
  const [open, setOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!pending) return null;
  if (pending.length === 0) return null;

  const current = pending.find((p) => String(p._id) === open) ?? null;

  const doAck = async (policyId: string) => {
    setBusyId(policyId);
    try {
      await acknowledge({
        policyId: policyId as any,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      toast.success("Policy acknowledged");
      setOpen(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to acknowledge");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-background">
      {/* ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <ShineLogo className="size-14" />
          <div>
            <h1 className="flex items-center justify-center gap-2 text-xl font-semibold tracking-tight">
              <Lock className="size-5 text-primary" />
              Required acknowledgements
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              DEJOIY India Private Limited has published mandatory policies. Please review and
              acknowledge each one before continuing to use SHINE.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {pending.map((p) => (
            <div
              key={p._id}
              className="glass-strong hairline flex items-center gap-4 rounded-2xl p-4"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                <FileText className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border border-border/70 px-1.5 py-px">
                    {p.category ?? "Policy"}
                  </span>
                  <span>Version {p.currentVersion}</span>
                  {p.version?.effectiveAt && (
                    <span>· effective {new Date(p.version.effectiveAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={busyId === String(p._id)}
                onClick={() => setOpen(String(p._id))}
              >
                {busyId === String(p._id) ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                Review &amp; acknowledge
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-primary" />
          {pending.length} policy{pending.length > 1 ? "ies" : "y"} pending — you'll be let in once
          all are acknowledged.
        </p>
      </div>

      {/* Policy reader dialog */}
      {current && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div
            className="glass-strong hairline w-full max-w-2xl rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              SHINE · DEJOIY INDIA PRIVATE LIMITED · Version {current.currentVersion}
            </div>
            <h2 className="text-lg font-semibold">{current.title}</h2>
            {current.version?.summary && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {current.version.summary}
              </p>
            )}
            <ScrollArea className="mt-4 max-h-[40vh] rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="space-y-3 text-sm leading-6 text-foreground/90">
                {(current.version?.content ?? "").split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
                Back
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={busyId === String(current._id)}
                onClick={() => doAck(String(current._id))}
              >
                {busyId === String(current._id) ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                I acknowledge
              </Button>
            </div>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Your acknowledgement is recorded permanently with timestamp and device information.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
