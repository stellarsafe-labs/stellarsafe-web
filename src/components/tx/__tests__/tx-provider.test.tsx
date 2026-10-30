// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TxProvider, useTx, type TxRequest } from "../tx-provider";
import { WalletError } from "@/lib/wallet/types";
import { ContractError } from "@/lib/domain/types";
import type { TxContext, TxResult } from "@/lib/data";

const wallet = vi.hoisted(() => ({ address: "GADDR" as string | null, sign: vi.fn() }));
vi.mock("@/lib/wallet/wallet-provider", () => ({ useWallet: () => wallet }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const reportError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/telemetry", () => ({ reportError }));

function Trigger<T>({ req }: { req: TxRequest<T> }) {
  const run = useTx();
  return <button onClick={() => run(req)}>start</button>;
}

function setup<T>(req: Partial<TxRequest<T>> & Pick<TxRequest<T>, "action">) {
  const full: TxRequest<T> = { title: "Approve payment", confirmLabel: "Sign & approve", ...req };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TxProvider>
        <Trigger req={full} />
      </TxProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const ok = <T,>(value: T): TxResult<T> => ({ hash: "abc123", ledger: 4242, value });

describe("TxProvider", () => {
  afterEach(cleanup);
  beforeEach(() => {
    wallet.address = "GADDR";
    reportError.mockClear();
  });

  it("shows the review step, runs the action with the wallet, and reports success", async () => {
    const action = vi.fn(async (ctx: TxContext) => {
      ctx.onStage?.("signing");
      return ok(7);
    });
    const onSuccess = vi.fn();
    const user = setup({ action, onSuccess, summary: <p>Pay 10 USDC</p> });

    await user.click(screen.getByText("start"));
    expect(screen.getByRole("dialog", { name: "Approve payment" })).toBeInTheDocument();
    expect(screen.getByText("Pay 10 USDC")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sign & approve" }));
    expect(await screen.findByText("Confirmed in ledger 4,242")).toBeInTheDocument();
    expect(action).toHaveBeenCalledWith(expect.objectContaining({ source: "GADDR", sign: wallet.sign }));
    expect(onSuccess).toHaveBeenCalledWith(ok(7));
  });

  it("explains a wallet rejection without reporting it as a bug, and can retry", async () => {
    const action = vi
      .fn<(ctx: TxContext) => Promise<TxResult<void>>>()
      .mockRejectedValueOnce(new WalletError("nope", "rejected"))
      .mockResolvedValueOnce(ok(undefined));
    const user = setup({ action });

    await user.click(screen.getByText("start"));
    await user.click(screen.getByRole("button", { name: "Sign & approve" }));
    expect(await screen.findByText("You rejected the request in your wallet.")).toBeInTheDocument();
    expect(reportError).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Confirmed in ledger 4,242")).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("shows contract rejections and reports only unexpected errors", async () => {
    const user = setup({ action: vi.fn().mockRejectedValue(new ContractError("Unauthorized", "Not an approver")) });
    await user.click(screen.getByText("start"));
    await user.click(screen.getByRole("button", { name: "Sign & approve" }));
    expect(await screen.findByText("Not an approver")).toBeInTheDocument();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports unexpected errors to telemetry", async () => {
    const user = setup({ action: vi.fn().mockRejectedValue(new Error("RPC down")) });
    await user.click(screen.getByText("start"));
    await user.click(screen.getByRole("button", { name: "Sign & approve" }));
    expect(await screen.findByText("RPC down")).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledOnce();
  });

  it("refuses to run without a connected wallet", async () => {
    wallet.address = null;
    const action = vi.fn();
    const user = setup({ action });
    await user.click(screen.getByText("start"));
    await user.click(screen.getByRole("button", { name: "Sign & approve" }));
    expect(screen.getByText("Connect a wallet first.")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("can't be dismissed while the transaction is in flight", async () => {
    let finish!: (r: TxResult<void>) => void;
    const user = setup({ action: () => new Promise<TxResult<void>>((r) => (finish = r)) });
    await user.click(screen.getByText("start"));
    await user.click(screen.getByRole("button", { name: "Sign & approve" }));

    expect(screen.getByRole("button", { name: /Working/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    finish(ok(undefined));
    expect(await screen.findByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
