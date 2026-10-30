import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ORG_URL, REPOS } from "@/lib/links";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo />
          <p className="text-muted-foreground max-w-sm text-sm">
            Open-source treasury and policy engine for the Stellar ecosystem. Testnet software — not yet audited.
          </p>
        </div>
        <nav aria-label="Product" className="space-y-2 text-sm">
          <p className="font-medium">Product</p>
          <ul className="text-muted-foreground space-y-2">
            <li>
              <Link href="/treasuries" className="hover:text-foreground">
                Open app
              </Link>
            </li>
            <li>
              <Link href="/docs" className="hover:text-foreground">
                Documentation
              </Link>
            </li>
            <li>
              <Link href="/docs/security" className="hover:text-foreground">
                Security model
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Source code" className="space-y-2 text-sm">
          <p className="font-medium">Open source</p>
          <ul className="text-muted-foreground space-y-2">
            {REPOS.map((r) => (
              <li key={r.name}>
                <a href={`${ORG_URL}/${r.name}`} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  {r.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
