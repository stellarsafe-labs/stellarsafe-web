import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge, statusLabel } from "@/components/shared/status-badge";
import { formatAmount } from "@/lib/domain/amount";
import type { ProposalEvaluation } from "@/lib/domain/policy";
import type { Asset, OnChainProposal } from "@/lib/domain/types";
import { fmtRelative } from "@/lib/format";

export function ProposalRow({
  treasuryId,
  proposal,
  evaluation,
  title,
  asset,
  label,
  now,
}: {
  treasuryId: string;
  proposal: OnChainProposal;
  evaluation: ProposalEvaluation;
  title?: string;
  asset: Asset;
  label: (a: string) => string;
  now: number;
}) {
  const open = evaluation.status === "pending" || evaluation.status === "ready" || evaluation.status === "blocked";
  return (
    <Link
      href={`/t/${treasuryId}/proposals/${proposal.id}`}
      className="group hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-ring flex items-center gap-4 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs">#{proposal.id}</span>
          <span className="truncate font-medium">{title ?? `Payment proposal #${proposal.id}`}</span>
        </p>
        <p className="text-muted-foreground truncate text-xs">
          To {label(proposal.recipient)} · by {label(proposal.proposer)} ·{" "}
          {open && proposal.expiresAt > now
            ? `expires ${fmtRelative(proposal.expiresAt)}`
            : fmtRelative(proposal.createdAt)}
        </p>
      </div>
      <div className="hidden flex-col items-end gap-1 sm:flex">
        <StatusBadge status={evaluation.status} />
        {open && (
          <span className="text-muted-foreground tabular text-xs">
            {evaluation.validApprovers.length}/{evaluation.required} approvals
          </span>
        )}
      </div>
      <div className="shrink-0 text-right sm:w-28">
        <p className="tabular font-semibold">{formatAmount(proposal.amount, { decimals: asset.decimals })}</p>
        <p className="text-muted-foreground text-xs">{asset.code}</p>
      </div>
      <ChevronRight
        className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
      <span className="sr-only sm:hidden">Status: {statusLabel(evaluation.status)}</span>
    </Link>
  );
}
