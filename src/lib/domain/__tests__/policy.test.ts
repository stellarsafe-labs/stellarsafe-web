import { describe, expect, it } from "vitest";
import { toUnits } from "../amount";
import {
  approvalBlocker,
  can,
  evaluateProposal,
  periodBounds,
  periodKey,
  previewDraft,
  requiredApprovals,
  validatePolicy,
} from "../policy";
import { A, NOW, policy, proposal, state } from "./fixtures";

const approval = (approver: string, policyVersion = 1) => ({ approver, at: NOW - 1000, policyVersion });

describe("accounting period", () => {
  it("uses UTC calendar months", () => {
    expect(periodKey(Date.UTC(2026, 0, 31, 23, 59, 59))).toBe("2026-01");
    expect(periodKey(Date.UTC(2026, 1, 1, 0, 0, 0))).toBe("2026-02");
    const { start, end } = periodBounds(Date.UTC(2026, 1, 14));
    expect(start).toBe(Date.UTC(2026, 1, 1));
    expect(end).toBe(Date.UTC(2026, 2, 1) - 1);
  });
});

describe("requiredApprovals", () => {
  it("applies the highest tier the amount reaches", () => {
    const p = policy();
    expect(requiredApprovals(p, toUnits(499))).toBe(1);
    expect(requiredApprovals(p, toUnits(500))).toBe(2);
    expect(requiredApprovals(p, toUnits(50_000))).toBe(2);
  });

  it("does not depend on tier order", () => {
    const p = policy({
      approvalTiers: [
        { minAmount: toUnits(500), requiredApprovals: 2 },
        { minAmount: 0n, requiredApprovals: 1 },
      ],
    });
    expect(requiredApprovals(p, toUnits(10))).toBe(1);
  });
});

describe("capabilities", () => {
  const s = state();
  it("maps roles to capabilities", () => {
    expect(can(s.members[3], "propose")).toBe(true);
    expect(can(s.members[3], "approve")).toBe(false);
    expect(can(s.members[0], "manage_policy")).toBe(true);
    expect(can(s.members[1], "manage_policy")).toBe(false);
    expect(can(undefined, "execute")).toBe(false);
  });
});

describe("validatePolicy", () => {
  const members = state().members;
  it("accepts a sound policy", () => {
    expect(validatePolicy(policy(), members)).toEqual([]);
  });
  it("requires a tier starting at zero", () => {
    expect(
      validatePolicy(policy({ approvalTiers: [{ minAmount: 1n, requiredApprovals: 1 }] }), members),
    ).toContainEqual(expect.stringMatching(/start at 0/));
  });
  it("rejects thresholds above the number of approvers", () => {
    const errs = validatePolicy(policy({ approvalTiers: [{ minAmount: 0n, requiredApprovals: 4 }] }), members);
    expect(errs.join()).toMatch(/only 3 member/);
  });
  it("rejects decreasing tiers", () => {
    const errs = validatePolicy(
      policy({
        approvalTiers: [
          { minAmount: 0n, requiredApprovals: 2 },
          { minAmount: 10n, requiredApprovals: 1 },
        ],
      }),
      members,
    );
    expect(errs.join()).toMatch(/fewer approvals/);
  });
  it("rejects an enabled but empty allowlist and bad TTLs", () => {
    expect(validatePolicy(policy({ allowlist: [] }), members).join()).toMatch(/allowlist/);
    expect(validatePolicy(policy({ approvalTtlSeconds: 60 }), members).join()).toMatch(/at least 1 hour/);
  });
});

