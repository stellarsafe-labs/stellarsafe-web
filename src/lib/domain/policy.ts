/**
 * Pure policy evaluation that mirrors the treasury contract's checks.
 *
 * The web app uses these functions to *preview* what the contract will do
 * (e.g. "this payment needs 2 approvals") and to explain why an action is
 * disabled. The contract is always the final authority: every action is
 * simulated on-chain before the wallet is asked to sign.
 */
import type { OnChainMember, OnChainPolicy, OnChainProposal, OnChainTreasuryState, PolicyInput, Role } from "./types";

/* ------------------------------------------------------------------ */
/* Accounting period                                                   */
/* ------------------------------------------------------------------ */

/** Accounting periods are calendar months in UTC, keyed "YYYY-MM". */
export function periodKey(at: number): string {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodBounds(at: number): { start: number; end: number } {
  const d = new Date(at);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
  return { start, end };
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export function findMember(state: Pick<OnChainTreasuryState, "members">, address?: string | null) {
  if (!address) return undefined;
  return state.members.find((m) => m.address === address);
}

export function hasRole(member: OnChainMember | undefined, role: Role): boolean {
  return !!member && member.roles.includes(role);
}

export type Capability = "propose" | "approve" | "execute" | "cancel_any" | "manage_members" | "manage_policy";

export function can(member: OnChainMember | undefined, capability: Capability): boolean {
  if (!member) return false;
  switch (capability) {
    case "propose":
      return hasRole(member, "proposer") || hasRole(member, "admin");
    case "approve":
      return hasRole(member, "approver");
    case "execute":
      // Execution is permissionless among members: the contract re-checks every rule.
      return member.roles.length > 0;
    case "cancel_any":
    case "manage_members":
    case "manage_policy":
      return hasRole(member, "admin");
  }
}

/* ------------------------------------------------------------------ */
/* Thresholds                                                          */
/* ------------------------------------------------------------------ */

export function requiredApprovals(policy: Pick<OnChainPolicy, "approvalTiers">, amount: bigint) {
  let required = 1;
  for (const tier of [...policy.approvalTiers].sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1))) {
    if (amount >= tier.minAmount) required = tier.requiredApprovals;
  }
  return required;
}

/* ------------------------------------------------------------------ */
/* Policy validation (mirrors InvalidPolicy checks in the contract)    */
/* ------------------------------------------------------------------ */

export function validatePolicy(policy: PolicyInput, members: OnChainMember[]): string[] {
  const errors: string[] = [];
  const approvers = members.filter((m) => m.roles.includes("approver")).length;

  if (policy.approvalTiers.length === 0) errors.push("At least one approval tier is required.");
  if (!policy.approvalTiers.some((t) => t.minAmount === 0n)) {
    errors.push("One approval tier must start at 0 so every payment is covered.");
  }
  const mins = policy.approvalTiers.map((t) => t.minAmount.toString());
  if (new Set(mins).size !== mins.length) errors.push("Approval tiers must have distinct amounts.");

  const sorted = [...policy.approvalTiers].sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1));
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.requiredApprovals < 1) errors.push("Every tier needs at least 1 approval.");
    if (t.requiredApprovals > approvers) {
      errors.push(`A tier requires ${t.requiredApprovals} approvals but only ${approvers} member(s) can approve.`);
    }
    if (i > 0 && t.requiredApprovals < sorted[i - 1].requiredApprovals) {
      errors.push("Larger payments cannot require fewer approvals than smaller ones.");
    }
  }

  if (policy.departments.length === 0) errors.push("At least one department is required.");
  const ids = policy.departments.map((d) => d.id);
  if (new Set(ids).size !== ids.length) errors.push("Department identifiers must be unique.");
  if (policy.departments.some((d) => d.monthlyLimit <= 0n)) {
    errors.push("Department monthly limits must be greater than zero.");
  }

  if (policy.approvalTtlSeconds < 3600) errors.push("Approval window must be at least 1 hour.");
  if (policy.approvalTtlSeconds > 90 * 86400) errors.push("Approval window cannot exceed 90 days.");

  if (policy.allowlistEnabled && policy.allowlist.length === 0) {
    errors.push("The allowlist is enabled but has no recipients.");
  }
  const addrs = policy.allowlist.map((a) => a.address);
  if (new Set(addrs).size !== addrs.length) errors.push("Allowlist contains duplicate addresses.");

  return [...new Set(errors)];
}

