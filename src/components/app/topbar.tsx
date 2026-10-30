import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NetworkBadge } from "@/components/shared/network-badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { WalletButton } from "./wallet-button";

export function Topbar() {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md outline-none focus-visible:ring-2"
          aria-label="StellarSafe home"
        >
          <Logo />
        </Link>
        <NetworkBadge className="hidden sm:inline-flex" />
        <nav className="ml-auto flex items-center gap-1" aria-label="Account">
          <Link
            href="/docs"
            className="text-muted-foreground hover:text-foreground hidden rounded-md px-2 py-1 text-sm sm:block"
          >
            Docs
          </Link>
          <ThemeToggle />
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
