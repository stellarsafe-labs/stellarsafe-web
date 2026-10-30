/**
 * Domain model.
 *
 * Types prefixed `OnChain*` are read from the Soroban contracts and are the
 * source of truth for anything that affects money: members, roles, policy,
 * approvals, balances and proposal status.
 *
 * Types suffixed `*Metadata` come from the StellarSafe API (names,
 * descriptions, labels). They are display-only and must never be used to
 * decide whether an action is allowed.
 */

export type Role = "admin" | "approver" | "proposer";
export const ROLES: readonly Role[] = ["admin", "approver", "proposer"] as const;

export interface Asset {
  code: string;
  /** Classic issuer (G...) or undefined for native XLM. */
  issuer?: string;
  /** Stellar Asset Contract (SAC) address. */
  contractId: string;
  decimals: number;
}

export interface Balance {
  asset: Asset;
  amount: bigint;
}

export interface OnChainMember {
  address: string;
  roles: Role[];
  addedAt: number;
}

export interface ApprovalTier {
  /** Applies to payments with amount >= minAmount (base units). */
  minAmount: bigint;
  requiredApprovals: number;
}

export interface AllowlistEntry {
  address: string;
  label: string;
}

export interface Department {
  id: string;
  name: string;
  /** Max outflow per calendar month (UTC), in base units of the managed asset. */
  monthlyLimit: bigint;
}

export interface OnChainPolicy {
  /** Monotonic. Bumping it invalidates approvals on all pending proposals. */
  version: number;
  approvalTiers: ApprovalTier[];
  allowlistEnabled: boolean;
  allowlist: AllowlistEntry[];
  departments: Department[];
  approvalTtlSeconds: number;
  allowSelfApproval: boolean;
  updatedAt: number;
}

export type PolicyInput = Omit<OnChainPolicy, "version" | "updatedAt">;

export interface OnChainApproval {
  approver: string;
  at: number;
  policyVersion: number;
}

export type StoredProposalStatus = "pending" | "executed" | "cancelled";

export interface OnChainProposal {
  id: number;
  treasuryId: string;
  proposer: string;
  recipient: string;
  amount: bigint;
  departmentId: string;
  policyVersion: number;
  createdAt: number;
  expiresAt: number;
  status: StoredProposalStatus;
  approvals: OnChainApproval[];
  executedAt?: number;
  executedTxHash?: string;
  cancelledAt?: number;
  cancelledBy?: string;
  /** sha256 of the off-chain metadata, anchoring the description on-chain. */
  metadataHash?: string;
}

export interface OnChainTreasuryState {
  id: string;
  managedAsset: Asset;
  balances: Balance[];
  members: OnChainMember[];
  policy: OnChainPolicy;
  /** Outflow per department for the current accounting period. */
  periodSpend: Record<string, bigint>;
  periodKey: string;
  createdAt: number;
  proposalCount: number;
  /** Provenance: the ledger these values were read at. */
  ledger: number;
  readAt: number;
}

export interface TreasuryMetadata {
  id: string;
  name: string;
  description?: string;
  memberLabels: Record<string, string>;
}

export interface ProposalMetadata {
  proposalId: number;
  title: string;
  description?: string;
}

export interface TreasurySummary {
  id: string;
  name: string;
  roles: Role[];
  memberCount: number;
  pendingCount: number;
  managedAssetCode: string;
  balance: bigint;
}

export type ActivityType =
  | "treasury_initialized"
  | "deposit"
  | "member_added"
  | "member_removed"
  | "member_roles_changed"
  | "policy_updated"
  | "proposal_created"
  | "proposal_approved"
  | "approval_revoked"
  | "proposal_executed"
  | "proposal_cancelled";

export interface ActivityEvent {
  id: string;
  treasuryId: string;
  type: ActivityType;
  actor: string;
  at: number;
  ledger: number;
  txHash: string;
  proposalId?: number;
  /** Event-specific fields, already decoded. */
  data: Record<string, string | number | boolean>;
}

export interface TransactionRecord {
  id: string;
  direction: "in" | "out";
  amount: bigint;
  asset: Asset;
  counterparty: string;
  at: number;
  ledger: number;
  txHash: string;
  proposalId?: number;
  departmentId?: string;
}

export interface NotificationPreferences {
  email?: string;
  webhookUrl?: string;
  events: {
    approvalRequested: boolean;
    proposalExecuted: boolean;
    policyChanged: boolean;
    memberChanged: boolean;
  };
}

/** Error codes mirrored from the treasury contract's `Error` enum. */
export const CONTRACT_ERRORS = {
  1: "AlreadyInitialized",
  2: "NotInitialized",
  3: "Unauthorized",
  4: "NotMember",
  5: "MemberExists",
  6: "LastAdmin",
  7: "InvalidPolicy",
  8: "RecipientNotAllowed",
  9: "UnknownDepartment",
  10: "InvalidAmount",
  11: "ProposalNotFound",
  12: "ProposalNotPending",
  13: "ProposalExpired",
  14: "AlreadyApproved",
  15: "NotApproved",
  16: "SelfApprovalForbidden",
  17: "InsufficientApprovals",
  18: "PolicyVersionMismatch",
  19: "MonthlyLimitExceeded",
  20: "InsufficientBalance",
} as const;

export type ContractErrorName = (typeof CONTRACT_ERRORS)[keyof typeof CONTRACT_ERRORS];

const ERROR_MESSAGES: Record<ContractErrorName, string> = {
  AlreadyInitialized: "This treasury has already been initialized.",
  NotInitialized: "This contract has not been initialized as a treasury.",
  Unauthorized: "Your wallet does not have permission to perform this action.",
  NotMember: "That address is not a member of this treasury.",
  MemberExists: "That address is already a member.",
  LastAdmin: "A treasury must keep at least one admin.",
  InvalidPolicy: "The policy is invalid.",
  RecipientNotAllowed: "The recipient is not on the treasury allowlist.",
  UnknownDepartment: "That department does not exist in the current policy.",
  InvalidAmount: "The amount must be greater than zero.",
  ProposalNotFound: "Proposal not found.",
  ProposalNotPending: "This proposal is no longer pending.",
  ProposalExpired: "This proposal's approval window has expired.",
  AlreadyApproved: "You have already approved this proposal.",
  NotApproved: "You have not approved this proposal.",
  SelfApprovalForbidden: "Policy forbids approving your own proposal.",
  InsufficientApprovals: "Not enough valid approvals to execute.",
  PolicyVersionMismatch: "The policy changed after this proposal was created, so its approvals are no longer valid.",
  MonthlyLimitExceeded: "This payment would exceed the department's monthly limit.",
  InsufficientBalance: "The treasury balance is too low for this payment.",
};

export class ContractError extends Error {
  constructor(
    public readonly code: ContractErrorName,
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "ContractError";
  }
}

export function contractErrorFromCode(code: number): ContractError | null {
  const name = CONTRACT_ERRORS[code as keyof typeof CONTRACT_ERRORS];
  return name ? new ContractError(name) : null;
}
