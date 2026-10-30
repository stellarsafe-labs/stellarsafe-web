import { TriangleAlert } from "lucide-react";
import { formatAmount } from "@/lib/domain/amount";
import type { OnChainTreasuryState } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function BudgetMeters({ state }: { state: OnChainTreasuryState }) {
  const { managedAsset: asset } = state;
  return (
    <ul className="space-y-4">
      {state.policy.departments.map((d) => {
        const spent = state.periodSpend[d.id] ?? 0n;
        const pct = d.monthlyLimit > 0n ? Number((spent * 1000n) / d.monthlyLimit) / 10 : 0;
        const near = pct >= 80;
        const remaining = d.monthlyLimit - spent;
        return (
          <li key={d.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="text-muted-foreground tabular">
                {formatAmount(spent, { decimals: asset.decimals, maxFraction: 0 })} /{" "}
                {formatAmount(d.monthlyLimit, { decimals: asset.decimals, maxFraction: 0 })}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${d.name} budget used`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(pct))}
              aria-valuetext={`${Math.round(pct)}% used, ${formatAmount(remaining > 0n ? remaining : 0n, { decimals: asset.decimals })} ${asset.code} remaining`}
              className="bg-muted h-2 overflow-hidden rounded-full"
            >
              <div
                className={cn("h-full rounded-full transition-[width]", near ? "bg-warning" : "bg-primary")}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className={cn("flex items-center gap-1 text-xs", near ? "text-warning" : "text-muted-foreground")}>
              {near && <TriangleAlert className="size-3" aria-hidden />}
              {formatAmount(remaining > 0n ? remaining : 0n, { decimals: asset.decimals })} {asset.code} left
              {near && " · near limit"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
