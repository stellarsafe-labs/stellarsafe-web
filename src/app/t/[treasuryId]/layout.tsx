import { Suspense } from "react";
import type { Metadata } from "next";
import { TreasuryShell, TreasuryShellFallback } from "@/components/app/treasury-shell";

export const metadata: Metadata = {
  title: "Treasury",
  robots: { index: false },
};

export default function TreasuryLayout({ children }: LayoutProps<"/t/[treasuryId]">) {
  // The treasury id is only known at request time, so the shell resolves inside Suspense.
  return (
    <Suspense fallback={<TreasuryShellFallback />}>
      <TreasuryShell>{children}</TreasuryShell>
    </Suspense>
  );
}
