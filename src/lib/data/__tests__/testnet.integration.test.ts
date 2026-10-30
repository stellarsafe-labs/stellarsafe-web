/**
 * Opt-in check against a real deployed treasury on testnet:
 *   STELLARSAFE_TESTNET_TREASURY=C... npm test -- testnet
 * Skipped by default so CI never depends on network availability.
 */
import { describe, expect, it } from "vitest";
import { LiveDataSource } from "../live/live-source";
import { validatePolicy } from "@/lib/domain/policy";

const treasury = process.env.STELLARSAFE_TESTNET_TREASURY;

describe.skipIf(!treasury)("testnet treasury contract", () => {
  const ds = new LiveDataSource();

  it("reads a consistent on-chain state", { timeout: 30_000 }, async () => {
    const s = await ds.getTreasuryState(treasury!);
    expect(s.ledger).toBeGreaterThan(0);
    expect(s.members.some((m) => m.roles.includes("admin"))).toBe(true);
    expect(validatePolicy(s.policy, s.members)).toEqual([]);
    for (const d of s.policy.departments) expect(s.periodSpend[d.id] ?? 0n).toBeLessThanOrEqual(d.monthlyLimit);
  });

  it("decodes every proposal", { timeout: 60_000 }, async () => {
    const list = await ds.getProposals(treasury!);
    for (const p of list) expect(["pending", "executed", "cancelled"]).toContain(p.status);
  });
});
