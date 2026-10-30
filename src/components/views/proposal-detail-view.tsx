"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { PolicyChecks } from "@/components/shared/policy-checks";
import { ChainBadge } from "@/components/shared/chain-badge";
import { QueryError } from "@/components/shared/query-error";
import { ProposalActions } from "@/components/features/proposal/proposal-actions";
import { ProposalDetailsCard } from "@/components/features/proposal/proposal-details-card";
import { ApprovalsCard } from "@/components/features/proposal/approvals-card";
import { formatAmount } from "@/lib/domain/amount";
import { useAddressLabel, useTreasuryId } from "@/lib/query/hooks";
import { useEvaluatedProposals } from "@/lib/query/use-evaluated-proposals";

export function ProposalDetailView() {
  const id = useTreasuryId();
  const params = useParams<{ proposalId: string }>();
  const proposalId = Number(params.proposalId);
  const label = useAddressLabel(id);
  const { items, state, now, error, refetch } = useEvaluatedProposals(id);
  const item = useMemo(() => items?.find((i) => i.proposal.id === proposalId), [items, proposalId]);

  if (error && !items) return <QueryError error={error} retry={refetch} />;
  if (!items || !state) return <DetailSkeleton />;
  if (!item) {
    return (
      <Alert>
        <CircleX aria-hidden />
        <AlertTitle>Proposal #{params.proposalId} not found</AlertTitle>
        <AlertDescription>
          It may not be indexed yet, or the id is wrong.{" "}
          <Link className="underline" href={`/t/${id}/proposals`}>
            Back to approvals
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const { proposal: p, evaluation: ev, meta } = item;
  const asset = state.managedAsset;
  const title = meta?.title ?? `Payment proposal #${p.id}`;
  const isOpen = p.status === "pending";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={`/t/${id}/proposals`}>
          <ArrowLeft aria-hidden /> Approvals
        </Link>
      </Button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ev.status} />
            <ChainBadge ledger={state.ledger} readAt={state.readAt} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            <span className="text-muted-foreground mr-2 font-mono text-lg">#{p.id}</span>
            {title}
          </h1>
          <p className="tabular text-3xl font-semibold tracking-tight">
            {formatAmount(p.amount, { decimals: asset.decimals })}{" "}
            <span className="text-muted-foreground text-lg font-normal">{asset.code}</span>
          </p>
        </div>
        <ProposalActions treasuryId={id} item={item} state={state} label={label} now={now} />
      </div>

      {ev.status === "stale" && (
        <Alert className="border-warning/40 mb-6">
          <CircleX aria-hidden className="text-warning" />
          <AlertTitle>The spending policy changed</AlertTitle>
          <AlertDescription>
            This proposal was created under policy v{p.policyVersion}; the treasury now runs v{state.policy.version}.
            The contract invalidated its approvals so nobody approves under rules that no longer apply. Cancel it and
            submit a new proposal.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <ProposalDetailsCard item={item} state={state} label={label} />
          {isOpen && (
            <Card>
              <CardHeader>
                <CardTitle>Policy checks</CardTitle>
                <CardDescription>
                  What the contract will verify at execution time, evaluated against current on-chain state.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PolicyChecks checks={ev.checks} />
              </CardContent>
            </Card>
          )}
        </div>

        <ApprovalsCard item={item} state={state} label={label} />
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-96 max-w-full" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