describe("evaluateProposal", () => {
  it("is pending until enough approvals, then ready", () => {
    const s = state();
    expect(evaluateProposal(s, proposal(), NOW).status).toBe("pending");
    const ev = evaluateProposal(s, proposal({ approvals: [approval(A.approver1)] }), NOW);
    expect(ev.status).toBe("ready");
    expect(ev.canExecute).toBe(true);
  });

  it("marks proposals expired after the window", () => {
    const ev = evaluateProposal(state(), proposal({ approvals: [approval(A.approver1)] }), NOW + 2 * 86_400_000);
    expect(ev.status).toBe("expired");
    expect(ev.canExecute).toBe(false);
  });

  it("invalidates approvals when the policy version changed", () => {
    const s = state({ policy: policy({ version: 2 }) });
    const ev = evaluateProposal(s, proposal({ approvals: [approval(A.approver1)] }), NOW);
    expect(ev.status).toBe("stale");
    expect(ev.validApprovers).toEqual([]);
  });

  it("stops counting approvals from removed members or revoked roles", () => {
    const base = state();
    const s = { ...base, members: base.members.filter((m) => m.address !== A.approver1) };
    const ev = evaluateProposal(s, proposal({ approvals: [approval(A.approver1)] }), NOW);
    expect(ev.invalidApprovers).toEqual([A.approver1]);
    expect(ev.status).toBe("pending");
  });

  it("ignores self-approval unless allowed", () => {
    const s = state({
      members: [...state().members.slice(0, 3), { address: A.proposer, roles: ["proposer", "approver"], addedAt: 0 }],
    });
    const p = proposal({ approvals: [approval(A.proposer)] });
    expect(evaluateProposal(s, p, NOW).validApprovers).toEqual([]);
    const allowed = { ...s, policy: policy({ allowSelfApproval: true }) };
    expect(evaluateProposal(allowed, p, NOW).status).toBe("ready");
  });

  it("is blocked when the monthly limit would be exceeded", () => {
    const s = state({ periodSpend: { eng: toUnits(950) } });
    const ev = evaluateProposal(s, proposal({ approvals: [approval(A.approver1)] }), NOW);
    expect(ev.status).toBe("blocked");
    expect(ev.checks.find((c) => c.id === "monthly_limit")?.status).toBe("fail");
  });

  it("is blocked when the recipient is not allowlisted or balance is short", () => {
    const ev = evaluateProposal(state(), proposal({ recipient: A.stranger, approvals: [approval(A.approver1)] }), NOW);
    expect(ev.status).toBe("blocked");
    const poor = state({ balances: [{ asset: state().managedAsset, amount: 1n }] });
    expect(evaluateProposal(poor, proposal({ approvals: [approval(A.approver1)] }), NOW).status).toBe("blocked");
  });

  it("reports final statuses without checks", () => {
    expect(evaluateProposal(state(), proposal({ status: "executed" }), NOW).status).toBe("executed");
  });
});

describe("approvalBlocker", () => {
  const s = state();
  it("explains why a wallet cannot approve", () => {
    expect(approvalBlocker(s, proposal(), A.stranger, NOW)).toMatch(/member/);
    expect(approvalBlocker(s, proposal(), A.proposer, NOW)).toMatch(/approver role/);
    expect(approvalBlocker(s, proposal({ approvals: [approval(A.approver1)] }), A.approver1, NOW)).toMatch(/already/);
    expect(approvalBlocker(s, proposal(), A.approver1, NOW + 9e9)).toMatch(/closed/);
    expect(approvalBlocker(s, proposal(), A.approver1, NOW)).toBeNull();
  });
});

describe("previewDraft", () => {
  it("blocks submission for non-proposers and non-allowlisted recipients only", () => {
    const s = state({ periodSpend: { eng: toUnits(1000) } });
    const ok = previewDraft(s, A.proposer, { recipient: A.vendor, amount: toUnits(600), departmentId: "eng" });
    expect(ok.required).toBe(2);
    expect(ok.canSubmit).toBe(true); // over budget is re-checked at execution
    expect(previewDraft(s, A.approver1, { recipient: A.vendor, amount: 1n, departmentId: "eng" }).canSubmit).toBe(
      false,
    );
    expect(previewDraft(s, A.proposer, { recipient: A.stranger, amount: 1n, departmentId: "eng" }).canSubmit).toBe(
      false,
    );
  });
});
