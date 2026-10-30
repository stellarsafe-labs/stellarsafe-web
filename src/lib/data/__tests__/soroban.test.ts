import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { ContractError } from "@/lib/domain/types";
import { demoAccount, demoContract } from "../demo/personas";
import type { TxStage } from "../source";

/* A fake Soroban RPC: we control every response the client sees. */
const rpcMock = {
  getAccount: vi.fn(),
  simulateTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  pollTransaction: vi.fn(),
};

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  return {
    ...orig,
    rpc: {
      ...orig.rpc,
      Server: vi.fn(function () {
        return rpcMock;
      }),
      // Real assembly needs full resource footprints; pass the tx through unchanged.
      assembleTransaction: (tx: unknown) => ({ build: () => tx }),
    },
  };
});

const { invokeContract, readContract } = await import("../live/soroban");

const SOURCE = demoAccount("rpc-source");
const CONTRACT = demoContract("rpc-contract");

const simOk = (retval: xdr.ScVal) => ({
  latestLedger: 123,
  result: { retval, auth: [] },
  transactionData: {},
  minResourceFee: "100",
  events: [],
});
const simErr = (error: string) => ({ latestLedger: 123, error, events: [] });

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.getAccount.mockResolvedValue(new Account(SOURCE, "41"));
});

describe("readContract", () => {
  it("returns the decoded value and the ledger it was read at", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simOk(nativeToScVal(5, { type: "u32" })));
    await expect(readContract(CONTRACT, "get_config")).resolves.toEqual({ value: 5, ledger: 123 });
  });

  it("maps contract errors from simulation", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simErr("HostError: Error(Contract, #8)"));
    await expect(readContract(CONTRACT, "get_policy")).rejects.toMatchObject({ code: "RecipientNotAllowed" });
  });

  it("surfaces non-contract errors verbatim", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simErr("resource limit exceeded"));
    await expect(readContract(CONTRACT, "get_policy")).rejects.toThrow("resource limit exceeded");
  });
});

describe("invokeContract", () => {
  const run = (sign = vi.fn(async (x: string) => x)) => {
    const stages: TxStage[] = [];
    return {
      stages,
      sign,
      p: invokeContract<bigint>(CONTRACT, "propose_payment", [], {
        source: SOURCE,
        sign,
        onStage: (s) => stages.push(s),
      }),
    };
  };

  it("simulates, signs, submits and confirms in order", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simOk(xdr.ScVal.scvVoid()));
    rpcMock.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "abc" });
    rpcMock.pollTransaction.mockResolvedValue({
      status: "SUCCESS",
      ledger: 777,
      returnValue: nativeToScVal(9n, { type: "u64" }),
    });
    const { p, stages, sign } = run();
    await expect(p).resolves.toEqual({ hash: "abc", ledger: 777, value: 9n });
    expect(stages).toEqual(["building", "simulating", "signing", "submitting", "confirming"]);
    expect(sign).toHaveBeenCalledOnce();
    expect(rpcMock.getAccount).toHaveBeenCalledWith(SOURCE);
  });

  it("never asks the wallet to sign when simulation fails", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simErr("Error(Contract, #17)"));
    const { p, sign } = run();
    await expect(p).rejects.toBeInstanceOf(ContractError);
    await expect(p).rejects.toMatchObject({ code: "InsufficientApprovals" });
    expect(sign).not.toHaveBeenCalled();
    expect(rpcMock.sendTransaction).not.toHaveBeenCalled();
  });

  it("does not submit when the user rejects in the wallet", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simOk(xdr.ScVal.scvVoid()));
    const { p } = run(vi.fn().mockRejectedValue(new Error("User declined")));
    await expect(p).rejects.toThrow("User declined");
    expect(rpcMock.sendTransaction).not.toHaveBeenCalled();
  });

  it("reports congestion and rejection from sendTransaction", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simOk(xdr.ScVal.scvVoid()));
    rpcMock.sendTransaction.mockResolvedValue({ status: "TRY_AGAIN_LATER", hash: "h" });
    await expect(run().p).rejects.toThrow(/congested/);
    rpcMock.sendTransaction.mockResolvedValue({
      status: "ERROR",
      hash: "h",
      errorResult: { result: { type: "txBadSeq" } },
    });
    await expect(run().p).rejects.toThrow(/txBadSeq/);
  });

  it("extracts the contract error from diagnostic events of a failed transaction", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simOk(xdr.ScVal.scvVoid()));
    rpcMock.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "h" });
    const event = {
      event: {
        body: { v0: { topics: [xdr.ScVal.scvSymbol("error")], data: xdr.ScVal.scvError(xdr.ScError.sceContract(19)) } },
      },
    };
    rpcMock.pollTransaction.mockResolvedValue({ status: "FAILED", diagnosticEventsXdr: [event] });
    await expect(run().p).rejects.toMatchObject({ code: "MonthlyLimitExceeded" });
  });

  it("warns against retrying when confirmation times out", async () => {
    rpcMock.simulateTransaction.mockResolvedValue(simOk(xdr.ScVal.scvVoid()));
    rpcMock.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "deadbeef" });
    rpcMock.pollTransaction.mockResolvedValue({ status: "NOT_FOUND" });
    await expect(run().p).rejects.toThrow(/deadbeef.*not confirmed.*avoid duplicates/);
  });
});
