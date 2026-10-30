"use client";

import { ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Provenance marker for values read from the contract. Makes it explicit
 * which numbers are authoritative and how fresh they are.
 */
export function ChainBadge({ ledger, readAt, className }: { ledger?: number; readAt?: number; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "border-success/25 bg-success/10 text-success focus-visible:ring-ring inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium outline-none focus-visible:ring-2",
            className,
          )}
        >
          <ShieldCheck className="size-3.5" aria-hidden />
          On-chain
          {ledger !== undefined && <span className="tabular font-mono font-normal">#{ledger.toLocaleString()}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Read directly from the treasury contract on {isDemo ? "the demo network" : network.label}
        {ledger !== undefined && <> at ledger {ledger.toLocaleString()}</>}
        {readAt && <> ({fmtRelative(readAt)})</>}. This is the authoritative state — the API cannot change it.
      </TooltipContent>
    </Tooltip>
  );
}
