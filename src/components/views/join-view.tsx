"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleCheck, Loader2, Search, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadges } from "@/components/shared/role-badges";
import { CopyButton } from "@/components/shared/copy-button";
import { getDataSource } from "@/lib/data";
import { findMember } from "@/lib/domain/policy";
import type { OnChainTreasuryState, TreasuryMetadata } from "@/lib/domain/types";
import { isContractAddress } from "@/lib/stellar/address";
import { formatAmount } from "@/lib/domain/amount";
import { isDemo } from "@/lib/config";
import { demoContract } from "@/lib/data/demo/personas";
import { useWallet } from "@/lib/wallet/wallet-provider";

export function JoinView() {
  const { address, setConnectDialogOpen } = useWallet();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ state: OnChainTreasuryState; meta?: TreasuryMetadata } | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = input.trim();
    setFound(null);
    if (!isContractAddress(id)) {
      setError("Enter a contract address. Treasury addresses start with C and are 56 characters long.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const ds = getDataSource();
      const state = await ds.getTreasuryState(id);
      const meta = await ds.getTreasuryMetadata(id).catch(() => undefined);
      setFound({ state, meta });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const member = found ? findMember(found.state, address) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Join a treasury"
        description="Membership is granted on-chain by a treasury admin. Look up the contract to verify it and check whether your wallet has been added."
      />
      <Card>
        <CardContent>
          <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
            <Field data-invalid={!!error || undefined} className="flex-1">
              <FieldLabel htmlFor="contract-id">Treasury contract address</FieldLabel>
              <Input
                id="contract-id"
                placeholder="C…"
                className="font-mono"
                spellCheck={false}
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-invalid={!!error}
              />
              {error ? (
                <FieldError>{error}</FieldError>
              ) : (
                isDemo && (
                  <FieldDescription>
                    Demo:{" "}
                    <button type="button" className="underline" onClick={() => setInput(demoContract("orbit-grants"))}>
                      use the Orbit Grants Committee address
                    </button>
                  </FieldDescription>
                )
              )}
            </Field>
            <Button type="submit" className="sm:mt-6" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} Look up
            </Button>
          </form>
        </CardContent>
      </Card>

      {found && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{found.meta?.name ?? "Unnamed treasury"}</CardTitle>
            <CardDescription>
              {found.state.members.length} members · policy v{found.state.policy.version} ·{" "}
              {formatAmount(found.state.balances[0]?.amount ?? 0n)} {found.state.managedAsset.code}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!address ? (
              <Alert>
                <AlertTitle>Connect your wallet to check membership</AlertTitle>
                <AlertDescription>
                  <Button size="sm" className="mt-2 w-fit" onClick={() => setConnectDialogOpen(true)}>
                    Connect wallet
                  </Button>
                </AlertDescription>
              </Alert>
            ) : member ? (
              <Alert>
                <CircleCheck className="text-success" aria-hidden />
                <AlertTitle>You&apos;re a member</AlertTitle>
                <AlertDescription className="space-y-3">
                  <RoleBadges roles={member.roles} />
                  <Button asChild size="sm" className="w-fit">
                    <Link href={`/t/${found.state.id}`}>
                      Open treasury <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <UserX aria-hidden />
                <AlertTitle>Your wallet isn&apos;t a member yet</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Send your address to a treasury admin. Once they add you on-chain, this treasury will appear in your
                    list.
                  </p>
                  <div className="bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1">
                    <code className="min-w-0 flex-1 text-xs break-all">{address}</code>
                    <CopyButton value={address} label="Copy your address" />
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <Link href={`/t/${found.state.id}`}>View read-only</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
