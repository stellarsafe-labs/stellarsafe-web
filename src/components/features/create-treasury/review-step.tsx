import { TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RoleBadges } from "@/components/shared/role-badges";
import { formToPolicy, type PolicyFormValues } from "@/components/features/policy-form";
import { formatAmount } from "@/lib/domain/amount";
import { shortAddress } from "@/lib/stellar/address";
import { isDemo } from "@/lib/config";
import { fmtTtl } from "@/lib/format";
import type { SetupValues } from "./setup-schema";

export function ReviewStep({ setup, policy }: { setup: SetupValues; policy: PolicyFormValues }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{setup.name}</CardTitle>
          {setup.description && <CardDescription>{setup.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <section>
            <h3 className="mb-2 font-medium">Members</h3>
            <ul className="divide-y rounded-lg border">
              {setup.members.map((m) => (
                <li key={m.address} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{m.label || "—"}</span>
                    <span className="text-muted-foreground font-mono text-xs">{shortAddress(m.address, 6)}</span>
                  </span>
                  <RoleBadges roles={m.roles} />
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-medium">Approval thresholds</h3>
              <ul className="text-muted-foreground space-y-1">
                {formToPolicy(policy).approvalTiers.map((t) => (
                  <li key={t.minAmount.toString()}>
                    {t.minAmount === 0n ? "Any amount" : `≥ ${formatAmount(t.minAmount)} USDC`}: {t.requiredApprovals}{" "}
                    approval{t.requiredApprovals === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-medium">Budgets (monthly)</h3>
              <ul className="text-muted-foreground space-y-1">
                {policy.departments.map((d) => (
                  <li key={d.id}>
                    {d.name}: {d.monthlyLimit} USDC
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-medium">Allowlist</h3>
              <p className="text-muted-foreground">
                {policy.allowlistEnabled ? `${policy.allowlist.length} recipients` : "Disabled"}
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-medium">Approval window</h3>
              <p className="text-muted-foreground">
                {fmtTtl(Math.round(policy.approvalTtlDays * 86_400))} · self-approval{" "}
                {policy.allowSelfApproval ? "allowed" : "forbidden"}
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
      {!isDemo && (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertTitle>Testnet only until audited</AlertTitle>
          <AlertDescription>
            StellarSafe contracts have not completed an independent security review. Don&apos;t deposit funds you
            can&apos;t afford to lose.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
