"use client";

import { useState } from "react";
import { ArrowDownLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { CopyButton } from "@/components/shared/copy-button";
import { isDemo } from "@/lib/config";
import { getDemoSource } from "@/lib/data";
import { tryParseAmount } from "@/lib/domain/amount";
import type { Asset } from "@/lib/domain/types";
import { network } from "@/lib/stellar/network";
import { useWallet } from "@/lib/wallet/wallet-provider";

export function DepositDialog({ treasuryId, asset }: { treasuryId: string; asset: Asset }) {
  const queryClient = useQueryClient();
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const parsed = tryParseAmount(amount);
  const invalid = amount !== "" && (!parsed || parsed <= 0n);

  const simulate = async () => {
    if (!parsed || parsed <= 0n) return;
    setBusy(true);
    try {
      await getDemoSource()?.simulateDeposit(treasuryId, address ?? "GDEMODEPOSITOR", parsed);
      await queryClient.invalidateQueries({ queryKey: ["treasury", treasuryId] });
      toast.success(`Received ${amount} ${asset.code}`);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowDownLeft aria-hidden /> Deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund this treasury</DialogTitle>
          <DialogDescription>
            Send {asset.code} on {isDemo ? "the demo network" : network.label} to the treasury contract address.
            Deposits need no approval; only outflows are governed by policy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Treasury contract address</p>
          <div className="bg-muted/40 flex items-center gap-2 rounded-lg border p-2">
            <code className="min-w-0 flex-1 text-xs break-all">{treasuryId}</code>
            <CopyButton value={treasuryId} label="Copy contract address" />
          </div>
          {!isDemo && network.name !== "mainnet" && (
            <p className="text-muted-foreground text-xs">
              Testnet USDC is available from Circle&apos;s testnet faucet. Never send mainnet funds to an unaudited
              contract.
            </p>
          )}
        </div>
        {isDemo && (
          <>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="deposit-amount">Simulate an incoming transfer</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="deposit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={invalid || undefined}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{asset.code}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {invalid ? (
                <FieldError>Enter a positive amount.</FieldError>
              ) : (
                <FieldDescription>Demo only.</FieldDescription>
              )}
            </Field>
            <DialogFooter>
              <Button onClick={simulate} disabled={busy || invalid || !parsed}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Simulate deposit
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
