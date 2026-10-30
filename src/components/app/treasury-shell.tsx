"use client";

import Link from "next/link";
import { Eye, SearchX } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NetworkBadge } from "@/components/shared/network-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { QueryError } from "@/components/shared/query-error";
import { ContractError } from "@/lib/domain/types";
import { useMe, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";
import { TreasurySidebar } from "./treasury-sidebar";
import { WalletButton } from "./wallet-button";
import { DemoBanner } from "./demo-banner";
import { NetworkWarning } from "./network-warning";

function MembershipNotice({ treasuryId }: { treasuryId: string }) {
  const { address, status, setConnectDialogOpen } = useWallet();
  const state = useTreasuryState(treasuryId);
  const me = useMe(treasuryId);
  if (!state.data || status === "restoring" || (me && me.roles.length > 0)) return null;
  const text = !address
    ? "You're viewing this treasury read-only. Connect a member wallet to propose or approve payments."
    : !me
      ? "Your connected wallet is not a member of this treasury. Everything here is read-only."
      : "Your wallet has view-only access in this treasury.";
  return (
    <div className="bg-muted/50 text-muted-foreground flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm sm:px-6">
      <Eye className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{text}</span>
      {!address && (
        <Button size="xs" variant="outline" onClick={() => setConnectDialogOpen(true)}>
          Connect wallet
        </Button>
      )}
    </div>
  );
}

export function TreasuryShell({ children }: { children: React.ReactNode }) {
  const treasuryId = useTreasuryId();
  const state = useTreasuryState(treasuryId);
  const notFound = state.error instanceof ContractError && state.error.code === "NotInitialized";

  return (
    <SidebarProvider>
      <TreasurySidebar treasuryId={treasuryId} />
      <SidebarInset>
        <DemoBanner />
        <NetworkWarning />
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="-ml-1.5" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <NetworkBadge />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <WalletButton />
          </div>
        </header>
        <MembershipNotice treasuryId={treasuryId} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {notFound ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle>Treasury not found</EmptyTitle>
                <EmptyDescription>
                  No StellarSafe treasury contract exists at <span className="font-mono break-all">{treasuryId}</span>{" "}
                  on this network.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/treasuries">Back to my treasuries</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : state.error && !state.data ? (
            <QueryError error={state.error} retry={() => state.refetch()} title="Couldn't read the treasury contract" />
          ) : (
            children
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function TreasuryShellFallback() {
  return (
    <div className="flex min-h-svh">
      <div className="bg-sidebar hidden w-64 border-r md:block" />
      <div className="flex-1">
        <div className="h-14 border-b" />
      </div>
    </div>
  );
}
