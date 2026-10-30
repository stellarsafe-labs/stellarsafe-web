"use client";

import Link from "next/link";
import { Inbox, Landmark, Plus, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError } from "@/components/shared/query-error";
import { RoleBadges } from "@/components/shared/role-badges";
import { formatAmount } from "@/lib/domain/amount";
import { useMyTreasuries } from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";

export function TreasuriesView() {
  const { address, status, setConnectDialogOpen } = useWallet();
  const list = useMyTreasuries();

  const actions = (
    <>
      <Button asChild variant="outline">
        <Link href="/treasuries/join">
          <UserPlus aria-hidden /> Join existing
        </Link>
      </Button>
      <Button asChild>
        <Link href="/treasuries/new">
          <Plus aria-hidden /> Create treasury
        </Link>
      </Button>
    </>
  );

  if (status === "restoring") return <Skeleton className="h-64" />;

  if (!address) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Wallet />
          </EmptyMedia>
          <EmptyTitle>Connect a wallet to see your treasuries</EmptyTitle>
          <EmptyDescription>Membership is read from each treasury contract using your wallet address.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setConnectDialogOpen(true)}>Connect wallet</Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <PageHeader
        title="Your treasuries"
        description="Treasuries where your connected wallet holds a membership."
        actions={actions}
      />
      {list.error ? (
        <QueryError error={list.error} retry={() => list.refetch()} />
      ) : !list.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Landmark />
            </EmptyMedia>
            <EmptyTitle>No treasuries yet</EmptyTitle>
            <EmptyDescription>
              Deploy a new treasury with your team&apos;s rules, or ask an admin of an existing one to add your address.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">{actions}</EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.data.map((t) => (
            <li key={t.id}>
              <Card className="focus-within:ring-ring relative h-full transition-shadow focus-within:ring-2 hover:shadow-md">
                <CardHeader>
                  <CardTitle>
                    <Link href={`/t/${t.id}`} className="outline-none after:absolute after:inset-0">
                      {t.name}
                    </Link>
                  </CardTitle>
                  <p className="text-muted-foreground font-mono text-xs">
                    {t.id.slice(0, 8)}…{t.id.slice(-6)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="tabular text-2xl font-semibold tracking-tight">
                    {formatAmount(t.balance)}{" "}
                    <span className="text-muted-foreground text-sm font-normal">{t.managedAssetCode}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">{t.memberCount} members</p>
                </CardContent>
                <CardFooter className="justify-between gap-2">
                  <RoleBadges roles={t.roles} />
                  {t.pendingCount > 0 && (
                    <span className="text-info inline-flex items-center gap-1 text-xs">
                      <Inbox className="size-3.5" aria-hidden /> {t.pendingCount} open
                    </span>
                  )}
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
