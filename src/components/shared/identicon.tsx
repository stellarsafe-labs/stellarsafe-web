import { cn } from "@/lib/utils";

/** Deterministic 5x5 symmetric identicon so addresses are visually distinguishable. */
export function Identicon({ value, className }: { value: string; className?: string }) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  const hue = Math.abs(h) % 360;
  const cells: boolean[] = [];
  let bits = Math.abs(h);
  for (let i = 0; i < 15; i++) {
    cells.push((bits & 1) === 1);
    bits = bits >>> 1 || Math.abs(Math.imul(h, i + 7));
  }
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (!cells[y * 3 + x]) continue;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
      if (x < 2) rects.push(<rect key={`m${x}-${y}`} x={4 - x} y={y} width={1} height={1} />);
    }
  }
  return (
    <svg
      viewBox="-0.5 -0.5 6 6"
      aria-hidden
      className={cn("size-7 shrink-0 rounded-md", className)}
      style={{ background: `oklch(0.94 0.04 ${hue})`, fill: `oklch(0.55 0.15 ${hue})` }}
    >
      {rects}
    </svg>
  );
}
