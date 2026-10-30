import { z } from "zod";

/**
 * Public runtime configuration. Everything here is inlined into the client
 * bundle at build time, so never put secrets in NEXT_PUBLIC_* variables.
 */
const schema = z.object({
  dataSource: z.enum(["demo", "live"]).default("demo"),
  network: z.enum(["testnet", "mainnet", "futurenet"]).default("testnet"),
  rpcUrl: z.url().optional(),
  horizonUrl: z.url().optional(),
  apiUrl: z.url().optional(),
  /** Factory contract that deploys new treasury instances (live mode). */
  factoryContractId: z
    .string()
    .regex(/^C[A-Z2-7]{55}$/, "must be a contract address (C...)")
    .optional(),
  siteUrl: z.url().default("http://localhost:3000"),
  /** Optional endpoint that receives client error reports (JSON via sendBeacon). */
  errorReportUrl: z.url().optional(),
  release: z.string().optional(),
  /** Must be explicitly enabled before the UI will talk to mainnet. */
  allowMainnet: z.boolean().default(false),
});

const empty = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

const parsed = schema.safeParse({
  dataSource: empty(process.env.NEXT_PUBLIC_DATA_SOURCE),
  network: empty(process.env.NEXT_PUBLIC_STELLAR_NETWORK),
  rpcUrl: empty(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL),
  horizonUrl: empty(process.env.NEXT_PUBLIC_HORIZON_URL),
  apiUrl: empty(process.env.NEXT_PUBLIC_API_URL),
  factoryContractId: empty(process.env.NEXT_PUBLIC_FACTORY_CONTRACT_ID),
  siteUrl: empty(process.env.NEXT_PUBLIC_SITE_URL),
  errorReportUrl: empty(process.env.NEXT_PUBLIC_ERROR_REPORT_URL),
  release: empty(process.env.NEXT_PUBLIC_RELEASE),
  allowMainnet: process.env.NEXT_PUBLIC_ALLOW_MAINNET === "true",
});

if (!parsed.success) {
  throw new Error(`Invalid StellarSafe environment configuration:\n${z.prettifyError(parsed.error)}`);
}

const cfg = parsed.data;

if (cfg.network === "mainnet" && !cfg.allowMainnet) {
  throw new Error(
    "Refusing to start against mainnet. StellarSafe contracts have not been audited. " +
      "Set NEXT_PUBLIC_ALLOW_MAINNET=true only after an independent security review.",
  );
}

if (cfg.dataSource === "live" && (!cfg.rpcUrl || !cfg.apiUrl)) {
  throw new Error(
    "NEXT_PUBLIC_SOROBAN_RPC_URL and NEXT_PUBLIC_API_URL are required when NEXT_PUBLIC_DATA_SOURCE=live.",
  );
}

export const config = cfg;
export const isDemo = cfg.dataSource === "demo";
export type NetworkName = typeof cfg.network;