/* ------------------------------------------------------------------ */
/* Proposal evaluation                                                 */
/* ------------------------------------------------------------------ */

export type CheckStatus = "pass" | "fail" | "waiting";

export interface PolicyCheck {
  id:
    | "status"
    | "expiry"
    | "policy_version"
    | "approvals"
    | "allowlist"
    | "department"
    | "monthly_limit"
    | "balance"
    | "role";
  label: string;
  status: CheckStatus;
  detail: string;
}

export type DerivedProposalStatus = "pending" | "ready" | "blocked" | "expired" | "stale" | "executed" | "cancelled";

export interface ProposalEvaluation {
  status: DerivedProposalStatus;
  required: number;
  /** Approvals that the contract would count right now. */
  validApprovers: string[];
  /** Approvals that no longer count (removed member, lost role, old policy). */
  invalidApprovers: string[];
  checks: PolicyCheck[];
  canExecute: boolean;
}

/** Approvals the contract will count: current approvers, current policy version, not self (unless allowed). */
export function countValidApprovals(state: OnChainTreasuryState, proposal: OnChainProposal) {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const a of proposal.approvals) {
    const member = findMember(state, a.approver);
    const ok =
      hasRole(member, "approver") &&
      a.policyVersion === state.policy.version &&
      (state.policy.allowSelfApproval || a.approver !== proposal.proposer);
    (ok ? valid : invalid).push(a.approver);
  }
  return { valid, invalid };
}

interface Formatters {
  amount: (units: bigint) => string;
}

const defaultFmt: Formatters = { amount: (u) => u.toString() };

export function evaluateProposal(
  state: OnChainTreasuryState,
  proposal: OnChainProposal,
  now: number,
  fmt: Formatters = defaultFmt,
): ProposalEvaluation {
  const { policy } = state;
  const required = requiredApprovals(policy, proposal.amount);
  const { valid, invalid } = countValidApprovals(state, proposal);
  const checks: PolicyCheck[] = [];

  if (proposal.status !== "pending") {
    return {
      status: proposal.status,
      required,
      validApprovers: valid,
      invalidApprovers: invalid,
      checks: [],
      canExecute: false,
    };
  }

  const expired = now > proposal.expiresAt;
  checks.push({
    id: "expiry",
    label: "Approval window",
    status: expired ? "fail" : "pass",
    detail: expired ? "The approval window has closed." : "Within the approval window.",
  });

  const stale = proposal.policyVersion !== policy.version;
  checks.push({
    id: "policy_version",
    label: "Policy version",
    status: stale ? "fail" : "pass",
    detail: stale
      ? `Created under policy v${proposal.policyVersion}; current is v${policy.version}. Approvals were invalidated.`
      : `Matches current policy v${policy.version}.`,
  });

  checks.push({
    id: "approvals",
    label: "Approvals",
    status: valid.length >= required ? "pass" : "waiting",
    detail: `${valid.length} of ${required} required approval${required === 1 ? "" : "s"}.`,
  });

  checks.push(...recipientAndBudgetChecks(state, proposal.recipient, proposal.departmentId, proposal.amount, fmt));

  const hardFail = checks.some((c) => c.status === "fail");
  const status: DerivedProposalStatus = expired
    ? "expired"
    : stale
      ? "stale"
      : hardFail
        ? "blocked"
        : valid.length >= required
          ? "ready"
          : "pending";

  return {
    status,
    required,
    validApprovers: valid,
    invalidApprovers: invalid,
    checks,
    canExecute: status === "ready",
  };
}

