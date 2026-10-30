import { isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { cn } from "@/lib/utils";

export function NetworkBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        network.name === "mainnet" && !isDemo ? "border-destructive/30 text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isDemo ? "bg-chart-4" : network.name === "mainnet" ? "bg-destructive" : "bg-success",
        )}
        aria-hidden
      />
      {isDemo ? "Demo network" : network.label}
    </span>
  );
}
