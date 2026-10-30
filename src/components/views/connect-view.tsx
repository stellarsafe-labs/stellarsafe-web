"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletOptions } from "@/components/app/connect-wallet-dialog";
import { isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { useWallet } from "@/lib/wallet/wallet-provider";

/** Only allow same-origin relative redirects. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/treasuries";
}

export function ConnectView() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, status } = useWallet();
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (status === "connected" && address) router.replace(next);
  }, [status, address, next, router]);

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 md:grid-cols-2">
      <div className="space-y-6 md:pt-6">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {isDemo ? "Step into a team treasury" : "Connect your Stellar wallet"}
        </h1>
        <p className="text-muted-foreground text-pretty">
          {isDemo
            ? "Pick a persona to explore a live-feeling treasury with approvals, budgets and an audit trail. Everything runs locally in your browser."
            : `StellarSafe works with your existing wallet on ${network.label}. Your keys stay in your wallet.`}
        </p>
        <ul className="space-y-4 text-sm">
          {[
            {
              icon: KeyRound,
              t: "Non-custodial",
              d: "Every action is a transaction you review and sign in your wallet.",
            },
            {
              icon: ShieldCheck,
              t: "Rules enforced on-chain",
              d: "The contract rejects payments that break policy, whoever submits them.",
            },
            {
              icon: Wallet,
              t: "No account to create",
              d: "Your Stellar address is your identity. Roles come from the contract.",
            },
          ].map((f) => (
            <li key={f.t} className="flex gap-3">
              <f.icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="block font-medium">{f.t}</span>
                <span className="text-muted-foreground">{f.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{isDemo ? "Choose a demo identity" : "Choose a wallet"}</CardTitle>
          <CardDescription>
            {isDemo
              ? "You can switch personas any time from the wallet menu."
              : "More wallets can be added through the adapter interface."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WalletOptions />
        </CardContent>
      </Card>
    </div>
  );
}
