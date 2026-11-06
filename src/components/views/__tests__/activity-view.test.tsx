// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityView } from "../activity-view";
import { A, NOW, state } from "@/lib/domain/__tests__/fixtures";
import type { ActivityEvent, ActivityType } from "@/lib/domain/types";

const TREASURY = state().id;
const activity = vi.hoisted(() => ({ current: { data: undefined as unknown, error: null, refetch: () => {} } }));
const treasury = vi.hoisted(() => ({ current: undefined as unknown }));
const downloadFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/query/hooks", () => ({
  useTreasuryId: () => TREASURY,
  useActivity: () => activity.current,
  useTreasuryState: () => ({ data: treasury.current }),
  useAddressLabel: () => (a: string) => a.slice(0, 6),
}));
vi.mock("@/lib/format", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/format")>()),
  downloadFile,
}));

// Radix Select relies on pointer-capture and scrolling APIs that jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

let seq = 0;
function ev(type: ActivityType, actor = A.admin, data: ActivityEvent["data"] = {}): ActivityEvent {
  const i = seq++;
  return {
    id: `ev-${i}`,
    treasuryId: TREASURY,
    type,
    actor,
    at: NOW - i * 60_000,
    ledger: 2000 + i,
    txHash: `${i}`.padStart(64, "b"),
    data,
  };
}

/** Two of each category: payments, approvals, governance. */
function mixed(): ActivityEvent[] {
  seq = 0;
  return [
    ev("proposal_created", A.proposer, { amount: "1000000000", recipient: A.vendor }),
    ev("proposal_approved", A.approver1),
    ev("member_added", A.admin, { member: A.stranger }),
    ev("deposit", A.stranger, { amount: "50000000" }),
    ev("approval_revoked", A.approver2),
    ev("policy_updated", A.admin, { version: 2 }),
  ].map((e, i) => (e.type.startsWith("proposal") || e.type === "approval_revoked" ? { ...e, proposalId: i + 1 } : e));
}

const setData = (data: ActivityEvent[] | undefined) => (activity.current = { data, error: null, refetch: () => {} });
const items = () => screen.queryAllByRole("listitem");
const exportButton = () => screen.getByRole("button", { name: /Export CSV/ });
const csvEvents = () =>
  (downloadFile.mock.calls[0][1] as string)
    .split("\r\n")
    .slice(1)
    .map((r) => r.split(",")[1]);

async function pickCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name: "Event type" }));
  await user.click(await screen.findByRole("option", { name }));
}

beforeEach(() => {
  downloadFile.mockClear();
  treasury.current = state();
});
afterEach(cleanup);

describe("ActivityView", () => {
  it("shows every event by default", () => {
    setData(mixed());
    render(<ActivityView />);
    expect(items()).toHaveLength(6);
    expect(screen.getByText("6 events")).toBeInTheDocument();
  });

  it.each([
    ["Payments", ["proposal_created", "deposit"]],
    ["Approvals", ["proposal_approved", "approval_revoked"]],
    ["Governance", ["member_added", "policy_updated"]],
  ])("filters to %s", async (category, types) => {
    setData(mixed());
    const user = userEvent.setup();
    render(<ActivityView />);

    await pickCategory(user, category);
    expect(items()).toHaveLength(2);
    expect(screen.getByText("2 events")).toBeInTheDocument();

    await user.click(exportButton());
    expect(csvEvents()).toEqual(types);
  });

  it("returns to the full list when switching back to All events", async () => {
    setData(mixed());
    const user = userEvent.setup();
    render(<ActivityView />);
    await pickCategory(user, "Approvals");
    await pickCategory(user, "All events");
    expect(items()).toHaveLength(6);
  });

  it("shows an empty state and disables export when a category has no events", async () => {
    seq = 0;
    setData([ev("deposit"), ev("proposal_created", A.proposer, { amount: "1", recipient: A.vendor })]);
    const user = userEvent.setup();
    render(<ActivityView />);
    expect(exportButton()).toBeEnabled();

    await pickCategory(user, "Governance");
    expect(screen.getByText("No matching events")).toBeInTheDocument();
    expect(screen.getByText("0 events")).toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });

  it("shows 50 events at first and loads older ones on demand", async () => {
    seq = 0;
    setData(Array.from({ length: 120 }, () => ev("deposit", A.stranger, { amount: "10000000" })));
    const user = userEvent.setup();
    render(<ActivityView />);

    expect(items()).toHaveLength(50);
    await user.click(screen.getByRole("button", { name: "Load older events" }));
    expect(items()).toHaveLength(100);
    await user.click(screen.getByRole("button", { name: "Load older events" }));
    expect(items()).toHaveLength(120);
    expect(screen.queryByRole("button", { name: "Load older events" })).not.toBeInTheDocument();
  });

  it("exports all filtered events, including ones not yet loaded", async () => {
    seq = 0;
    setData(Array.from({ length: 80 }, () => ev("deposit", A.stranger, { amount: "10000000" })));
    const user = userEvent.setup();
    render(<ActivityView />);

    await user.click(exportButton());
    expect(downloadFile).toHaveBeenCalledOnce();
    expect(downloadFile.mock.calls[0][0]).toBe(`stellarsafe-audit-log-${TREASURY.slice(0, 8)}.csv`);
    const [header, first] = (downloadFile.mock.calls[0][1] as string).split("\r\n");
    expect(header).toBe("timestamp_utc,event,actor,actor_label,proposal_id,description,ledger,tx_hash");
    expect(first.startsWith(`${new Date(NOW).toISOString()},deposit,${A.stranger},${A.stranger.slice(0, 6)},,`)).toBe(
      true,
    );
    expect(csvEvents()).toHaveLength(80);
  });

  it("disables export when there are no events", () => {
    setData([]);
    render(<ActivityView />);
    expect(exportButton()).toBeDisabled();
  });

  it("disables export until the treasury state has loaded", () => {
    setData(mixed());
    treasury.current = undefined;
    render(<ActivityView />);
    expect(exportButton()).toBeDisabled();
  });
});
