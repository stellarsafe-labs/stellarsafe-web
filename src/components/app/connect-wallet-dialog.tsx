"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Identicon } from "@/components/shared/identicon";
import { RoleBadges } from "@/components/shared/role-badges";
import { isDemo } from "@/lib/config";
import { DEMO_PERSONAS } from "@/lib/data/demo/personas";
import { network } from "@/lib/stellar/network";
import { shortAddress } from "@/lib/stellar/address";
import { WALLETS, useWallet } from "@/lib/wallet/wallet-provider";
import { cn } from "@/lib/utils";

export function ConnectWalletDialog() {
  const { connectDialogOpen, setConnectDialogOpen } = useWallet();
  return (
    <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isDemo ? "Choose a demo identity" : "Connect a wallet"}</DialogTitle>
          <DialogDescription>
            {isDemo
              ? "Each persona holds different on-chain roles. Switch between them to try the full approval flow — open a second tab to act as two signers at once."
              : `StellarSafe never holds your keys. Your wallet signs every action on ${network.label}.`}
          </DialogDescription>
        </DialogHeader>
        <WalletOptions onDone={() => setConnectDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function WalletOptions({ onDone }: { onDone?: () => void }) {
  const { connect, address, status } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [available, setAvailable] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    Promise.all(WALLETS.map(async (w) => [w.id, await w.isAvailable()] as const)).then((r) => {
      if (active) setAvailable(Object.fromEntries(r));
    });
    return () => {
      active = false;
    };
  }, []);

  const go = async (walletId: (typeof WALLETS)[number]["id"], hint?: string) => {
    setPending(hint ?? walletId);
    try {
      const addr = await connect(walletId, hint);
      toast.success("Wallet connected", { description: shortAddress(addr, 6) });
      onDone?.();
    } catch (e) {
      toast.error("Could not connect", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(null);
    }
  };

  if (isDemo) {
    return (
      <ul className="space-y-2" aria-label="Demo personas">
        {DEMO_PERSONAS.map((p) => {
          const current = p.address === address;
          return (
            <li key={p.key}>
              <button
                type="button"
                disabled={status === "connecting"}
                onClick={() => go("demo", p.key)}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "hover:bg-muted focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 disabled:opacity-60",
                  current && "border-primary/50 bg-primary/5",
                )}
              >
                <Identicon value={p.address} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {p.name}
                    {current && <span className="text-primary text-xs font-normal">Connected</span>}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {p.title} · <span className="font-mono">{shortAddress(p.address)}</span>
                  </span>
                </span>
                {pending === p.key ? (
                  <Loader2 className="size-4 animate-spin" aria-label="Connecting" />
                ) : (
                  <RoleBadges roles={p.roles} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-2">
      {WALLETS.map((w) => (
        <li key={w.id} className="flex items-center gap-3 rounded-lg border p-3">
          <span className="bg-muted flex size-9 items-center justify-center rounded-md">
            <Wallet className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{w.name}</span>
            <span className="text-muted-foreground block text-xs">{w.description}</span>
          </span>
          {available[w.id] === false && w.installUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={w.installUrl} target="_blank" rel="noreferrer">
                Install <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : (
            <Button size="sm" onClick={() => go(w.id)} disabled={pending !== null}>
              {pending === w.id && <Loader2 className="animate-spin" aria-hidden />}
              Connect
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
