"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarClock, CircleCheck, Coins, FilePlus2, Fuel, Inbox, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { ChainBadge } from "@/components/shared/chain-badge";
import { Stat } from "@/components/shared/stat";
import { BudgetMeters } from "@/components/features/budget-meters";
import { ProposalRow } from "@/components/features/proposal-row";
import { DepositDialog } from "@/components/features/deposit-dialog";
import { ACTIVITY_META, describeActivity } from "@/components/features/activity-describe";
import { OutflowChart } from "@/components/charts/outflow-chart";
import { can, periodBounds } from "@/lib/domain/policy";
import { formatAmount } from "@/lib/domain/amount";
import { fmtDate, fmtPeriod, fmtRelative, fmtTtl } from "@/lib/format";
import {
  useActivity,
  useAddressLabel,
  useMe,
  useTransactions,
  useTreasuryId,
  useTreasuryMetadata,
} from "@/lib/query/hooks";
import { useEvaluatedProposals } from "@/lib/query/use-evaluated-proposals";
import { cn } from "@/lib/utils";

export function OverviewView() {
  const id = useTreasuryId();
  const meta = useTreasuryMetadata(id);
  const me = useMe(id);
  const label = useAddressLabel(id);
  const { items, state, now } = useEvaluatedProposals(id);
  const txs = useTransactions(id);
  const activity = useActivity(id);

  const open = useMemo(
    () =>
      (items ?? [])
        .filter((i) => ["pending", "ready", "blocked"].includes(i.evaluation.status))
        .sort((a, b) => {
          // Surface what the current wallet can act on first.
          const rank = (s: string) => (s === "ready" ? 0 : s === "pending" ? 1 : 2);
          return rank(a.evaluation.status) - rank(b.evaluation.status) || a.proposal.expiresAt - b.proposal.expiresAt;
        }),
    [items],
  );

  if (!state) return <OverviewSkeleton />;

  const asset = state.managedAsset;
  const managed = state.balances.find((b) => b.asset.contractId === asset.contractId)?.amount ?? 0n;
  const xlm = state.balances.find((b) => b.asset.code === "XLM" && b.asset.contractId !== asset.contractId);
  const totalLimit = state.policy.departments.reduce((s, d) => s + d.monthlyLimit, 0n);
  const totalSpent = Object.values(state.periodSpend).reduce((s, v) => s + v, 0n);
  const ready = open.filter((o) => o.evaluation.status === "ready").length;
  const { end } = periodBounds(now);

  return (
    <>
      <PageHeader
        title={meta.data?.name ?? <Skeleton className="h-8 w-64" />}
        description={meta.data?.description}
        actions={
          <>
            <DepositDialog treasuryId={id} asset={asset} />
            {can(me, "propose") && (
              <Button asChild>
                <Link href={`/t/${id}/proposals/new`}>
                  <FilePlus2 aria-hidden /> New payment
                </Link>
              </Button>
            )}
          </>
        }
      >
        <div className="pt-1">
          <ChainBadge ledger={state.ledger} readAt={state.readAt} />
        </div>
      </PageHeader>

      <section aria-label="Key figures" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label={`${asset.code} balance`}
          icon={Coins}
          value={formatAmount(managed, { decimals: asset.decimals })}
          hint="Held by the treasury contract"
        />
        <Stat
          label="Open proposals"
          icon={Inbox}
          value={open.length}
          hint={ready > 0 ? `${ready} ready to execute` : "None ready to execute"}
        />
        <Stat
          label={`Spent in ${fmtPeriod(state.periodKey)}`}
          icon={CalendarClock}
          value={formatAmount(totalSpent, { decimals: asset.decimals, maxFraction: 0 })}
          hint={`of ${formatAmount(totalLimit, { decimals: asset.decimals, maxFraction: 0 })} ${asset.code} across budgets`}
        />
        <Stat
          label="XLM for fees"
          icon={Fuel}
          value={xlm ? formatAmount(xlm.amount, { decimals: 7 }) : "—"}
          hint="Network fees are paid by the signer"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b pb-4">
              <CardTitle>Open proposals</CardTitle>
              <CardDescription>
                Approval state is read from the contract and refreshed every 15 seconds.
              </CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/t/${id}/proposals`}>
                    View all <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {!items ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : open.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CircleCheck />
                    </EmptyMedia>
                    <EmptyTitle>All clear</EmptyTitle>
                    <EmptyDescription>No payments are waiting for approval.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="divide-y">
                  {open.slice(0, 5).map((i) => (
                    <li key={i.proposal.id}>
                      <ProposalRow
                        treasuryId={id}
                        proposal={i.proposal}
                        evaluation={i.evaluation}
                        title={i.meta?.title}
                        asset={asset}
                        label={label}
                        now={now}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly outflow</CardTitle>
              <CardDescription>Executed payments in {asset.code}, last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {txs.data ? <OutflowChart transactions={txs.data} asset={asset} /> : <Skeleton className="h-56" />}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Department budgets</CardTitle>
              <CardDescription>
                {fmtPeriod(state.periodKey)} · resets {fmtDate(end + 1)} (UTC)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetMeters state={state} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-4" aria-hidden /> Policy v{state.policy.version}
              </CardTitle>
              <CardDescription>Updated {fmtRelative(state.policy.updatedAt)}</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/t/${id}/policies`}>Details</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {[...state.policy.approvalTiers]
                  .sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1))
                  .map((t) => (
                    <div key={t.minAmount.toString()} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {t.minAmount === 0n
                          ? "Any amount"
                          : `≥ ${formatAmount(t.minAmount, { decimals: asset.decimals })} ${asset.code}`}
                      </dt>
                      <dd className="font-medium">
                        {t.requiredApprovals} approval{t.requiredApprovals === 1 ? "" : "s"}
                      </dd>
                    </div>
                  ))}
                <div className="flex justify-between gap-2 border-t pt-2">
                  <dt className="text-muted-foreground">Recipient allowlist</dt>
                  <dd className="font-medium">
                    {state.policy.allowlistEnabled ? `${state.policy.allowlist.length} addresses` : "Off"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Approval window</dt>
                  <dd className="font-medium">{fmtTtl(state.policy.approvalTtlSeconds)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/t/${id}/activity`}>Audit log</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {!activity.data ? (
                <Skeleton className="h-32" />
              ) : (
                <ol className="space-y-3">
                  {activity.data.slice(0, 6).map((e) => {
                    const m = ACTIVITY_META[e.type];
                    return (
                      <li key={e.id} className="flex gap-3 text-sm">
                        <m.icon className={cn("mt-0.5 size-4 shrink-0", m.tone)} aria-hidden />
                        <div className="min-w-0">
                          <p className="line-clamp-2">{describeActivity(e, label, asset)}</p>
                          <p className="text-muted-foreground text-xs">{fmtRelative(e.at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading treasury">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
