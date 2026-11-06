// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionsView } from "../transactions-view";
import { A, NOW, asset, state } from "@/lib/domain/__tests__/fixtures";
import { toUnits } from "@/lib/domain/amount";
import type { TransactionRecord } from "@/lib/domain/types";

const TREASURY = state().id;
const txs = vi.hoisted(() => ({ current: { data: undefined as unknown, error: null, refetch: () => {} } }));
const downloadFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/query/hooks", () => ({
  useTreasuryId: () => TREASURY,
  useTransactions: () => txs.current,
  useTreasuryState: () => ({ data: state() }),
  useAddressLabel: () => (a: string) => (a === A.vendor ? "Vendor" : a.slice(0, 6)),
}));
vi.mock("@/lib/format", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/format")>()),
  downloadFile,
}));

function tx(i: number, direction: "in" | "out"): TransactionRecord {
  return {
    id: `tx-${i}`,
    direction,
    amount: toUnits(10 + i),
    asset,
    counterparty: direction === "out" ? A.vendor : A.stranger,
    at: NOW - i * 60_000,
    ledger: 1000 + i,
    txHash: `${i}`.padStart(64, "a"),
    proposalId: direction === "out" ? i : undefined,
    departmentId: direction === "out" ? "eng" : undefined,
  };
}

/** `n` transactions alternating out/in, starting with out. */
const make = (n: number) => Array.from({ length: n }, (_, i) => tx(i, i % 2 === 0 ? "out" : "in"));

const bodyRows = () => screen.getAllByRole("row").length - 1; // minus the header row
const exportButton = () => screen.getByRole("button", { name: /Export CSV/ });
const csvRows = () => (downloadFile.mock.calls[0][1] as string).split("\r\n").slice(1);

beforeEach(() => downloadFile.mockClear());
afterEach(cleanup);

describe("TransactionsView", () => {
  it("shows 25 rows at a time and loads more on demand", async () => {
    txs.current = { data: make(60), error: null, refetch: () => {} };
    const user = userEvent.setup();
    render(<TransactionsView />);

    expect(bodyRows()).toBe(25);
    await user.click(screen.getByRole("button", { name: "Show more (35 remaining)" }));
    expect(bodyRows()).toBe(50);
    await user.click(screen.getByRole("button", { name: "Show more (10 remaining)" }));
    expect(bodyRows()).toBe(60);
    expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
  });

  it("does not offer more when everything fits on one page", () => {
    txs.current = { data: make(25), error: null, refetch: () => {} };
    render(<TransactionsView />);
    expect(bodyRows()).toBe(25);
    expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
  });

  it("paginates the filtered rows, not the full list", async () => {
    txs.current = { data: make(60), error: null, refetch: () => {} };
    const user = userEvent.setup();
    render(<TransactionsView />);

    await user.click(screen.getByRole("radio", { name: "Incoming" }));
    expect(bodyRows()).toBe(25);
    expect(within(screen.getAllByRole("row")[1]).getByLabelText("Incoming")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more (5 remaining)" }));
    expect(bodyRows()).toBe(30);
  });

  it("exports every row matching the current filter", async () => {
    txs.current = { data: make(60), error: null, refetch: () => {} };
    const user = userEvent.setup();
    render(<TransactionsView />);

    await user.click(screen.getByRole("radio", { name: "Outgoing" }));
    await user.click(exportButton());

    expect(downloadFile).toHaveBeenCalledOnce();
    expect(downloadFile.mock.calls[0][0]).toBe(`stellarsafe-transactions-${TREASURY.slice(0, 8)}.csv`);
    const csv = downloadFile.mock.calls[0][1] as string;
    expect(csv.split("\r\n")[0]).toBe(
      "timestamp_utc,direction,amount,asset,counterparty,counterparty_label,proposal_id,department,ledger,tx_hash",
    );
    // All 30 outgoing rows, including those not yet revealed by "Show more".
    expect(csvRows()).toHaveLength(30);
    expect(csvRows()[0]).toBe(
      [
        new Date(NOW).toISOString(),
        "out",
        "10",
        "USDC",
        A.vendor,
        "Vendor",
        "0",
        "Engineering",
        "1000",
        "0".padStart(64, "a"),
      ].join(","),
    );
    expect(csvRows().every((r) => r.split(",")[1] === "out")).toBe(true);
  });

  it("disables export when there are no rows", () => {
    txs.current = { data: [], error: null, refetch: () => {} };
    render(<TransactionsView />);
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });

  it("disables export when the filter leaves no rows", async () => {
    txs.current = { data: [tx(0, "out")], error: null, refetch: () => {} };
    const user = userEvent.setup();
    render(<TransactionsView />);
    expect(exportButton()).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: "Incoming" }));
    expect(exportButton()).toBeDisabled();
  });

  it("disables export while loading", () => {
    txs.current = { data: undefined, error: null, refetch: () => {} };
    render(<TransactionsView />);
    expect(exportButton()).toBeDisabled();
  });
});
