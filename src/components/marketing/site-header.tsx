import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { REPO_URL } from "@/lib/links";

export function SiteHeader() {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md outline-none focus-visible:ring-2"
          aria-label="StellarSafe home"
        >
          <Logo />
        </Link>
        <nav aria-label="Main" className="text-muted-foreground hidden items-center gap-5 text-sm md:flex">
          <Link href="/#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/#security" className="hover:text-foreground">
            Security
          </Link>
          <Link href="/#developers" className="hover:text-foreground">
            Developers
          </Link>
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Button asChild>
            <Link href="/treasuries">Open app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
