import { beforeEach, describe, expect, it } from "vitest";
import { DemoDataSource } from "../demo/demo-source";
import { DEMO_PERSONAS, demoAccount, demoContract } from "../demo/personas";
import { VENDORS } from "../demo/seed";
import { toUnits } from "@/lib/domain/amount";
import { ContractError } from "@/lib/domain/types";
import type { TxContext } from "../source";

const [ada, ben, chloe, dev, eve] = DEMO_PERSONAS;
const NEBULA = demoContract("nebula-labs");
const NOW = Date.UTC(2026, 9, 20, 12);

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const ctx = (address: string, signed: string[] = []): TxContext => ({
  source: address,
  sign: async (xdr) => {
    signed.push(xdr);
    return xdr;
  },
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(ContractError);
  await expect(p).rejects.toMatchObject({ code });
}

let now = NOW;
let ds: DemoDataSource;

beforeEach(() => {
  now = NOW;
  ds = new DemoDataSource({ storage: memoryStorage(), clock: () => now });
});

const propose = (who = chloe.address, amount = toUnits(600), departmentId = "eng") =>
  ds.proposePayment(NEBULA, { title: "Test", recipient: VENDORS.cloud.address, amount, departmentId }, ctx(who));

describe("seed data invariants", () => {
  it("never exceeds a department limit or goes negative", async () => {
    for (const t of await ds.listTreasuries(ada.address)) {
      const s = await ds.getTreasuryState(t.id);
      for (const d of s.policy.departments) expect(s.periodSpend[d.id] ?? 0n).toBeLessThanOrEqual(d.monthlyLimit);
      for (const b of s.balances) expect(b.amount).toBeGreaterThanOrEqual(0n);
    }
  });

  it("lists treasuries by on-chain membership", async () => {
    expect((await ds.listTreasuries(ada.address)).length).toBe(2);
    expect((await ds.listTreasuries(dev.address)).map((t) => t.name)).toEqual(["Nebula Labs Treasury"]);
  });
});

describe("payment lifecycle", () => {
  it("proposes, approves and executes, updating balance, spend and history", async () => {
    const before = await ds.getTreasuryState(NEBULA);
    const signed: string[] = [];
    const { value: id } = await ds.proposePayment(
      NEBULA,
      { title: "GPU", recipient: VENDORS.cloud.address, amount: toUnits(600), departmentId: "eng" },
      ctx(chloe.address, signed),
    );
    expect(signed).toHaveLength(1); // the wallet was asked to sign

    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    await expectCode(ds.executePayment(NEBULA, id, ctx(chloe.address)), "InsufficientApprovals");
    await ds.approvePayment(NEBULA, id, ctx(ada.address));
    await ds.executePayment(NEBULA, id, ctx(chloe.address));

    const after = await ds.getTreasuryState(NEBULA);
    expect(after.balances[0].amount).toBe(before.balances[0].amount - toUnits(600));
    expect(after.periodSpend.eng).toBe((before.periodSpend.eng ?? 0n) + toUnits(600));
    expect((await ds.getProposal(NEBULA, id)).status).toBe("executed");
    expect((await ds.getTransactions(NEBULA))[0]).toMatchObject({ direction: "out", proposalId: id });
    expect((await ds.getActivity(NEBULA))[0]).toMatchObject({ type: "proposal_executed", proposalId: id });
  });

  it("prevents duplicate execution", async () => {
    const { value: id } = await propose(chloe.address, toUnits(100));
    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    await ds.executePayment(NEBULA, id, ctx(ben.address));
    await expectCode(ds.executePayment(NEBULA, id, ctx(ben.address)), "ProposalNotPending");
  });

  it("does not change state or prompt the wallet when simulation fails", async () => {
    const signed: string[] = [];
    const before = await ds.getProposals(NEBULA);
    await expectCode(
      ds.proposePayment(
        NEBULA,
        { title: "x", recipient: eve.address, amount: 1n, departmentId: "eng" },
        ctx(chloe.address, signed),
      ),
      "RecipientNotAllowed",
    );
    expect(signed).toHaveLength(0);
    expect(await ds.getProposals(NEBULA)).toHaveLength(before.length);
  });
});

describe("authorization", () => {
  it("rejects proposals from non-proposers", async () => {
    await expectCode(propose(ben.address), "Unauthorized");
    await expectCode(propose(eve.address), "Unauthorized");
  });

  it("rejects approvals from non-approvers, self-approval and double approval", async () => {
    const { value: id } = await propose(dev.address);
    await expectCode(ds.approvePayment(NEBULA, id, ctx(chloe.address)), "Unauthorized");
    await expectCode(ds.approvePayment(NEBULA, id, ctx(dev.address)), "SelfApprovalForbidden");
    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    await expectCode(ds.approvePayment(NEBULA, id, ctx(ben.address)), "AlreadyApproved");
  });

  it("only admins change members and policy", async () => {
    await expectCode(
      ds.addMember(NEBULA, { address: demoAccount("newcomer"), roles: [] }, ctx(ben.address)),
      "Unauthorized",
    );
    const s = await ds.getTreasuryState(NEBULA);
    await expectCode(ds.setPolicy(NEBULA, s.policy, ctx(dev.address)), "Unauthorized");
  });

  it("only the proposer or an admin can cancel", async () => {
    const { value: id } = await propose();
    await expectCode(ds.cancelPayment(NEBULA, id, ctx(ben.address)), "Unauthorized");
    await ds.cancelPayment(NEBULA, id, ctx(ada.address));
    expect((await ds.getProposal(NEBULA, id)).status).toBe("cancelled");
  });

  it("keeps at least one admin", async () => {
    await expectCode(ds.removeMember(NEBULA, ada.address, ctx(ada.address)), "LastAdmin");
    await expectCode(ds.updateMemberRoles(NEBULA, ada.address, ["approver"], ctx(ada.address)), "LastAdmin");
  });
});

describe("policy guarantees", () => {
  it("expires proposals after the approval window", async () => {
    const { value: id } = await propose();
    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    now += 8 * 86_400_000;
    await expectCode(ds.approvePayment(NEBULA, id, ctx(ada.address)), "ProposalExpired");
    await expectCode(ds.executePayment(NEBULA, id, ctx(ada.address)), "ProposalExpired");
  });

  it("invalidates pending approvals when the policy version changes", async () => {
    const { value: id } = await propose();
    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    await ds.approvePayment(NEBULA, id, ctx(ada.address));
    const s = await ds.getTreasuryState(NEBULA);
    const { value: v } = await ds.setPolicy(NEBULA, { ...s.policy, approvalTtlSeconds: 14 * 86_400 }, ctx(ada.address));
    expect(v).toBe(s.policy.version + 1);
    await expectCode(ds.executePayment(NEBULA, id, ctx(ada.address)), "PolicyVersionMismatch");
  });

  it("stops counting approvals from removed members", async () => {
    const { value: id } = await propose(chloe.address, toUnits(600));
    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    await ds.approvePayment(NEBULA, id, ctx(dev.address));
    // Add a replacement approver first so the 3-approval tier stays satisfiable.
    await ds.addMember(NEBULA, { address: demoAccount("backup-approver"), roles: ["approver"] }, ctx(ada.address));
    await ds.removeMember(NEBULA, dev.address, ctx(ada.address));
    await expectCode(ds.executePayment(NEBULA, id, ctx(ada.address)), "InsufficientApprovals");
  });

  it("enforces the monthly department limit at execution", async () => {
    // Operations has 1,060 left this month in the seed.
    const { value: id } = await propose(chloe.address, toUnits(1_100), "ops");
    await ds.approvePayment(NEBULA, id, ctx(ben.address));
    await ds.approvePayment(NEBULA, id, ctx(ada.address));
    await expectCode(ds.executePayment(NEBULA, id, ctx(ada.address)), "MonthlyLimitExceeded");
  });

  it("rejects invalid policies", async () => {
    const s = await ds.getTreasuryState(NEBULA);
    await expectCode(
      ds.setPolicy(NEBULA, { ...s.policy, approvalTiers: [{ minAmount: 0n, requiredApprovals: 9 }] }, ctx(ada.address)),
      "InvalidPolicy",
    );
  });
});

describe("treasury creation", () => {
  it("deploys a treasury where the deployer is admin", async () => {
    const s = await ds.getTreasuryState(NEBULA);
    const { value: id } = await ds.createTreasury(
      {
        name: "New",
        members: [{ address: eve.address, roles: ["admin", "approver"] }],
        policy: { ...s.policy, approvalTiers: [{ minAmount: 0n, requiredApprovals: 1 }] },
      },
      ctx(eve.address),
    );
    const created = await ds.getTreasuryState(id);
    expect(created.policy.version).toBe(1);
    expect((await ds.getTreasuryMetadata(id)).name).toBe("New");
  });

  it("requires the deployer to be an admin", async () => {
    const s = await ds.getTreasuryState(NEBULA);
    await expectCode(
      ds.createTreasury(
        { name: "X", members: [{ address: ada.address, roles: ["admin", "approver"] }], policy: s.policy },
        ctx(eve.address),
      ),
      "InvalidPolicy",
    );
  });
});
