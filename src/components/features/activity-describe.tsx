import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  FilePlus2,
  type LucideIcon,
  Rocket,
  Scale,
  ThumbsUp,
  Undo2,
  UserMinus,
  UserPlus,
  UserRoundCog,
} from "lucide-react";
import { formatAmount } from "@/lib/domain/amount";
import type { ActivityEvent, ActivityType, Asset } from "@/lib/domain/types";

export const ACTIVITY_META: Record<ActivityType, { icon: LucideIcon; label: string; tone: string }> = {
  treasury_initialized: { icon: Rocket, label: "Treasury created", tone: "text-primary" },
  deposit: { icon: ArrowDownLeft, label: "Deposit", tone: "text-success" },
  member_added: { icon: UserPlus, label: "Member added", tone: "text-primary" },
  member_removed: { icon: UserMinus, label: "Member removed", tone: "text-destructive" },
  member_roles_changed: { icon: UserRoundCog, label: "Roles changed", tone: "text-primary" },
  policy_updated: { icon: Scale, label: "Policy updated", tone: "text-warning" },
  proposal_created: { icon: FilePlus2, label: "Payment proposed", tone: "text-info" },
  proposal_approved: { icon: ThumbsUp, label: "Approval", tone: "text-success" },
  approval_revoked: { icon: Undo2, label: "Approval revoked", tone: "text-warning" },
  proposal_executed: { icon: ArrowUpRight, label: "Payment executed", tone: "text-success" },
  proposal_cancelled: { icon: Ban, label: "Proposal cancelled", tone: "text-muted-foreground" },
};

/** One-line, human description of an indexed contract event. */
export function describeActivity(e: ActivityEvent, label: (a: string) => string, asset: Asset): string {
  const amt = e.data.amount
    ? `${formatAmount(BigInt(String(e.data.amount)), { decimals: asset.decimals })} ${asset.code}`
    : "";
  const actor = label(e.actor);
  const p = e.proposalId ? `#${e.proposalId}` : "";
  switch (e.type) {
    case "treasury_initialized":
      return `${actor} deployed the treasury`;
    case "deposit":
      return `${amt} received from ${actor}`;
    case "member_added":
      return `${actor} added ${label(String(e.data.member))}${e.data.roles ? ` as ${String(e.data.roles).replaceAll(",", ", ")}` : " (viewer)"}`;
    case "member_removed":
      return `${actor} removed ${label(String(e.data.member))}`;
    case "member_roles_changed":
      return `${actor} set ${label(String(e.data.member))}'s roles to ${String(e.data.roles || "viewer").replaceAll(",", ", ")}`;
    case "policy_updated":
      return `${actor} published policy v${e.data.version}${e.data.change ? ` — ${e.data.change}` : ""}${
        Number(e.data.invalidatedProposals) > 0
          ? ` (invalidated approvals on ${e.data.invalidatedProposals} pending proposals)`
          : ""
      }`;
    case "proposal_created":
      return `${actor} proposed ${p}: ${amt} to ${label(String(e.data.recipient))}`;
    case "proposal_approved":
      return `${actor} approved ${p}`;
    case "approval_revoked":
      return `${actor} revoked their approval on ${p}`;
    case "proposal_executed":
      return `${actor} executed ${p}: ${amt} to ${label(String(e.data.recipient))}`;
    case "proposal_cancelled":
      return `${actor} cancelled ${p}`;
  }
}
