"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/telemetry";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, "boundary", error.digest);
  }, [error]);
  return (
    <main id="main" className="flex min-h-[60svh] flex-col items-center justify-center gap-4 p-6 text-center">
      <CircleAlert className="text-destructive size-10" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md">
        The interface hit an unexpected error. No transaction was signed.{" "}
        {error.digest && <span className="font-mono text-xs">({error.digest})</span>}
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
