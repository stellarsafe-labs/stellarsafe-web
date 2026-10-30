import { beforeEach, describe, expect, it, vi } from "vitest";
import { Asset } from "@stellar/stellar-sdk";
import { toUnits } from "@/lib/domain/amount";
import { network } from "@/lib/stellar/network";
import { demoAccount, demoContract } from "../demo/personas";

const readContract = vi.fn();
const invokeContract = vi.fn();
vi.mock("../live/soroban", () => ({
  readContract: (...a: unknown[]) => readContract(...a),
  invokeContract: (...a: unknown[]) => invokeContract(...a),
}));

const api = {
  activity: vi.fn(),
  saveProposalMetadata: vi.fn(),
  registerTreasury: vi.fn(),
  listProposalMetadata: vi.fn(),
};
vi.mock("../live/api-client", () => ({ api }));

const { LiveDataSource } = await import("../live/live-source");

const T = demoContract("live-treasury");
const USDC = demoContract("live-usdc");
const XLM = Asset.native().contractId(network.passphrase);
const ada = demoAccount("live-ada");
const vendor = demoAccount("live-vendor");

const rawProposal = (id: number) => ({
  id: BigInt(id),
  proposer: ada,
  recipient: vendor,
  amount: toUnits(10),
  department: "eng",
  policy_version: 1,
  created_at: 1n,
  expires_at: 2n,
  status: ["Pending"],
  approvals: [],
});

function chain(proposalCount = 3) {
  readContract.mockImplementation(async (contract: string, method: string) => {
    const v = (value: unknown) => ({ value, ledger: 500 });
    switch (method) {
      case "get_config":
        return v({ asset: USDC, created_at: 1000n, proposal_count: BigInt(proposalCount) });
      case "get_members":
        return v([{ address: ada, roles: ["admin", "approver", "bogus"], added_at: 5n }]);
      case "get_policy":
        return v({
          version: 2,
          updated_at: 9n,
          approval_tiers: [{ min_amount: 0n, required_approvals: 1 }],
          allowlist_enabled: false,
          allowlist: [],
          departments: [{ id: "eng", name: "Engineering", monthly_limit: toUnits(100) }],
          approval_ttl: 86400n,
          allow_self_approval: false,
        });
      case "get_period_spend":
        return v({ period: "2026-10", spent: { eng: toUnits(40) } });
      case "symbol":
        return v(contract === XLM ? "native" : "USDC");
      case "decimals":
        return v(7);
      case "balance":
        return v(contract === XLM ? toUnits(3) : toUnits(1234));
      case "list_proposals":
        return v([]);
      default:
        throw new Error(`unexpected ${method}`);
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  chain();
});

describe("LiveDataSource reads", () => {
  it("assembles treasury state from contract reads only", async () => {
    const s = await new LiveDataSource().getTreasuryState(T);
    expect(s.managedAsset).toMatchObject({ code: "USDC", contractId: USDC, decimals: 7 });
    expect(s.balances.map((b) => [b.asset.code, b.amount])).toEqual([
      ["USDC", toUnits(1234)],
      ["XLM", toUnits(3)],
    ]);
    expect(s.members[0].roles).toEqual(["admin", "approver"]); // unknown roles dropped
    expect(s.policy.version).toBe(2);
    expect(s.periodSpend).toEqual({ eng: toUnits(40) });
    expect(s.periodKey).toBe("2026-10");
    expect(s.ledger).toBe(500);
    expect(api.activity).not.toHaveBeenCalled(); // never the API
  });

  it("pages through proposals until a short page", async () => {
    let call = 0;
    readContract.mockImplementation(async (_c: string, method: string) => {
      if (method !== "list_proposals") throw new Error(method);
      call++;
      const count = call === 1 ? 50 : 7;
      const offset = (call - 1) * 50;
      return { value: Array.from({ length: count }, (_, i) => rawProposal(offset + i + 1)), ledger: 1 };
    });
    const list = await new LiveDataSource().getProposals(T);
    expect(call).toBe(2);
    expect(list).toHaveLength(57);
    expect(list[0].id).toBe(57); // newest first
  });

  it("derives transaction history from indexed events", async () => {
    api.activity.mockResolvedValue([
      { id: "1", type: "deposit", actor: vendor, at: 1, ledger: 1, txHash: "a", data: { amount: "100" } },
      {
        id: "2",
        type: "proposal_executed",
        actor: ada,
        at: 2,
        ledger: 2,
        txHash: "b",
        proposalId: 4,
        data: { amount: "50", recipient: vendor },
      },
      { id: "3", type: "proposal_approved", actor: ada, at: 3, ledger: 3, txHash: "c", data: {} },
    ]);
    const txs = await new LiveDataSource().getTransactions(T);
    expect(txs.map((t) => [t.direction, t.amount, t.counterparty])).toEqual([
      ["in", 100n, vendor],
      ["out", 50n, vendor],
    ]);
  });
});

describe("LiveDataSource writes", () => {
  const ctx = { source: ada, sign: async (x: string) => x };

  it("proposes on-chain, then stores metadata best-effort", async () => {
    invokeContract.mockResolvedValue({ hash: "h", ledger: 9, value: 12n });
    api.saveProposalMetadata.mockRejectedValue(new Error("API down"));
    const res = await new LiveDataSource().proposePayment(
      T,
      { title: "GPU", recipient: vendor, amount: toUnits(5), departmentId: "eng" },
      ctx,
    );
    expect(res.value).toBe(12); // succeeds even though the API failed
    const [contract, method, args] = invokeContract.mock.calls[0];
    expect([contract, method, (args as unknown[]).length]).toEqual([T, "propose_payment", 5]);
    expect(api.saveProposalMetadata).toHaveBeenCalledWith(
      T,
      expect.objectContaining({ proposalId: 12, title: "GPU", txHash: "h" }),
    );
  });

  it("passes the acting wallet as the first argument of every mutation", async () => {
    invokeContract.mockResolvedValue({ hash: "h", ledger: 1, value: undefined });
    const ds = new LiveDataSource();
    await ds.approvePayment(T, 3, ctx);
    await ds.executePayment(T, 3, ctx);
    await ds.cancelPayment(T, 3, ctx);
    await ds.revokeApproval(T, 3, ctx);
    expect(invokeContract.mock.calls.map((c) => c[1])).toEqual([
      "approve_payment",
      "execute_payment",
      "cancel_payment",
      "revoke_approval",
    ]);
    for (const call of invokeContract.mock.calls) expect((call[2] as unknown[]).length).toBe(2);
  });

  it("refuses to deploy without a configured factory", async () => {
    await expect(
      new LiveDataSource().createTreasury({ name: "x", members: [], policy: {} as never }, ctx),
    ).rejects.toThrow(/FACTORY_CONTRACT_ID/);
    expect(invokeContract).not.toHaveBeenCalled();
  });
});
