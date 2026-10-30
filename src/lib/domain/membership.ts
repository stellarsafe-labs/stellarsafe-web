import { validatePolicy } from "./policy";
import type { OnChainMember, OnChainTreasuryState, Role } from "./types";
import { isAccountAddress, isContractAddress } from "@/lib/stellar/address";

const isLastAdmin = (state: OnChainTreasuryState, member: OnChainMember) =>
  member.roles.includes("admin") && state.members.filter((m) => m.roles.includes("admin")).length === 1;

/** Why `address` can't be added as a new member, or null if it can. Empty input is not an error. */
export function newMemberError(state: OnChainTreasuryState, address: string): string | null {
  const addr = address.trim();
  if (!addr) return null;
  if (!isAccountAddress(addr) && !isContractAddress(addr)) return "Enter a valid Stellar address (G… or C…)";
  if (state.members.some((m) => m.address === addr)) return "This address is already a member";
  return null;
}

/** Why `member` can't be given `roles`, or null if the change keeps the treasury valid. */
export function roleChangeError(state: OnChainTreasuryState, member: OnChainMember, roles: Role[]): string | null {
  if (isLastAdmin(state, member) && !roles.includes("admin")) return "A treasury must keep at least one admin.";
  const next = state.members.map((m) => (m.address === member.address ? { ...m, roles } : m));
  return validatePolicy(state.policy, next)[0] ?? null;
}

/** Why `member` can't be removed, or null if removal keeps the treasury valid. */
export function removalError(state: OnChainTreasuryState, member: OnChainMember): string | null {
  if (isLastAdmin(state, member)) return "A treasury must keep at least one admin.";
  const next = state.members.filter((m) => m.address !== member.address);
  return validatePolicy(state.policy, next)[0] ?? null;
}
