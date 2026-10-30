import { format, formatDistanceStrict, formatDistanceToNowStrict } from "date-fns";
import { formatAmount } from "@/lib/domain/amount";
import type { Asset } from "@/lib/domain/types";

export const fmtAmount = (units: bigint, asset?: Pick<Asset, "decimals">) =>
  formatAmount(units, { decimals: asset?.decimals, maxFraction: 2 });

export const fmtMoney = (units: bigint, asset: Pick<Asset, "code" | "decimals">) =>
  `${formatAmount(units, { decimals: asset.decimals, maxFraction: 2 })} ${asset.code}`;

export const fmtCompact = (units: bigint, asset?: Pick<Asset, "decimals">) =>
  formatAmount(units, { decimals: asset?.decimals, compact: true });

export const fmtDate = (ms: number) => format(ms, "MMM d, yyyy");
export const fmtDateTime = (ms: number) => format(ms, "MMM d, yyyy · HH:mm");
export const fmtIso = (ms: number) => new Date(ms).toISOString();
export const fmtRelative = (ms: number) => formatDistanceToNowStrict(ms, { addSuffix: true });
export const fmtDuration = (from: number, to: number) => formatDistanceStrict(from, to);

export function fmtTtl(seconds: number): string {
  const days = seconds / 86_400;
  if (Number.isInteger(days)) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.round(seconds / 3600);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function fmtPeriod(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  if (!y || !m) return periodKey;
  return format(Date.UTC(y, m - 1, 15), "MMMM yyyy");
}

/** RFC 4180 CSV with formula-injection protection for spreadsheet apps. */
export function toCsv(rows: Record<string, string | number | undefined>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const cell = (v: string | number | undefined) => {
    let s = v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n");
}

export function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
