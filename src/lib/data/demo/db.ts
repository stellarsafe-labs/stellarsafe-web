import type {
  ActivityEvent,
  Asset,
  NotificationPreferences,
  OnChainMember,
  OnChainPolicy,
  OnChainProposal,
  ProposalMetadata,
  TransactionRecord,
  TreasuryMetadata,
} from "@/lib/domain/types";

/** Contract storage of one simulated treasury, plus what the API/indexer would hold. */
export interface DemoTreasury {
  chain: {
    id: string;
    managedAsset: Asset;
    balances: Record<string, bigint>; // asset contractId -> amount
    members: OnChainMember[];
    policy: OnChainPolicy;
    /** periodKey -> departmentId -> spent */
    spend: Record<string, Record<string, bigint>>;
    createdAt: number;
    nextProposalId: number;
  };
  proposals: OnChainProposal[];
  metadata: TreasuryMetadata;
  proposalMeta: Record<number, ProposalMetadata>;
  activity: ActivityEvent[];
  transactions: TransactionRecord[];
  prefs: Record<string, NotificationPreferences>;
}

export interface DemoDB {
  schema: 2;
  seededAt: number;
  treasuries: Record<string, DemoTreasury>;
}

export const STORAGE_KEY = "stellarsafe:demo-chain";

const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? { $big: v.toString() } : v);

const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "$big" in v && typeof (v as { $big: unknown }).$big === "string"
    ? BigInt((v as { $big: string }).$big)
    : v;

export const serialize = (db: DemoDB) => JSON.stringify(db, replacer);
export const deserialize = (raw: string) => JSON.parse(raw, reviver) as DemoDB;

/** Simulated ledger sequence: one ledger every ~5 seconds. */
export const ledgerAt = (at: number) => Math.floor(at / 5000) - 300_000_000;

export function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Deterministic PRNG so the seeded history is stable across reloads. */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededHex(rand: () => number, bytes = 32): string {
  let s = "";
  for (let i = 0; i < bytes; i++)
    s += Math.floor(rand() * 256)
      .toString(16)
      .padStart(2, "0");
  return s;
}
