import { Suspense } from "react";
import type { Metadata } from "next";
import { ConnectView } from "@/components/views/connect-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Connect wallet" };

export default function ConnectPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-4xl" />}>
      <ConnectView />
    </Suspense>
  );
}
