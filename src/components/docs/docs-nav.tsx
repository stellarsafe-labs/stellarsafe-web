"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS } from "./registry";
import { cn } from "@/lib/utils";

export function DocsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="text-sm">
      <ul className="space-y-1">
        {DOCS.map((d) => {
          const href = d.slug ? `/docs/${d.slug}` : "/docs";
          const active = pathname === href;
          return (
            <li key={d.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "hover:bg-muted block rounded-md px-3 py-1.5 transition-colors",
                  active ? "bg-muted text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {d.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
