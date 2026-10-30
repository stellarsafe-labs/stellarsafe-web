import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <Compass className="text-muted-foreground size-10" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild>
          <Link href="/treasuries">Your treasuries</Link>
        </Button>
      </div>
    </main>
  );
}
