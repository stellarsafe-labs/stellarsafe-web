import { reportError } from "@/lib/telemetry";

try {
  window.addEventListener("error", (event) => reportError(event.error ?? event.message, "error"));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason, "unhandledrejection"));
} catch {
  // instrumentation must never break the app
}
