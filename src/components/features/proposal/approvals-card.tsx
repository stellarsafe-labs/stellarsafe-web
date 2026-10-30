import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Address } from "@/components/shared/address";
import { findMember } from "@/lib/domain/policy";
import type { OnChainApproval, OnChainTreasuryState } from "@/lib/domain/types";
import { fmtRelative } from "@/lib/format";
import type { EvaluatedProposal } from "@/lib/query/use-evaluated-proposals";

interface Props {
  treasuryId: string;
  item: EvaluatedProposal;
  state: OnChainTreasuryState;
  label: (address: string) => string;
}

/** Why an approval no longer counts, mirroring countValidApprovals in domain/policy. */
export function invalidApprovalReason(state: OnChainTreasuryState, a: OnChainApproval): string {
  const member = findMember(state, a.approver);
  if (!member) return "member removed";
  if (!member.roles.includes("approver")) return "approver role revoked";
  if (a.policyVersion !== state.policy.version) return `given under policy v${a.policyVersion}`;
  return "self-approval";
}

export function ApprovalsCard({ item, state, label }: Omit<Props, "treasuryId">) {
  const { proposal: p, evaluation: ev } = item;
  const isOpen = p.status === "pending";
  const notYet = state.members.filter(
    (m) =>
      m.roles.includes("approver") &&
      (state.policy.allowSelfApproval || m.address !== p.proposer) &&
      !p.approvals.some((a) => a.approver === m.address),
  );
  return (
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
            const reason = valid ? "" : invalidApprovalReason(state, a);
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
  );
}
