import { config } from "@/lib/config";

/**
 * Minimal, dependency-free error reporting. Sends nothing unless
 * NEXT_PUBLIC_ERROR_REPORT_URL is set. Only the path is sent (no query string
 * or hash), and no wallet signatures, XDR or form contents are ever included.
 */
export interface ErrorReport {
  message: string;
  name?: string;
  stack?: string;
  digest?: string;
  source: "boundary" | "global" | "unhandledrejection" | "error" | "tx";
  path: string;
  release?: string;
  at: string;
}

const MAX_PER_SESSION = 20;
let sent = 0;
const seen = new Set<string>();

export function buildReport(error: unknown, source: ErrorReport["source"], digest?: string): ErrorReport {
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  return {
    message: e.message.slice(0, 500),
    name: e.name,
    stack: e.stack?.split("\n").slice(0, 15).join("\n"),
    digest,
    source,
    path: typeof window === "undefined" ? "" : window.location.pathname,
    release: config.release,
    at: new Date().toISOString(),
  };
}

export function reportError(error: unknown, source: ErrorReport["source"], digest?: string): void {
  if (process.env.NODE_ENV !== "production") console.error(`[${source}]`, error);
  if (!config.errorReportUrl || typeof window === "undefined") return;
  const report = buildReport(error, source, digest);
  const key = `${report.source}:${report.message}`;
  if (seen.has(key) || sent >= MAX_PER_SESSION) return;
  seen.add(key);
  sent++;
  const body = JSON.stringify(report);
  try {
    if (!navigator.sendBeacon?.(config.errorReportUrl, new Blob([body], { type: "application/json" }))) {
      void fetch(config.errorReportUrl, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // never let reporting break the app
  }
}
