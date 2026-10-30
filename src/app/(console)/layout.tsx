import { Topbar } from "@/components/app/topbar";
import { DemoBanner } from "@/components/app/demo-banner";
import { NetworkWarning } from "@/components/app/network-warning";

export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <DemoBanner />
      <NetworkWarning />
      <Topbar />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        {children}
      </main>
    </div>
  );
}
