import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers/providers";
import { config } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: "StellarSafe — Policy-enforced treasuries on Stellar",
    template: "%s · StellarSafe",
  },
  description:
    "Open-source treasury and policy engine for Stellar organizations. Approval thresholds, recipient allowlists, monthly budgets and expiring approvals — enforced by Soroban smart contracts.",
  applicationName: "StellarSafe",
  keywords: ["Stellar", "Soroban", "treasury", "multisig", "USDC", "policy engine", "DAO"],
  openGraph: {
    type: "website",
    siteName: "StellarSafe",
    title: "StellarSafe — Policy-enforced treasuries on Stellar",
    description: "Spending rules your team can't bypass, enforced on-chain by Soroban contracts.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#14151c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="focus:bg-background focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:shadow-md focus:ring-2"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