function recipientAndBudgetChecks(
  state: OnChainTreasuryState,
  recipient: string,
  departmentId: string,
  amount: bigint,
  fmt: Formatters,
): PolicyCheck[] {
  const { policy } = state;
  const checks: PolicyCheck[] = [];

  if (policy.allowlistEnabled) {
    const entry = policy.allowlist.find((a) => a.address === recipient);
    checks.push({
      id: "allowlist",
      label: "Recipient allowlist",
      status: entry ? "pass" : "fail",
      detail: entry ? `Allowlisted as “${entry.label}”.` : "Recipient is not on the allowlist.",
    });
  }

  const dept = policy.departments.find((d) => d.id === departmentId);
  if (!departmentId) {
    checks.push({
      id: "department",
      label: "Department budget",
      status: "waiting",
      detail: "Choose the budget this payment comes from.",
    });
  } else if (!dept) {
    checks.push({
      id: "department",
      label: "Department",
      status: "fail",
      detail: "Department no longer exists in the current policy.",
    });
  } else {
    const spent = state.periodSpend[dept.id] ?? 0n;
    const remaining = dept.monthlyLimit - spent;
    checks.push({
      id: "monthly_limit",
      label: `${dept.name} monthly limit`,
      status: amount <= remaining ? "pass" : "fail",
      detail:
        amount <= remaining
          ? `${fmt.amount(remaining - amount)} remaining after this payment.`
          : `Only ${fmt.amount(remaining > 0n ? remaining : 0n)} remaining this month.`,
    });
  }

  const bal = state.balances.find((b) => b.asset.contractId === state.managedAsset.contractId);
  const available = bal?.amount ?? 0n;
  checks.push({
    id: "balance",
    label: "Treasury balance",
    status: available >= amount ? "pass" : "fail",
    detail: available >= amount ? `${fmt.amount(available)} available.` : `Only ${fmt.amount(available)} available.`,
  });

  return checks;
}

export interface DraftPayment {
  recipient: string;
  amount: bigint;
  departmentId: string;
}

/** Preview checks for a new proposal before it is submitted. */
export function previewDraft(
  state: OnChainTreasuryState,
  proposer: string | undefined,
  draft: DraftPayment,
  fmt: Formatters = defaultFmt,
) {
  const member = findMember(state, proposer);
  const checks: PolicyCheck[] = [
    {
      id: "role",
      label: "Proposer permission",
      status: can(member, "propose") ? "pass" : "fail",
      detail: can(member, "propose")
        ? "Your wallet can create proposals."
        : "Your wallet needs the proposer or admin role.",
    },
    ...recipientAndBudgetChecks(state, draft.recipient, draft.departmentId, draft.amount, fmt),
  ];
  const required = requiredApprovals(state.policy, draft.amount);
  const eligibleApprovers = state.members.filter(
    (m) => m.roles.includes("approver") && (state.policy.allowSelfApproval || m.address !== proposer),
  ).length;

  // Budget and balance may change before execution, so only role and allowlist block submission.
  const blocking = checks.filter((c) => c.status === "fail" && (c.id === "role" || c.id === "allowlist"));
  return { checks, required, eligibleApprovers, blocking, canSubmit: blocking.length === 0 };
}

/** Can `address` approve this proposal right now? Returns a reason when not. */
export function approvalBlocker(
  state: OnChainTreasuryState,
  proposal: OnChainProposal,
  address: string | undefined,
  now: number,
): string | null {
  const member = findMember(state, address);
  if (!member) return "Connect a member wallet to approve.";
  if (!can(member, "approve")) return "Your wallet does not have the approver role.";
  if (proposal.status !== "pending") return "This proposal is no longer pending.";
  if (now > proposal.expiresAt) return "The approval window has closed.";
  if (proposal.policyVersion !== state.policy.version) {
    return "The policy changed after this proposal was created.";
  }
  if (!state.policy.allowSelfApproval && proposal.proposer === address) {
    return "Policy forbids approving your own proposal.";
  }
  if (proposal.approvals.some((a) => a.approver === address)) return "You already approved this.";
  return null;
}
