import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import type { PolicyCheck } from "@/lib/domain/policy";
import { cn } from "@/lib/utils";

const ICON = {
  pass: { icon: CircleCheck, className: "text-success", sr: "Passes" },
  fail: { icon: CircleX, className: "text-destructive", sr: "Fails" },
  waiting: { icon: CircleDashed, className: "text-muted-foreground", sr: "Waiting" },
} as const;

export function PolicyChecks({ checks, className }: { checks: PolicyCheck[]; className?: string }) {
  return (
    <ul className={cn("divide-y rounded-lg border", className)}>
      {checks.map((c) => {
        const s = ICON[c.status];
        const Icon = s.icon;
        return (
          <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
            <Icon className={cn("mt-0.5 size-4 shrink-0", s.className)} aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                <span className="sr-only">{s.sr}: </span>
                {c.label}
              </p>
              <p className="text-muted-foreground">{c.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
