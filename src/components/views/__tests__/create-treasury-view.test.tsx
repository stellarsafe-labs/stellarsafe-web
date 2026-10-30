// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateTreasuryView } from "../create-treasury-view";
import { A } from "@/lib/domain/__tests__/fixtures";
import type { TxRequest } from "@/components/tx/tx-provider";

const run = vi.hoisted(() => vi.fn());
const wallet = vi.hoisted(() => ({ address: null as string | null, setConnectDialogOpen: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/tx/tx-provider", () => ({ useTx: () => run }));
vi.mock("@/lib/wallet/wallet-provider", () => ({ useWallet: () => wallet }));

afterEach(cleanup);

describe("CreateTreasuryView", () => {
  it("asks for a wallet before anything else", async () => {
    wallet.address = null;
    render(<CreateTreasuryView />);
    await userEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(wallet.setConnectDialogOpen).toHaveBeenCalledWith(true);
  });

  it("validates each step and deploys what was reviewed", async () => {
    window.scrollTo = vi.fn();
    wallet.address = A.admin;
    const user = userEvent.setup();
    render(<CreateTreasuryView />);
    const next = () => user.click(screen.getByRole("button", { name: /Continue/ }));

    // Step 1: name is required.
    await next();
    expect(await screen.findByText("Name is too short")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Acme Treasury");
    await next();

    // Step 2: the deploying wallet is pre-filled as admin; a bad extra member blocks progress.
    expect(screen.getByDisplayValue(A.admin)).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Add member" }));
    await user.type(screen.getAllByLabelText("Address")[1], "not-an-address");
    await next();
    expect(await screen.findByText("Invalid Stellar address")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove member 2" }));
    await next();

    // Step 3: default policy needs 2 approvers for large payments, but only one member approves.
    await next();
    expect(await screen.findByText("Fix the policy before continuing")).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it("deploys once the policy fits the members", async () => {
    window.scrollTo = vi.fn();
    wallet.address = A.admin;
    const user = userEvent.setup();
    render(<CreateTreasuryView />);
    const next = () => user.click(screen.getByRole("button", { name: /Continue/ }));

    await user.type(screen.getByLabelText("Name"), "Acme Treasury");
    await next();
    await user.click(screen.getByRole("button", { name: "Add member" }));
    await user.type(screen.getAllByLabelText("Address")[1], A.approver1);
    await next();
    await next();
    expect(await screen.findByText("Approval thresholds")).toBeInTheDocument();
    expect(screen.getByText("Acme Treasury")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Deploy treasury/ }));
    expect(run).toHaveBeenCalledOnce();
    const req = run.mock.calls[0][0] as TxRequest<string>;
    expect(req.title).toBe("Deploy treasury");
    render(<>{req.summary}</>);
    expect(screen.getByText(/2 members, 2 approval tiers and 2 budgets/)).toBeInTheDocument();
  });
});
