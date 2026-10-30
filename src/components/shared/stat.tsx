import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="space-y-1 px-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          {Icon && <Icon className="size-4" aria-hidden />}
          {label}
        </p>
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}
