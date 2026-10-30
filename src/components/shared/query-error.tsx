"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function QueryError({
  error,
  retry,
  title = "Couldn't load data",
}: {
  error: unknown;
  retry?: () => void;
  title?: string;
}) {
  return (
    <Alert variant="destructive" className="items-start">
      <CircleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{error instanceof Error ? error.message : "Unknown error"}</span>
        {retry && (
          <Button size="sm" variant="outline" className="w-fit" onClick={retry}>
            <RotateCw aria-hidden /> Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
