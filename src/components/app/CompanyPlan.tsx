import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CompanyPlan as Plan } from "@/convex/companyPlan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Mail, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { shinePrice } from "@/convex/lib/shinePlan";

const ADMIN_BILLING = "https://admin-mail.dejoiy.com/admin/manage/billing";
const day = (s: number) => new Date(s * 1000).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

/** Settings → Billing: Shine comes with the company's Dejoiy Mail plan, paid in Dejoiy Mail's admin. */
export function CompanyPlan() {
  const shineOnly = useQuery(api.shineOnly.overview);
  if (shineOnly) return <ShineOnlyPlan o={shineOnly} />;
  return <MailPlan />;
}

function MailPlan() {
  const load = useAction(api.companyPlan.mine);
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  useEffect(() => {
    load({}).then(setPlan, () => setPlan(null));
  }, [load]);

  const badge =
    plan?.state === "active" ? `${plan.planName} · ${plan.period === "year" ? "yearly" : "monthly"}`
    : plan?.state === "trial" ? `Free trial · ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"} left`
    : plan?.state === "expired" ? "Ended"
    : plan?.state === "internal" ? "Dejoiy" : null;
  const line =
    plan?.state === "active" ? `Paid until ${day(plan.ends!)}. ${plan.mailboxes == null ? "Unlimited" : `Up to ${plan.mailboxes}`} mailboxes, and Shine for everyone in them.`
    : plan?.state === "trial" ? `The 11-day trial ends ${day(plan.ends!)}. Your company admin picks a plan in Dejoiy Mail Admin.`
    : plan?.state === "expired" ? `Ended on ${day(plan.ends!)}. Your company admin can renew it in Dejoiy Mail Admin.`
    : plan?.state === "internal" ? "One of Dejoiy's own domains: nothing to pay."
    : "Shine comes with a Dejoiy Mail plan for your company's domain. Accounts outside Dejoiy Mail have no plan here.";

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-primary" /> Your plan
          {badge && <Badge className="bg-primary/15 font-semibold text-primary">{badge}</Badge>}
        </CardTitle>
        <CardDescription>
          Shine is part of every Dejoiy Mail plan (Starter, Team, Business) and is not sold on its own. One price for the
          whole company, paid on Dejoiy Pay.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {plan === undefined ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-sm">
            {plan?.domain && <b>{plan.domain}: </b>}
            {line}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <a href={ADMIN_BILLING} target="_blank" rel="noopener">
              Plan &amp; billing in Dejoiy Mail Admin <ExternalLink className="size-3.5" />
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/home#plans">See the plans</a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Only company admins can pay. Everyone else sees the plan here.</p>
      </CardContent>
    </Card>
  );
}

const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errText = (e: unknown) => (e instanceof Error ? errorMessage(e) : "").replace(/^.*Uncaught (Convex)?Error:\s*/s, "").split("\n")[0] || "Something went wrong.";

