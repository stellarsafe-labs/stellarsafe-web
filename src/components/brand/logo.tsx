import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="ss-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.19 268)" />
          <stop offset="1" stopColor="oklch(0.45 0.2 285)" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 4.5 7v8.2c0 7.1 4.9 12.5 11.5 14.3 6.6-1.8 11.5-7.2 11.5-14.3V7L16 2.5Z" fill="url(#ss-g)" />
      <path d="m16 9 1.9 4.6 4.9.4-3.7 3.2 1.1 4.8L16 19.4 11.8 22l1.1-4.8L9.2 14l4.9-.4L16 9Z" fill="white" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>StellarSafe</span>
    </span>
  );
}
