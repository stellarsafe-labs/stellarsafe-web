"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowLeft,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleX,
  ExternalLink,
  Fingerprint,
  Rocket,
  ThumbsUp,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Address } from "@/components/shared/address";
import { StatusBadge } from "@/components/shared/status-badge";
import { PolicyChecks } from "@/components/shared/policy-checks";
import { ChainBadge } from "@/components/shared/chain-badge";
import { QueryError } from "@/components/shared/query-error";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { approvalBlocker, can, findMember } from "@/lib/domain/policy";
import { formatAmount } from "@/lib/domain/amount";
import { isDemo } from "@/lib/config";
import { explorer } from "@/lib/stellar/network";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { useAddressLabel, useMe, useTreasuryId } from "@/lib/query/hooks";
import { useEvaluatedProposals } from "@/lib/query/use-evaluated-proposals";
import { useWallet } from "@/lib/wallet/wallet-provider";

function TxSummary({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProposalDetailView() {
  const id = useTreasuryId();
  const params = useParams<{ proposalId: string }>();
  const proposalId = Number(params.proposalId);
  const { address } = useWallet();
  const me = useMe(id);
  const label = useAddressLabel(id);
  const run = useTx();
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
  const money = `${formatAmount(p.amount, { decimals: asset.decimals })} ${asset.code}`;
  const dept = state.policy.departments.find((d) => d.id === p.departmentId);
  const iApproved = !!address && p.approvals.some((a) => a.approver === address);
  const approveBlock = approvalBlocker(state, p, address ?? undefined, now);
  const isOpen = p.status === "pending";
  const canCancel = isOpen && !!address && (p.proposer === address || can(me, "cancel_any"));
  const canExecute = ev.canExecute && can(me, "execute");
  const title = meta?.title ?? `Payment proposal #${p.id}`;

  const eligible = state.members.filter(
    (m) => m.roles.includes("approver") && (state.policy.allowSelfApproval || m.address !== p.proposer),
  );
  const notYet = eligible.filter((m) => !p.approvals.some((a) => a.approver === m.address));

  const baseRows: [string, React.ReactNode][] = [
    ["Proposal", `#${p.id} · ${title}`],
    ["Amount", money],
    [
      "Recipient",
      <span key="r" className="font-mono text-xs">
        {label(p.recipient)}
        <br />
        {p.recipient}
      </span>,
    ],
  ];

  const ds = getDataSource();

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

        {isOpen && (
          <div className="flex flex-wrap gap-2">
            {canCancel && (
              <Button
                variant="outline"
                onClick={() =>
                  run({
                    title: "Cancel proposal",
                    description: "Cancelling is permanent. A new proposal is needed to make this payment later.",
                    summary: <TxSummary rows={baseRows} />,
                    confirmLabel: "Sign & cancel",
                    destructive: true,
                    treasuryId: id,
                    successMessage: `Proposal #${p.id} cancelled`,
                    action: (ctx) => ds.cancelPayment(id, p.id, ctx),
                  })
                }
              >
                <Ban aria-hidden /> Cancel
              </Button>
            )}
            {iApproved && (
              <Button
                variant="outline"
                onClick={() =>
                  run({
                    title: "Revoke your approval",
                    description: "Your approval will no longer count toward this payment.",
                    summary: <TxSummary rows={baseRows} />,
                    confirmLabel: "Sign & revoke",
                    treasuryId: id,
                    successMessage: "Approval revoked",
                    action: (ctx) => ds.revokeApproval(id, p.id, ctx),
                  })
                }
              >
                <Undo2 aria-hidden /> Revoke approval
              </Button>
            )}
            {!iApproved && can(me, "approve") && (
              <Button
                variant={canExecute ? "outline" : "default"}
                disabled={!!approveBlock}
                title={approveBlock ?? undefined}
                onClick={() =>
                  run({
                    title: "Approve payment",
                    description: "Review carefully. Your signature authorizes this exact payment.",
                    summary: (
                      <TxSummary
                        rows={[
                          ...baseRows,
                          ["Department", dept?.name ?? p.departmentId],
                          ["Approvals after yours", `${ev.validApprovers.length + 1} of ${ev.required}`],
                          ["Approval valid until", fmtDateTime(p.expiresAt)],
                        ]}
                      />
                    ),
                    confirmLabel: "Sign approval",
                    treasuryId: id,
                    successMessage: `You approved #${p.id}`,
                    action: (ctx) => ds.approvePayment(id, p.id, ctx),
                  })
                }
              >
                <ThumbsUp aria-hidden /> Approve
              </Button>
            )}
            {ev.canExecute && (
              <Button
                disabled={!canExecute}
                title={!canExecute ? "Connect a member wallet to execute." : undefined}
                onClick={() =>
                  run({
                    title: "Execute payment",
                    description: `This transfers ${money} out of the treasury. It cannot be undone.`,
                    summary: (
                      <TxSummary
                        rows={[
                          ...baseRows,
                          ["Department", dept?.name ?? p.departmentId],
                          ["Valid approvals", `${ev.validApprovers.length} of ${ev.required}`],
                        ]}
                      />
                    ),
                    confirmLabel: `Sign & send ${money}`,
                    treasuryId: id,
                    successMessage: `Sent ${money}`,
                    action: (ctx) => ds.executePayment(id, p.id, ctx),
                  })
                }
              >
                <Rocket aria-hidden /> Execute payment
              </Button>
            )}
          </div>
        )}
      </div>

      {isOpen && approveBlock && can(me, "approve") && !iApproved && ev.status !== "ready" && (
        <p className="text-muted-foreground mb-4 text-sm" role="note">
          You can&apos;t approve: {approveBlock}
        </p>
      )}

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
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {meta?.description && <p className="text-sm text-pretty whitespace-pre-wrap">{meta.description}</p>}
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground mb-1">Recipient</dt>
                  <dd>
                    <Address address={p.recipient} label={label(p.recipient)} avatar />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">Proposed by</dt>
                  <dd>
                    <Address address={p.proposer} label={label(p.proposer)} avatar />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="font-medium">{dept?.name ?? `${p.departmentId} (removed)`}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Policy version</dt>
                  <dd className="font-medium">v{p.policyVersion}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-medium">{fmtDateTime(p.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {p.status === "executed"
                      ? "Executed"
                      : p.status === "cancelled"
                        ? "Cancelled"
                        : "Approval window closes"}
                  </dt>
                  <dd className="font-medium">
                    {p.status === "executed" && p.executedAt
                      ? fmtDateTime(p.executedAt)
                      : p.status === "cancelled" && p.cancelledAt
                        ? `${fmtDateTime(p.cancelledAt)}${p.cancelledBy ? ` by ${label(p.cancelledBy)}` : ""}`
                        : `${fmtDateTime(p.expiresAt)} (${fmtRelative(p.expiresAt)})`}
                  </dd>
                </div>
              </dl>
              {p.executedTxHash && (
                <div className="bg-muted/30 rounded-lg border p-3 text-sm">
                  <p className="text-muted-foreground mb-1">Execution transaction</p>
                  {isDemo ? (
                    <code className="text-xs break-all">{p.executedTxHash}</code>
                  ) : (
                    <a
                      href={explorer.tx(p.executedTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 font-mono text-xs break-all hover:underline"
                    >
                      {p.executedTxHash} <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  )}
                </div>
              )}
              {p.metadataHash && (
                <p className="text-muted-foreground flex items-start gap-2 text-xs">
                  <Fingerprint className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    The title and description are stored off-chain; their SHA-256 hash{" "}
                    <code className="break-all">{p.metadataHash.slice(0, 16)}…</code> is anchored in the proposal
                    on-chain.
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

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

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>
              {ev.validApprovers.length} of {ev.required} required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={Math.min(100, (ev.validApprovers.length / ev.required) * 100)}
              aria-label={`${ev.validApprovers.length} of ${ev.required} approvals`}
            />
            <ol className="space-y-3">
              {p.approvals.map((a) => {
                const valid = ev.validApprovers.includes(a.approver);
                const reason = !findMember(state, a.approver)
                  ? "member removed"
                  : !findMember(state, a.approver)?.roles.includes("approver")
                    ? "approver role revoked"
                    : a.policyVersion !== state.policy.version
                      ? `given under policy v${a.policyVersion}`
                      : "self-approval";
                return (
                  <li key={a.approver} className="flex items-start gap-2 text-sm">
                    {valid ? (
                      <CircleCheck className="text-success mt-1 size-4 shrink-0" aria-label="Valid approval" />
                    ) : (
                      <CircleX
                        className="text-muted-foreground mt-1 size-4 shrink-0"
                        aria-label="Approval no longer counts"
                      />
                    )}
                    <div className="min-w-0">
                      <Address address={a.approver} label={label(a.approver)} copy={false} link={false} />
                      <p className="text-muted-foreground text-xs">
                        {fmtRelative(a.at)}
                        {!valid && isOpen && <> · doesn&apos;t count ({reason})</>}
                      </p>
                    </div>
                  </li>
                );
              })}
              {isOpen &&
                notYet.map((m) => (
                  <li key={m.address} className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CircleDashed className="mt-1 size-4 shrink-0" aria-label="Not yet approved" />
                    <Address address={m.address} label={label(m.address)} copy={false} link={false} />
                  </li>
                ))}
            </ol>
            {!state.policy.allowSelfApproval && (
              <p className="text-muted-foreground text-xs">The proposer cannot approve their own payment.</p>
            )}
          </CardContent>
        </Card>
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
