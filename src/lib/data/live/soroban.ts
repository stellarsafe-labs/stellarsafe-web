import { Account, BASE_FEE, Contract, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";
import { network } from "@/lib/stellar/network";
import { ContractError, contractErrorFromCode } from "@/lib/domain/types";
import type { TxContext, TxResult } from "../source";
import { contractErrorCode, native } from "./codec";

let server: rpc.Server | null = null;
export function getRpc(): rpc.Server {
  server ??= new rpc.Server(network.rpcUrl, { allowHttp: network.rpcUrl.startsWith("http://") });
  return server;
}

/** Zero account: simulation does not check the source, so reads don't need a wallet. */
const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function toContractError(message: string): Error {
  const code = contractErrorCode(message);
  return (code !== null && contractErrorFromCode(code)) || new Error(message);
}

/** Find the first contract error code emitted in diagnostic events. */
function errorFromDiagnostics(events?: xdr.DiagnosticEvent[]): Error | null {
  for (const e of events ?? []) {
    try {
      const body = e.event.body.v0;
      for (const v of [...body.topics, body.data]) {
        if (v.type === "scvError" && v.error.type === "sceContract") {
          const err = contractErrorFromCode(v.error.contractCode);
          if (err) return err;
        }
      }
    } catch {
      // ignore malformed events
    }
  }
  return null;
}

/** Read-only contract call via simulation. Returns the decoded native value. */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<{ value: T; ledger: number }> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await getRpc().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw toContractError(sim.error);
  if (!sim.result) throw new Error(`${method}: simulation returned no result`);
  return { value: native(sim.result.retval) as T, ledger: sim.latestLedger };
}

/**
 * Full write path: build → simulate (surfaces contract errors before the
 * wallet prompt) → assemble footprint/fees → wallet signs → submit → poll.
 */
export async function invokeContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  ctx: TxContext,
): Promise<TxResult<T>> {
  const rpcServer = getRpc();

  ctx.onStage?.("building");
  const account = await rpcServer.getAccount(ctx.source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: network.passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();

  ctx.onStage?.("simulating");
  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw toContractError(sim.error);
  const prepared = rpc.assembleTransaction(tx, sim).build();

  ctx.onStage?.("signing");
  const signedXdr = await ctx.sign(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, network.passphrase);

  ctx.onStage?.("submitting");
  const sent = await rpcServer.sendTransaction(signed);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new Error(
      sent.status === "TRY_AGAIN_LATER"
        ? "The network is congested. Please try again in a moment."
        : `Transaction rejected: ${sent.errorResult?.result.type ?? "unknown error"}`,
    );
  }

  ctx.onStage?.("confirming");
  const res = await rpcServer.pollTransaction(sent.hash, {
    attempts: 30,
    sleepStrategy: () => 1000,
  });
  if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return {
      hash: sent.hash,
      ledger: res.ledger,
      value: (res.returnValue ? native(res.returnValue) : undefined) as T,
    };
  }
  if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
    throw errorFromDiagnostics(res.diagnosticEventsXdr) ?? new Error("Transaction failed on-chain.");
  }
  throw new Error(
    `Transaction ${sent.hash} was submitted but not confirmed yet. Check the explorer before retrying to avoid duplicates.`,
  );
}

export { ContractError };
