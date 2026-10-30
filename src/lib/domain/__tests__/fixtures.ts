import { toUnits } from "../amount";
import type { OnChainPolicy, OnChainProposal, OnChainTreasuryState } from "../types";
import { demoAccount, demoContract } from "@/lib/data/demo/personas";

export const A = {
  admin: demoAccount("t-admin"),
  approver1: demoAccount("t-approver1"),
  approver2: demoAccount("t-approver2"),
  proposer: demoAccount("t-proposer"),
  vendor: demoAccount("t-vendor"),
  stranger: demoAccount("t-stranger"),
};

export const NOW = Date.UTC(2026, 9, 15, 12);
export const asset = { code: "USDC", contractId: demoContract("t-usdc"), decimals: 7 };

export function policy(over: Partial<OnChainPolicy> = {}): OnChainPolicy {
  return {
    version: 1,
    approvalTiers: [
      { minAmount: 0n, requiredApprovals: 1 },
      { minAmount: toUnits(500), requiredApprovals: 2 },
    ],
    allowlistEnabled: true,
    allowlist: [{ address: A.vendor, label: "Vendor" }],
    departments: [{ id: "eng", name: "Engineering", monthlyLimit: toUnits(1000) }],
    approvalTtlSeconds: 7 * 86400,
    allowSelfApproval: false,
    updatedAt: NOW,
    ...over,
  };
}

export function state(over: Partial<OnChainTreasuryState> = {}): OnChainTreasuryState {
  return {
    id: demoContract("t-treasury"),
    managedAsset: asset,
    balances: [{ asset, amount: toUnits(10_000) }],
    members: [
      { address: A.admin, roles: ["admin", "approver"], addedAt: 0 },
      { address: A.approver1, roles: ["approver"], addedAt: 0 },
      { address: A.approver2, roles: ["approver"], addedAt: 0 },
      { address: A.proposer, roles: ["proposer"], addedAt: 0 },
    ],
    policy: policy(),
    periodSpend: {},
    periodKey: "2026-10",
    createdAt: 0,
    proposalCount: 1,
    ledger: 1,
    readAt: NOW,
    ...over,
  };
}

export function proposal(over: Partial<OnChainProposal> = {}): OnChainProposal {
  return {
    id: 1,
    treasuryId: demoContract("t-treasury"),
    proposer: A.proposer,
    recipient: A.vendor,
    amount: toUnits(100),
    departmentId: "eng",
    policyVersion: 1,
    createdAt: NOW - 3600_000,
    expiresAt: NOW + 86_400_000,
    status: "pending",
    approvals: [],
    ...over,
  };
}
