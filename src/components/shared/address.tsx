"use client";

import { ExternalLink } from "lucide-react";
import { isDemo } from "@/lib/config";
import { shortAddress } from "@/lib/stellar/address";
import { explorer } from "@/lib/stellar/network";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { Identicon } from "./identicon";

interface Props {
  address: string;
  label?: string;
  className?: string;
  /** Show the identicon avatar. */
  avatar?: boolean;
  copy?: boolean;
  link?: boolean;
  chars?: number;
}

/** Always shows the address (labels alone can be spoofed off-chain). */
export function Address({ address, label, className, avatar = false, copy = true, link = !isDemo, chars = 4 }: Props) {
  const short = shortAddress(address, chars);
  const showLabel = label && label !== short;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {avatar && <Identicon value={address} />}
      <span className="flex min-w-0 flex-col leading-tight">
        {showLabel && <span className="truncate font-medium">{label}</span>}
        <span className={cn("font-mono text-xs", showLabel && "text-muted-foreground")} title={address}>
          {short}
        </span>
      </span>
      {(copy || link) && (
        <span className="flex shrink-0 items-center">
          {copy && <CopyButton value={address} label="Copy address" />}
          {link && (
            <a
              href={explorer.account(address)}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-6 items-center justify-center rounded-md"
              aria-label="Open in explorer"
            >
              <ExternalLink className="size-3" />
            </a>
          )}
        </span>
      )}
    </span>
  );
}