/** A company on Shine alone: pay per person on Dejoiy Pay, and add colleagues. */
function ShineOnlyPlan({ o }: { o: NonNullable<ReturnType<typeof useOverview>> }) {
  const checkout = useAction(api.shineOnly.checkout);
  const refresh = useAction(api.shineOnly.refresh);
  const invite = useMutation(api.shineOnly.invite);
  const [period, setPeriod] = useState<"month" | "year">("year");
  const [seats, setSeats] = useState(Math.max(o.people, o.seats ?? 0, 1));
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState({ name: "", email: "" });
  const waiting = o.payments.find((p) => p.status === "created");
  // a payment is waiting: ask Dejoiy Pay every 10 seconds for 10 minutes
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(() => (++n > 60 ? clearInterval(t) : refresh({}).then((paid) => paid && toast.success("Payment received. Thank you!"))), 10_000);
    return () => clearInterval(t);
  }, [waiting?.id, refresh]);
  const badge = o.state === "active" ? `Paid · ${o.seats} people` : o.state === "trial" ? `Free trial · ${o.daysLeft} day${o.daysLeft === 1 ? "" : "s"} left` : "Ended";
  const pay = async () => {
    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const { url } = await checkout({ seats, period });
      if (tab) tab.location.href = url;
      else location.href = url;
      toast("Pay in the new tab. This page updates once it's paid.");
    } catch (e) {
      tab?.close();
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invite(who);
      toast.success(`${who.name} is added. Their password is on its way by email.`);
      setWho({ name: "", email: "" });
    } catch (err) {
      toast.error(errText(err));
    }
  };
  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-none">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {o.company} <Badge className="bg-primary/15 font-semibold text-primary">{badge}</Badge>
          </CardTitle>
          <CardDescription>
            Shine on its own: ₹{o.price.month} a person a month, or ₹{o.price.year} a person a year, plus 18% GST. {o.people} {o.people === 1 ? "person" : "people"} on Shine now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {o.state === "active" ? `Paid until ${day(o.ends / 1000)}.` : o.state === "trial" ? `The free trial ends ${day(o.ends / 1000)}; paid time starts after it.` : `Ended on ${day(o.ends / 1000)}.`}
          </p>
          {o.payMode === "test" && o.payReady && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600">Test mode: payments are simulated and no money moves.</p>}
          {waiting && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              A payment of {inr(waiting.amount)} is waiting.
              {waiting.url && <a className="font-semibold underline" href={waiting.url} target="_blank" rel="noopener">Pay on Dejoiy Pay</a>}
            </p>
          )}
          {o.admin ? (
            <div className="space-y-3 rounded-2xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  People
                  <Input type="number" min={o.people} max={5000} value={seats} onChange={(e) => setSeats(Math.max(1, Math.floor(+e.target.value || 1)))} className="h-10 w-24 rounded-xl" />
                </label>
                <div className="inline-flex rounded-full border border-border p-1" role="group" aria-label="Billing period">
                  {(["month", "year"] as const).map((p) => (
                    <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={"rounded-full px-3 py-1.5 text-xs font-semibold " + (period === p ? "bg-foreground text-background" : "text-muted-foreground")}>
                      {p === "month" ? "Monthly" : "Yearly · save 31%"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm">
                <b className="text-xl">{inr(shinePrice(seats, period))}</b> a {period} for {seats} {seats === 1 ? "person" : "people"}, GST included.
              </p>
              <Button size="sm" onClick={pay} disabled={busy || !o.payReady || seats < o.people}>
                {busy && <Loader2 className="size-3.5 animate-spin" />} Pay on Dejoiy Pay
              </Button>
              {!o.payReady && <p className="text-xs text-muted-foreground">Payments aren't switched on for Shine yet.</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Only your company's Shine admin can pay and add people.</p>
          )}
        </CardContent>
      </Card>
      {o.admin && (
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="size-4 text-primary" /> Add a colleague</CardTitle>
            <CardDescription>They need an @{o.domain} address. Shine emails them a temporary password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="flex flex-wrap gap-2">
              <Input placeholder="Name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} className="h-10 min-w-0 flex-1 rounded-xl" />
              <Input type="email" placeholder={`name@${o.domain}`} value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} className="h-10 min-w-0 flex-[2] rounded-xl" />
              <Button type="submit" size="sm">Add</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {o.admin && o.payments.length > 0 && (
        <Card className="border-border/70 shadow-none">
          <CardHeader><CardTitle className="text-sm font-semibold">Payments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {o.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{new Date(p.createdAt).toLocaleDateString()} · {p.seats} people · {p.period === "year" ? "yearly" : "monthly"}</span>
                <span className="font-semibold">{inr(p.amount)} · {p.status === "paid" ? "Paid" : p.status === "created" ? "Waiting" : p.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function useOverview() {
  return useQuery(api.shineOnly.overview);
}
