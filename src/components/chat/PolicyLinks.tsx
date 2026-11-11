import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Download, Loader2, Printer, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Policy = {
  _id: string;
  title: string;
  category?: string;
  mandatory: boolean;
  currentVersion: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  version: { summary?: string; content?: string; effectiveAt?: number } | null;
};

const sectionize = (content?: string | null): string[] =>
  (content ?? "").split("\n\n").filter(Boolean);

export function PolicyLinks() {
  const policies = useQuery(api.policies.publishedPolicies);
  const acknowledge = useMutation(api.policies.acknowledgePolicy);
  const [open, setOpen] = useState<Policy | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const filteredDoc = useMemo(() => {
    if (!open) return [] as string[];
    const sections = sectionize(open.version?.content);
    if (!q.trim()) return sections;
    const needle = q.toLowerCase();
    return sections.filter((p) => p.toLowerCase().includes(needle));
  }, [open, q]);

  const doAck = async (p: Policy) => {
    setBusy(true);
    try {
      await acknowledge({ policyId: p._id as any, userAgent: navigator.userAgent });
      toast.success(`"${p.title}" acknowledged`);
      setOpen(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to acknowledge");
    } finally {
      setBusy(false);
    }
  };

  const downloadCopy = () => {
    if (!open) return;
    const text = `${open.title}\nVersion ${open.currentVersion}\nDEJOIY India Private Limited\n\n${
      open.version?.summary ?? ""
    }\n\n${(open.version?.content ?? "").replace(/\n\n/g, "\n")}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${open.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v${open.currentVersion}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* policy footer — bottom of the messaging app */}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/70 bg-card px-4 py-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          © {new Date().getFullYear()} DEJOIY India Private Limited · Powered by SHINE
        </span>
        <span className="hidden h-3 w-px bg-border/70 sm:block" />
        {!policies
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))
          : policies.map((p) => (
              <button
                key={p._id}
                onClick={() => {
                  setOpen(p);
                  setQ("");
                }}
                className="text-[11px] text-muted-foreground underline decoration-border/60 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary/60"
              >
                {p.title}
              </button>
            ))}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" /> {open.title}
                  {open.mandatory && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                      Mandatory
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Version {open.currentVersion} · DEJOIY India Private Limited
                  {open.version?.effectiveAt
                    ? ` · effective ${new Date(open.version.effectiveAt).toLocaleDateString()}`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search within this policy…"
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <ScrollArea className="max-h-[45vh] rounded-xl border border-border/70 bg-card p-4">
                <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                  {open.version?.summary && (
                    <p className="text-foreground/90">{open.version.summary}</p>
                  )}
                  {filteredDoc.length === 0 ? (
                    <p className="py-6 text-center text-xs">
                      {q.trim() ? `No sections match “${q}”.` : "No content published for this version yet."}
                    </p>
                  ) : (
                    filteredDoc.map((para, i) => <p key={i}>{para}</p>)
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="flex-wrap gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="size-3.5" /> Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadCopy}>
                    <Download className="size-3.5" /> Download copy
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
                    Close
                  </Button>
                  {open.acknowledged ? (
                    <Button size="sm" disabled className="gap-1.5">
                      <CheckCircle2 className="size-3.5" /> Acknowledged
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => doAck(open)}
                      className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      I acknowledge
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
