// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ProposalActions } from "../proposal/proposal-actions";
import { A, NOW, proposal, state as makeState } from "@/lib/domain/__tests__/fixtures";
import { toUnits } from "@/lib/domain/amount";
import { evaluateProposal, findMember } from "@/lib/domain/policy";
import type { OnChainProposal, OnChainTreasuryState } from "@/lib/domain/types";

const run = vi.fn();
const ds = {
  approvePayment: vi.fn(),
  revokeApproval: vi.fn(),
  executePayment: vi.fn(),
  cancelPayment: vi.fn(),
};
const ctx = vi.hoisted(() => ({
  address: null as string | null,
  state: undefined as OnChainTreasuryState | undefined,
}));

vi.mock("@/components/tx/tx-provider", () => ({ useTx: () => run }));
vi.mock("@/lib/data", () => ({ getDataSource: () => ds }));
vi.mock("@/lib/wallet/wallet-provider", () => ({ useWallet: () => ({ address: ctx.address }) }));
vi.mock("@/lib/query/hooks", () => ({ useMe: () => findMember(ctx.state!, ctx.address) }));

const TID = "treasury-1";

function setup({
  as,
  p = proposal(),
  s = makeState(),
  title,
}: {
  as: string | null;
  p?: OnChainProposal;
  s?: OnChainTreasuryState;
  title?: string;
}) {
  ctx.address = as;
  ctx.state = s;
  const item = { proposal: p, evaluation: evaluateProposal(s, p, NOW), meta: title ? { title } : undefined };
  return render(
    <ProposalActions treasuryId={TID} item={item as never} state={s} label={() => "Acme Vendor"} now={NOW} />,
  );
}

const approved = (...approvers: string[]) => approvers.map((approver) => ({ approver, policyVersion: 1, at: NOW }));

const buttons = () => screen.queryAllByRole("button").map((b) => b.textContent?.trim());

/** Click a button, return the request passed to useTx's runner, with its summary rendered. */
async function clickAndCapture(name: RegExp) {
  await userEvent.setup().click(screen.getByRole("button", { name }));
  expect(run).toHaveBeenCalledTimes(1);
  const req = run.mock.calls[0][0];
  const summary = render(<>{req.summary as ReactNode}</>).container;
  const rows = Object.fromEntries(
    [...summary.querySelectorAll("dl > div")].map((d) => [
      d.querySelector("dt")!.textContent,
      d.querySelector("dd")!.textContent,
    ]),
  );
  return { req, rows };
}

