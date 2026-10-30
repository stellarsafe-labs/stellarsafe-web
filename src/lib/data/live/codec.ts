/**
 * Encoding/decoding between the domain model and the StellarSafe contract ABI.
 * The expected ABI is documented at /docs/contract-interface (src/components/docs/registry.tsx) and must stay
 * in sync with stellarsafe-contracts.
 *
 * Conventions: timestamps are u64 seconds on-chain and ms in the app;
 * amounts are i128 base units; roles are Symbols.
 */
import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import type {
  Asset,
  OnChainMember,
  OnChainPolicy,
  OnChainProposal,
  PolicyInput,
  Role,
  StoredProposalStatus,
} from "@/lib/domain/types";
import { ROLES } from "@/lib/domain/types";

/* ---------------- encode ---------------- */

/** Soroban `#[contracttype]` structs are maps with Symbol keys sorted lexicographically. */
export function struct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map((k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: fields[k] })),
  );
}

export const addr = (a: string) => new Address(a).toScVal();
export const i128 = (v: bigint) => nativeToScVal(v, { type: "i128" });
export const u64 = (v: number | bigint) => nativeToScVal(BigInt(v), { type: "u64" });
export const u32 = (v: number) => nativeToScVal(v, { type: "u32" });
export const sym = (s: string) => xdr.ScVal.scvSymbol(s);
export const str = (s: string) => nativeToScVal(s, { type: "string" });
export const vec = (items: xdr.ScVal[]) => xdr.ScVal.scvVec(items);
export const bool = (b: boolean) => xdr.ScVal.scvBool(b);

export const encodeRoles = (roles: Role[]) => vec(roles.map((r) => sym(r)));

export function encodeMember(m: { address: string; roles: Role[] }) {
  return struct({ address: addr(m.address), roles: encodeRoles(m.roles) });
}

export function encodePolicy(p: PolicyInput): xdr.ScVal {
  return struct({
    approval_tiers: vec(
      p.approvalTiers.map((t) =>
        struct({ min_amount: i128(t.minAmount), required_approvals: u32(t.requiredApprovals) }),
      ),
    ),
    allowlist_enabled: bool(p.allowlistEnabled),
    allowlist: vec(p.allowlist.map((a) => struct({ address: addr(a.address), label: str(a.label) }))),
    departments: vec(
      p.departments.map((d) => struct({ id: sym(d.id), name: str(d.name), monthly_limit: i128(d.monthlyLimit) })),
    ),
    approval_ttl: u64(p.approvalTtlSeconds),
    allow_self_approval: bool(p.allowSelfApproval),
  });
}

/* ---------------- decode ---------------- */

type Raw = Record<string, unknown>;

const ms = (v: unknown) => Number(v) * 1000;
const num = (v: unknown) => Number(v);
const big = (v: unknown) => (typeof v === "bigint" ? v : BigInt(v as string | number));
const text = (v: unknown) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v));

export const native = (v: xdr.ScVal) => scValToNative(v) as unknown;

function decodeRoles(v: unknown): Role[] {
  return (v as unknown[]).map(text).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
}

export function decodeMember(raw: Raw): OnChainMember {
  return { address: String(raw.address), roles: decodeRoles(raw.roles), addedAt: ms(raw.added_at) };
}

export function decodePolicy(raw: Raw): OnChainPolicy {
  return {
    version: num(raw.version),
    approvalTiers: (raw.approval_tiers as Raw[]).map((t) => ({
      minAmount: big(t.min_amount),
      requiredApprovals: num(t.required_approvals),
    })),
    allowlistEnabled: Boolean(raw.allowlist_enabled),
    allowlist: (raw.allowlist as Raw[]).map((a) => ({ address: String(a.address), label: text(a.label) })),
    departments: (raw.departments as Raw[]).map((d) => ({
      id: text(d.id),
      name: text(d.name),
      monthlyLimit: big(d.monthly_limit),
    })),
    approvalTtlSeconds: num(raw.approval_ttl),
    allowSelfApproval: Boolean(raw.allow_self_approval),
    updatedAt: ms(raw.updated_at),
  };
}

const STATUS: Record<string, StoredProposalStatus> = {
  Pending: "pending",
  Executed: "executed",
  Cancelled: "cancelled",
};

export function decodeProposal(treasuryId: string, raw: Raw): OnChainProposal {
  // Unit enum variants decode as ["Variant"].
  const statusRaw = Array.isArray(raw.status) ? text(raw.status[0]) : text(raw.status);
  const status = STATUS[statusRaw];
  if (!status) throw new Error(`Unknown proposal status from contract: ${statusRaw}`);
  return {
    id: num(raw.id),
    treasuryId,
    proposer: String(raw.proposer),
    recipient: String(raw.recipient),
    amount: big(raw.amount),
    departmentId: text(raw.department),
    policyVersion: num(raw.policy_version),
    createdAt: ms(raw.created_at),
    expiresAt: ms(raw.expires_at),
    status,
    approvals: (raw.approvals as Raw[]).map((a) => ({
      approver: String(a.approver),
      at: ms(a.at),
      policyVersion: num(a.policy_version),
    })),
    executedAt: raw.executed_at != null ? ms(raw.executed_at) : undefined,
    cancelledAt: raw.cancelled_at != null ? ms(raw.cancelled_at) : undefined,
    cancelledBy: raw.cancelled_by != null ? String(raw.cancelled_by) : undefined,
    metadataHash:
      raw.metadata_hash instanceof Uint8Array
        ? Array.from(raw.metadata_hash, (b) => b.toString(16).padStart(2, "0")).join("")
        : undefined,
  };
}

export function decodeSpend(raw: unknown): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Raw)) out[k] = big(v);
  }
  return out;
}

export interface DecodedConfig {
  asset: Asset;
  createdAt: number;
  proposalCount: number;
  periodKey: string;
}

/** Parse `Error(Contract, #13)` out of a simulation/diagnostic error string. */
export function contractErrorCode(message: string): number | null {
  const m = /Error\(Contract, #(\d+)\)/.exec(message);
  return m ? Number(m[1]) : null;
}
