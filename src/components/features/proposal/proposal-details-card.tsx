import { ExternalLink, Fingerprint } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Address } from "@/components/shared/address";
import { isDemo } from "@/lib/config";
import type { OnChainTreasuryState } from "@/lib/domain/types";
import { explorer } from "@/lib/stellar/network";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import type { EvaluatedProposal } from "@/lib/query/use-evaluated-proposals";

interface Props {
  treasuryId: string;
  item: EvaluatedProposal;
  state: OnChainTreasuryState;
  label: (address: string) => string;
}

export function ProposalDetailsCard({ item, state, label }: Omit<Props, "treasuryId">) {
  const { proposal: p, meta } = item;
  const dept = state.policy.departments.find((d) => d.id === p.departmentId);
  return (
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
              {p.status === "executed" ? "Executed" : p.status === "cancelled" ? "Cancelled" : "Approval window closes"}
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
                className="text-primary inline-flex items-center gap-1 font-mono text-xs break-all underline underline-offset-4"
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
              <code className="break-all">{p.metadataHash.slice(0, 16)}…</code> is anchored in the proposal on-chain.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
