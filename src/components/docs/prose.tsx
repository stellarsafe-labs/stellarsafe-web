import { cn } from "@/lib/utils";

/** Lightweight typography for docs without pulling in a typography plugin. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-3xl space-y-4 text-[15px] leading-7 text-pretty",
        "[&_h2]:mt-10 [&_h2]:scroll-mt-20 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:mt-6 [&_h3]:font-semibold",
        "[&_p]:text-muted-foreground [&_li]:text-muted-foreground",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:decoration-2",
        "[&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:text-foreground [&_:not(pre)>code]:rounded [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[13px]",
        "[&_strong]:text-foreground [&_strong]:font-medium",
        "[&_td]:text-muted-foreground [&_table]:w-full [&_table]:text-sm [&_td]:border-b [&_td]:py-2 [&_td]:align-top [&_th]:border-b [&_th]:py-2 [&_th]:text-left [&_th]:font-medium",
        className,
      )}
    >
      {children}
    </div>
  );
}
