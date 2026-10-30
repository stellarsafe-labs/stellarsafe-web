/**
 * Content-Security-Policy. Scripts must carry the per-request nonce
 * ('strict-dynamic' lets Next's nonce'd loader pull in its chunks), so an
 * injected <script> can never run. Inline *style attributes* stay allowed
 * because UI primitives position popovers with them; they can't execute code.
 */
export function buildCsp(nonce: string, isDev = process.env.NODE_ENV !== "production"): string {
  const connect = [
    "'self'",
    "https://*.stellar.org",
    "https://mainnet.sorobanrpc.com",
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
    process.env.NEXT_PUBLIC_HORIZON_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_ERROR_REPORT_URL,
    isDev ? "ws:" : undefined,
  ]
    .filter((u): u is string => !!u)
    .map((u) => (u.startsWith("http") ? new URL(u).origin : u));

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${[...new Set(connect)].join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
