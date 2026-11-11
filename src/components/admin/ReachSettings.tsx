import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Admin console: can this company's employees message and email supervisors
 * (team leads up to admins and IT) at the other companies on Shine and Dejoiy Mail?
 * One switch for the company, and an override per person.
 */
export function ReachSettings() {
  const [domain, setDomain] = useState<string | undefined>(undefined);
  const data = useQuery(api.reach.settings, domain ? { domain } : {});
  const setCompany = useMutation(api.reach.setCompany);
  const setPerson = useMutation(api.reach.setPerson);
  const [q, setQ] = useState("");
  const people = useMemo(
    () => (data?.people ?? []).filter((p) => `${p.name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [data?.people, q],
  );
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message.replace(/^.*Uncaught Error:\s*/s, "").split("\n")[0] : "Couldn't save");

  if (data === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader>
        <CardTitle>Contact access across companies</CardTitle>
        <CardDescription>
          Everyone always reaches their own company. With this on, employees can also message (Shine) and find in contacts
          (Dejoiy Mail) the supervisors of other companies here: team leads, managers, directors, presidents, admins and IT.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.domains.length > 1 && (
          <label className="flex max-w-sm flex-col gap-1.5 text-sm font-semibold">
            Company
            <select
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-normal"
              value={data.domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              {data.domains.map((d) => (
                <option key={d} value={d}>
                  @{d}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-accent/40 p-4">
          <div>
            <div className="font-bold">Employees of @{data.domain} can reach other companies' supervisors</div>
            <div className="text-sm text-muted-foreground">The default for everyone below.</div>
          </div>
          <Switch
            checked={data.enabled}
            onCheckedChange={(on) => setCompany({ domain: data.domain, enabled: on }).then(() => toast.success(on ? "Turned on" : "Turned off")).catch(fail)}
            aria-label="Allow for the whole company"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold">People</h4>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-9 max-w-[240px]" aria-label="Search people" />
          </div>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {people.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name || p.email}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.email}
                    {p.supervisor ? " · supervisor (others can reach them)" : ""}
                  </div>
                </div>
                <select
                  className="h-9 rounded-xl border border-border bg-card px-2 text-sm"
                  value={p.reach === null ? "default" : p.reach ? "on" : "off"}
                  aria-label={`Contact access for ${p.name ?? p.email}`}
                  onChange={(e) =>
                    setPerson({
                      userId: p._id as Id<"users">,
                      enabled: e.target.value === "default" ? null : e.target.value === "on",
                    }).catch(fail)
                  }
                >
                  <option value="default">Company default ({data.enabled ? "on" : "off"})</option>
                  <option value="on">Allowed</option>
                  <option value="off">Not allowed</option>
                </select>
              </li>
            ))}
            {people.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No one matches.</li>}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
