"use client";

import { TriangleAlert } from "lucide-react";
import { network } from "@/lib/stellar/network";
import { useWallet } from "@/lib/wallet/wallet-provider";

export function NetworkWarning() {
  const { wrongNetwork, wallet } = useWallet();
  if (!wrongNetwork) return null;
  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex items-center justify-center gap-2 border-b px-4 py-2 text-sm"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {wallet?.name} is set to a different network. Switch it to <strong>{network.label}</strong> before signing.
    </div>
  );
}
