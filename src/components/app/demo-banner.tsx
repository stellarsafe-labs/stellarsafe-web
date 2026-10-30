"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { isDemo } from "@/lib/config";
import { getDemoSource } from "@/lib/data";

export function DemoBanner() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  if (!isDemo) return null;
  return (
    <div className="bg-chart-4/10 text-foreground flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs">
      <FlaskConical className="text-chart-4 size-3.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium">Demo mode.</strong> A simulated contract runs in your browser with the same
        policy rules. No real funds.
      </span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="link" size="xs" className="h-auto p-0 text-xs">
            <RotateCcw aria-hidden /> Reset
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This restores the sample treasuries and discards anything you created or approved in this browser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my changes</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                getDemoSource()?.reset();
                await queryClient.resetQueries();
                toast.success("Demo data reset");
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
