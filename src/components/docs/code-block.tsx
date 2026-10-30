import { CopyButton } from "@/components/shared/copy-button";
import { cn } from "@/lib/utils";

export function CodeBlock({ code, filename, className }: { code: string; filename?: string; className?: string }) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-xl border bg-zinc-950 text-zinc-100 shadow-sm dark:bg-zinc-900",
        className,
      )}
    >
      <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-zinc-400">
        <span className="font-mono">{filename ?? "code"}</span>
        <span className="[&_button]:text-zinc-400 [&_button:hover]:bg-white/10 [&_button:hover]:text-zinc-100">
          <CopyButton value={code} label="Copy code" />
        </span>
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={filename ? `Code: ${filename}` : "Code sample"}
        className="focus-visible:ring-ring overflow-x-auto p-4 text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <code className="font-mono">{code}</code>
      </pre>
    </figure>
  );
}