beforeEach(() => {
  run.mockReset();
  Object.values(ds).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe("ProposalActions — approve / revoke", () => {
  it("shows Approve (enabled) to an approver who hasn't approved yet", () => {
    setup({ as: A.approver1 });
    expect(screen.getByRole("button", { name: /Approve/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Revoke/ })).toBeNull();
  });

  it("swaps Approve for Revoke once the approver has approved", () => {
    setup({ as: A.approver1, p: proposal({ amount: toUnits(600), approvals: approved(A.approver1) }) });
    expect(screen.getByRole("button", { name: /Revoke approval/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /^Approve$/ })).toBeNull();
  });

  it("hides Approve from members without the approver role and from strangers", () => {
    setup({ as: A.proposer });
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    cleanup();
    setup({ as: A.stranger });
    expect(buttons()).toEqual([]);
    cleanup();
    setup({ as: null });
    expect(buttons()).toEqual([]);
  });

  it("disables Approve for the proposer when allowSelfApproval is false, and explains why", () => {
    const s = makeState({
      members: [
        ...makeState().members.filter((m) => m.address !== A.proposer),
        { address: A.proposer, roles: ["proposer", "approver"], addedAt: 0 },
      ],
    });
    setup({ as: A.proposer, s });
    const approve = screen.getByRole("button", { name: /Approve/ });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute("title", "Policy forbids approving your own proposal.");
    expect(screen.getByRole("note")).toHaveTextContent("Policy forbids approving your own proposal.");
  });

  it("lets the proposer approve when allowSelfApproval is true", () => {
    const base = makeState();
    const s = makeState({
      policy: { ...base.policy, allowSelfApproval: true },
      members: [
        ...base.members.filter((m) => m.address !== A.proposer),
        { address: A.proposer, roles: ["proposer", "approver"], addedAt: 0 },
      ],
    });
    setup({ as: A.proposer, s });
    expect(screen.getByRole("button", { name: /Approve/ })).toBeEnabled();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("disables Approve once the approval window has closed", () => {
    setup({ as: A.approver1, p: proposal({ expiresAt: NOW - 1 }) });
    expect(screen.getByRole("button", { name: /Approve/ })).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent("The approval window has closed.");
  });
});

describe("ProposalActions — execute", () => {
  it("is hidden while the proposal still needs approvals", () => {
    setup({ as: A.approver1, p: proposal({ amount: toUnits(600), approvals: approved(A.approver2) }) });
    expect(screen.queryByRole("button", { name: /Execute/ })).toBeNull();
  });

  it("is shown and enabled to a member once the evaluation is ready", () => {
    setup({ as: A.proposer, p: proposal({ approvals: approved(A.approver1) }) });
    expect(screen.getByRole("button", { name: /Execute payment/ })).toBeEnabled();
  });

  it("is shown but disabled for a non-member when ready", () => {
    setup({ as: A.stranger, p: proposal({ approvals: approved(A.approver1) }) });
    const exec = screen.getByRole("button", { name: /Execute payment/ });
    expect(exec).toBeDisabled();
    expect(exec).toHaveAttribute("title", "Connect a member wallet to execute.");
  });

  it.each([
    ["expired", { expiresAt: NOW - 1 }, makeState()],
    ["stale policy", { policyVersion: 0 }, makeState()],
    ["over budget", {}, makeState({ periodSpend: { eng: toUnits(950) } })],
    ["not allowlisted", { recipient: A.stranger }, makeState()],
  ] as const)("is hidden when the proposal is %s even with enough approvals", (_, over, s) => {
    setup({ as: A.admin, s, p: proposal({ ...over, approvals: approved(A.approver1) }) });
    expect(screen.queryByRole("button", { name: /Execute/ })).toBeNull();
  });
});

describe("ProposalActions — cancel", () => {
  it("is shown to the proposer", () => {
    setup({ as: A.proposer });
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeEnabled();
  });

  it("is shown to an admin (cancel_any) who isn't the proposer", () => {
    setup({ as: A.admin });
    expect(screen.getByRole("button", { name: /Cancel/ })).toBeEnabled();
  });

  it.each([
    ["a plain approver", A.approver1],
    ["a non-member", A.stranger],
    ["a disconnected wallet", null],
  ])("is hidden from %s", (_, who) => {
    setup({ as: who });
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
  });
});

describe("ProposalActions — non-pending proposals", () => {
  it.each(["executed", "cancelled"] as const)("renders nothing for a %s proposal", (status) => {
    const { container } = setup({ as: A.admin, p: proposal({ status, approvals: approved(A.approver1) }) });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProposalActions — transaction requests", () => {
  const base = { Proposal: "#7 · Q4 hosting", Amount: "100 USDC", Recipient: `Acme Vendor${A.vendor}` };

  it("Approve sends a summary with the projected approval count and calls approvePayment", async () => {
    const p = proposal({ id: 7, amount: toUnits(600), approvals: approved(A.approver2) });
    setup({ as: A.approver1, p, title: "Q4 hosting" });
    const { req, rows } = await clickAndCapture(/Approve/);
    expect(req).toMatchObject({
      title: "Approve payment",
      confirmLabel: "Sign approval",
      treasuryId: TID,
      successMessage: "You approved #7",
    });
    expect(rows).toMatchObject({
      ...base,
      Amount: "600 USDC",
      Department: "Engineering",
      "Approvals after yours": "2 of 2",
    });
    expect(rows["Approval valid until"]).toBeTruthy();
    req.action("ctx");
    expect(ds.approvePayment).toHaveBeenCalledWith(TID, 7, "ctx");
  });

  it("Revoke sends the base summary and calls revokeApproval", async () => {
    setup({
      as: A.approver1,
      p: proposal({ id: 7, amount: toUnits(600), approvals: approved(A.approver1) }),
      title: "Q4 hosting",
    });
    const { req, rows } = await clickAndCapture(/Revoke approval/);
    expect(req).toMatchObject({ title: "Revoke your approval", confirmLabel: "Sign & revoke", treasuryId: TID });
    expect(rows).toEqual({ ...base, Amount: "600 USDC" });
    req.action("ctx");
    expect(ds.revokeApproval).toHaveBeenCalledWith(TID, 7, "ctx");
  });

  it("Execute names the exact amount and valid approvals, and calls executePayment", async () => {
    setup({ as: A.proposer, p: proposal({ id: 7, approvals: approved(A.approver1) }), title: "Q4 hosting" });
    const { req, rows } = await clickAndCapture(/Execute payment/);
    expect(req).toMatchObject({
      title: "Execute payment",
      description: expect.stringContaining("100 USDC"),
      confirmLabel: "Sign & send 100 USDC",
      treasuryId: TID,
      successMessage: "Sent 100 USDC",
    });
    expect(rows).toEqual({ ...base, Department: "Engineering", "Valid approvals": "1 of 1" });
    req.action("ctx");
    expect(ds.executePayment).toHaveBeenCalledWith(TID, 7, "ctx");
  });

  it("Cancel is destructive, falls back to a default title, and calls cancelPayment", async () => {
    setup({ as: A.admin, p: proposal({ id: 7 }) });
    const { req, rows } = await clickAndCapture(/Cancel/);
    expect(req).toMatchObject({
      title: "Cancel proposal",
      destructive: true,
      confirmLabel: "Sign & cancel",
      treasuryId: TID,
      successMessage: "Proposal #7 cancelled",
    });
    expect(rows).toEqual({ ...base, Proposal: "#7 · Payment proposal #7" });
    req.action("ctx");
    expect(ds.cancelPayment).toHaveBeenCalledWith(TID, 7, "ctx");
  });

  it("does not call useTx for a disabled Approve", async () => {
    setup({ as: A.approver1, p: proposal({ expiresAt: NOW - 1 }) });
    await userEvent.setup().click(screen.getByRole("button", { name: /Approve/ }));
    expect(run).not.toHaveBeenCalled();
  });
});
