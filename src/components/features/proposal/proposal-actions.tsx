"use client";

import { Ban, Rocket, ThumbsUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTx } from "@/components/tx/tx-provider";
import { TxSummary } from "@/components/tx/tx-summary";
import { getDataSource } from "@/lib/data";
import { approvalBlocker, can } from "@/lib/domain/policy";
import { formatAmount } from "@/lib/domain/amount";
import type { OnChainTreasuryState } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/format";
import { useMe } from "@/lib/query/hooks";
import type { EvaluatedProposal } from "@/lib/query/use-evaluated-proposals";
import { useWallet } from "@/lib/wallet/wallet-provider";

interface Props {
  treasuryId: string;
  item: EvaluatedProposal;
  state: OnChainTreasuryState;
  label: (address: string) => string;
}

/** Approve / revoke / execute / cancel, each gated by on-chain role and routed through the tx review dialog. */
export function ProposalActions({ treasuryId: id, item, state, label, now }: Props & { now: number }) {
  const run = useTx();
  const { address } = useWallet();
  const me = useMe(id);
  const { proposal: p, evaluation: ev, meta } = item;
  const asset = state.managedAsset;
  const money = `${formatAmount(p.amount, { decimals: asset.decimals })} ${asset.code}`;
  const dept = state.policy.departments.find((d) => d.id === p.departmentId);
  const iApproved = !!address && p.approvals.some((a) => a.approver === address);
  const approveBlock = approvalBlocker(state, p, address ?? undefined, now);
  const canCancel = !!address && (p.proposer === address || can(me, "cancel_any"));
  const canExecute = ev.canExecute && can(me, "execute");
  const title = meta?.title ?? `Payment proposal #${p.id}`;
  const ds = getDataSource();

  if (p.status !== "pending") return null;

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 lg:justify-end">
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
      {approveBlock && can(me, "approve") && !iApproved && ev.status !== "ready" && (
        <p className="text-muted-foreground text-sm lg:text-right" role="note">
          You can&apos;t approve: {approveBlock}
        </p>
      )}
    </div>
  );
}
