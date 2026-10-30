import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepNav({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                i < current && "border-primary bg-primary text-primary-foreground",
                i === current && "border-primary text-primary",
                i > current && "text-muted-foreground",
              )}
              aria-current={i === current ? "step" : undefined}
            >
              {i < current ? <Check className="size-3.5" aria-label="completed" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", i === current ? "font-medium" : "text-muted-foreground")}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="bg-border h-px flex-1" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
