"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ChainBadge } from "@/components/shared/chain-badge";
import { Address } from "@/components/shared/address";
import { BudgetMeters } from "@/components/features/budget-meters";
import { can } from "@/lib/domain/policy";
import { formatAmount } from "@/lib/domain/amount";
import { fmtDateTime, fmtPeriod, fmtTtl } from "@/lib/format";
import { useMe, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";

export function PolicyView() {
  const id = useTreasuryId();
  const me = useMe(id);
  const { data: state } = useTreasuryState(id);
  if (!state) return <Skeleton className="h-96" />;
  const { policy, managedAsset: asset } = state;
  const fmt = (u: bigint) => `${formatAmount(u, { decimals: asset.decimals })} ${asset.code}`;
  const tiers = [...policy.approvalTiers].sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1));

  return (
    <>
      <PageHeader
        title="Spending policy"
        description="These rules are stored in the treasury contract and checked on every payment. Neither the StellarSafe API nor this interface can bypass them."
        actions={
          can(me, "manage_policy") && (
            <Button asChild>
              <Link href={`/t/${id}/policies/edit`}>
                <Pencil aria-hidden /> Edit policy
              </Link>
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ChainBadge ledger={state.ledger} readAt={state.readAt} />
          <Badge variant="outline">Version {policy.version}</Badge>
          <span className="text-muted-foreground text-xs">Last changed {fmtDateTime(policy.updatedAt)}</span>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approval thresholds</CardTitle>
            <CardDescription>Approvals required, by payment size.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-5">
              {tiers.map((t, i) => (
                <li key={t.minAmount.toString()} className="relative">
                  <span
                    className="border-background bg-primary absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2"
                    aria-hidden
                  />
                  <p className="text-muted-foreground text-sm">
                    {t.minAmount === 0n
                      ? tiers[i + 1]
                        ? `Under ${fmt(tiers[i + 1].minAmount)}`
                        : "Any amount"
                      : tiers[i + 1]
                        ? `${fmt(t.minAmount)} – ${fmt(tiers[i + 1].minAmount)}`
                        : `${fmt(t.minAmount)} and above`}
                  </p>
                  <p className="font-medium">
                    {t.requiredApprovals} approval{t.requiredApprovals === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval rules</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Approval window</dt>
                <dd className="font-medium">{fmtTtl(policy.approvalTtlSeconds)} from proposal creation</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Self-approval</dt>
                <dd className="font-medium">
                  {policy.allowSelfApproval ? "Allowed" : "Forbidden — proposers can't approve their own payments"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">On policy change</dt>
                <dd className="font-medium">Approvals on pending proposals are invalidated</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Removed members</dt>
                <dd className="font-medium">Their approvals stop counting immediately</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department budgets</CardTitle>
            <CardDescription>{fmtPeriod(state.periodKey)} · calendar months in UTC, tracked on-chain</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetMeters state={state} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipient allowlist</CardTitle>
            <CardDescription>
              {policy.allowlistEnabled
                ? `Payments may only go to these ${policy.allowlist.length} addresses.`
                : "Disabled — payments may go to any address."}
            </CardDescription>
          </CardHeader>
          {policy.allowlistEnabled && (
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Recipient</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.allowlist.map((a) => (
                    <TableRow key={a.address}>
                      <TableCell className="pl-6">
                        <Address address={a.address} label={a.label} avatar />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
