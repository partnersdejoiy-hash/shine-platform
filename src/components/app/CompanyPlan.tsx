import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CompanyPlan as Plan } from "@/convex/companyPlan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Mail } from "lucide-react";

const ADMIN_BILLING = "https://admin-mail.dejoiy.com/admin/manage/billing";
const day = (s: number) => new Date(s * 1000).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

/** Settings → Billing: Shine comes with the company's Dejoiy Mail plan, paid in Dejoiy Mail's admin. */
export function CompanyPlan() {
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
