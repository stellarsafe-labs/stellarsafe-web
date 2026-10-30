"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TxProvider } from "@/components/tx/tx-provider";
import { ConnectWalletDialog } from "@/components/app/connect-wallet-dialog";
import { WalletProvider } from "@/lib/wallet/wallet-provider";
import { ContractError } from "@/lib/domain/types";
import { getDemoSource } from "@/lib/data";
import { STORAGE_KEY } from "@/lib/data/demo/db";
import { isDemo } from "@/lib/config";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchOnWindowFocus: true,
        // Contract errors (e.g. treasury not found) are deterministic; don't retry them.
        retry: (count, error) => !(error instanceof ContractError) && count < 2,
      },
    },
  });
}

/** Keeps several demo tabs in sync, so you can play two signers side by side. */
function DemoTabSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isDemo) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      getDemoSource()?.refresh();
      void queryClient.invalidateQueries();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delayDuration={200}>
          <WalletProvider>
            <TxProvider>
              {children}
              <DemoTabSync />
              <ConnectWalletDialog />
            </TxProvider>
          </WalletProvider>
          <Toaster closeButton position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
