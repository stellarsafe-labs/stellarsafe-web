"use client";

import Link from "next/link";
import { Check, ChevronDown, Copy, LayoutGrid, LogOut, UserRoundCog, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Identicon } from "@/components/shared/identicon";
import { isDemo } from "@/lib/config";
import { DEMO_PERSONAS, personaByAddress } from "@/lib/data/demo/personas";
import { shortAddress } from "@/lib/stellar/address";
import { useWallet } from "@/lib/wallet/wallet-provider";

export function WalletButton({ className }: { className?: string }) {
  const { status, address, disconnect, connect, setConnectDialogOpen, wallet } = useWallet();

  if (status === "restoring") return <Skeleton className="h-8 w-36" />;

  if (!address) {
    return (
      <Button className={className} onClick={() => setConnectDialogOpen(true)} disabled={status === "connecting"}>
        <Wallet aria-hidden /> {isDemo ? "Try the demo" : "Connect wallet"}
      </Button>
    );
  }

  const persona = personaByAddress(address);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={className}
          aria-label={`Wallet menu, connected as ${persona?.name ?? address}`}
        >
          <Identicon value={address} className="size-5 rounded" />
          <span className="max-w-32 truncate">{persona?.name ?? shortAddress(address)}</span>
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="text-muted-foreground block text-xs">Connected with {wallet?.name}</span>
          <span className="block font-mono text-xs break-all">{address}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={async () => {
              await navigator.clipboard.writeText(address);
              toast.success("Address copied");
            }}
          >
            <Copy aria-hidden /> Copy address
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/treasuries">
              <LayoutGrid aria-hidden /> My treasuries
            </Link>
          </DropdownMenuItem>
          {isDemo && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserRoundCog aria-hidden /> Switch persona
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {DEMO_PERSONAS.map((p) => (
                  <DropdownMenuItem
                    key={p.key}
                    onSelect={() =>
                      connect("demo", p.key).then(() =>
                        toast.success(`Now acting as ${p.name}`, { description: p.title }),
                      )
                    }
                  >
                    <Identicon value={p.address} className="size-5 rounded" />
                    <span className="flex-1">
                      {p.name}
                      <span className="text-muted-foreground block text-xs">{p.title}</span>
                    </span>
                    {p.address === address && <Check aria-label="current" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={disconnect}>
          <LogOut aria-hidden /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
