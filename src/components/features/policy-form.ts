import { z } from "zod";
import { formatAmount, tryParseAmount } from "@/lib/domain/amount";
import type { OnChainPolicy, PolicyInput } from "@/lib/domain/types";
import { isStellarAddress } from "@/lib/stellar/address";

const amountStr = (allowZero: boolean) =>
  z
    .string()
    .trim()
    .refine(
      (v) => {
        const p = tryParseAmount(v);
        return p !== null && (allowZero ? p >= 0n : p > 0n);
      },
      allowZero ? "Enter 0 or more" : "Enter an amount greater than 0",
    );

export const policyFormSchema = z.object({
  tiers: z
    .array(z.object({ minAmount: amountStr(true), requiredApprovals: z.number().int().min(1, "At least 1").max(20) }))
    .min(1, "Add at least one tier"),
  allowlistEnabled: z.boolean(),
  allowlist: z.array(
    z.object({
      address: z.string().trim().refine(isStellarAddress, "Invalid Stellar address"),
      label: z.string().trim().min(1, "Add a label").max(40),
    }),
  ),
  departments: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_]{1,32}$/, "Lowercase letters, digits, _ (max 32)"),
        name: z.string().trim().min(1, "Name required").max(40),
        monthlyLimit: amountStr(false),
      }),
    )
    .min(1, "Add at least one department"),
  approvalTtlDays: z.number().min(1, "At least 1 day").max(90, "At most 90 days"),
  allowSelfApproval: z.boolean(),
});

export type PolicyFormValues = z.infer<typeof policyFormSchema>;

const fmt = (u: bigint) => formatAmount(u, { grouping: false, maxFraction: 7 });

export function policyToForm(p: OnChainPolicy | PolicyInput): PolicyFormValues {
  return {
    tiers: [...p.approvalTiers]
      .sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1))
      .map((t) => ({ minAmount: fmt(t.minAmount), requiredApprovals: t.requiredApprovals })),
    allowlistEnabled: p.allowlistEnabled,
    allowlist: p.allowlist.map((a) => ({ ...a })),
    departments: p.departments.map((d) => ({ id: d.id, name: d.name, monthlyLimit: fmt(d.monthlyLimit) })),
    approvalTtlDays: Math.round((p.approvalTtlSeconds / 86_400) * 100) / 100,
    allowSelfApproval: p.allowSelfApproval,
  };
}

export function formToPolicy(v: PolicyFormValues): PolicyInput {
  return {
    approvalTiers: v.tiers
      .map((t) => ({ minAmount: tryParseAmount(t.minAmount) ?? 0n, requiredApprovals: t.requiredApprovals }))
      .sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1)),
    allowlistEnabled: v.allowlistEnabled,
    allowlist: v.allowlist.map((a) => ({ address: a.address.trim(), label: a.label.trim() })),
    departments: v.departments.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      monthlyLimit: tryParseAmount(d.monthlyLimit) ?? 0n,
    })),
    approvalTtlSeconds: Math.round(v.approvalTtlDays * 86_400),
    allowSelfApproval: v.allowSelfApproval,
  };
}

export function slugify(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28) || "dept";
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}_${i}`;
  return id;
}

/** Human-readable list of differences between two policies. */
export function diffPolicy(a: PolicyInput, b: PolicyInput, code: string): string[] {
  const out: string[] = [];
  const f = (u: bigint) => `${formatAmount(u)} ${code}`;
  const tiers = (p: PolicyInput) =>
    p.approvalTiers
      .map((t) => `${t.minAmount === 0n ? "any amount" : `≥ ${f(t.minAmount)}`}: ${t.requiredApprovals}`)
      .join(", ");
  if (tiers(a) !== tiers(b)) out.push(`Approval tiers: ${tiers(a)} → ${tiers(b)}`);
  if (a.allowlistEnabled !== b.allowlistEnabled)
    out.push(`Recipient allowlist ${b.allowlistEnabled ? "enabled" : "disabled"}`);
  const aAddr = new Set(a.allowlist.map((x) => x.address));
  const bAddr = new Set(b.allowlist.map((x) => x.address));
  for (const x of b.allowlist) if (!aAddr.has(x.address)) out.push(`Allowlist + ${x.label}`);
  for (const x of a.allowlist) if (!bAddr.has(x.address)) out.push(`Allowlist − ${x.label}`);
  const aD = new Map(a.departments.map((d) => [d.id, d]));
  const bD = new Map(b.departments.map((d) => [d.id, d]));
  for (const d of b.departments) {
    const prev = aD.get(d.id);
    if (!prev) out.push(`New department ${d.name} (${f(d.monthlyLimit)}/month)`);
    else if (prev.monthlyLimit !== d.monthlyLimit)
      out.push(`${d.name} limit ${f(prev.monthlyLimit)} → ${f(d.monthlyLimit)}`);
    else if (prev.name !== d.name) out.push(`Department renamed ${prev.name} → ${d.name}`);
  }
  for (const d of a.departments) if (!bD.has(d.id)) out.push(`Removed department ${d.name}`);
  if (a.approvalTtlSeconds !== b.approvalTtlSeconds) {
    out.push(`Approval window ${a.approvalTtlSeconds / 86_400} → ${b.approvalTtlSeconds / 86_400} days`);
  }
  if (a.allowSelfApproval !== b.allowSelfApproval) {
    out.push(`Self-approval ${b.allowSelfApproval ? "allowed" : "forbidden"}`);
  }
  return out;
}
