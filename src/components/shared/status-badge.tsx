import { Ban, CheckCheck, CircleCheck, Clock, Hourglass, OctagonAlert, RefreshCcw } from "lucide-react";
import type { DerivedProposalStatus } from "@/lib/domain/policy";
import { cn } from "@/lib/utils";

const MAP: Record<DerivedProposalStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Awaiting approvals", icon: Clock, className: "bg-info/10 text-info border-info/20" },
  ready: { label: "Ready to execute", icon: CircleCheck, className: "bg-success/10 text-success border-success/25" },
  blocked: {
    label: "Blocked by policy",
    icon: OctagonAlert,
    className: "bg-warning/10 text-warning border-warning/30",
  },
  expired: { label: "Expired", icon: Hourglass, className: "bg-muted text-muted-foreground border-border" },
  stale: { label: "Policy changed", icon: RefreshCcw, className: "bg-warning/10 text-warning border-warning/30" },
  executed: { label: "Executed", icon: CheckCheck, className: "bg-success/10 text-success border-success/25" },
  cancelled: { label: "Cancelled", icon: Ban, className: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status, className }: { status: DerivedProposalStatus; className?: string }) {
  const s = MAP[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        s.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </span>
  );
}

export const statusLabel = (s: DerivedProposalStatus) => MAP[s].label;
