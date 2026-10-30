import { Asset as StellarAsset, hash, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { config } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import type {
  Asset,
  NotificationPreferences,
  OnChainProposal,
  OnChainTreasuryState,
  TransactionRecord,
} from "@/lib/domain/types";
import type { DataSource, NewProposalInput, NewTreasuryInput, TxContext } from "../source";
import { api } from "./api-client";
import {
  addr,
  decodeMember,
  decodePolicy,
  decodeProposal,
  decodeSpend,
  encodeMember,
  encodePolicy,
  encodeRoles,
  i128,
  sym,
  u32,
  u64,
} from "./codec";
import { invokeContract, readContract } from "./soroban";

type Raw = Record<string, unknown>;

const PAGE = 50;
const XLM_SAC = StellarAsset.native().contractId(network.passphrase);

async function tokenInfo(contractId: string): Promise<Asset> {
  const [symbol, decimals] = await Promise.all([
    readContract<string>(contractId, "symbol"),
    readContract<number>(contractId, "decimals"),
  ]);
  return { code: symbol.value === "native" ? "XLM" : symbol.value, contractId, decimals: Number(decimals.value) };
}

const assetCache = new Map<string, Promise<Asset>>();
const cachedTokenInfo = (id: string) => {
  if (!assetCache.has(id)) assetCache.set(id, tokenInfo(id));
  return assetCache.get(id)!;
};

function metadataHash(title: string, description?: string): Uint8Array {
  return hash(Buffer.from(JSON.stringify({ title, description: description ?? "" })));
}

/**
 * Production data source: money-related state is read from Soroban RPC,
 * metadata and indexed history from stellarsafe-api.
 */
export class LiveDataSource implements DataSource {
  readonly kind = "live" as const;

  async getTreasuryState(id: string): Promise<OnChainTreasuryState> {
    const [cfg, members, policy, spend] = await Promise.all([
      readContract<Raw>(id, "get_config"),
      readContract<Raw[]>(id, "get_members"),
      readContract<Raw>(id, "get_policy"),
      readContract<Raw>(id, "get_period_spend"),
    ]);
    const assetId = String(cfg.value.asset);
    const [managedAsset, xlm, managedBal, xlmBal] = await Promise.all([
      cachedTokenInfo(assetId),
      cachedTokenInfo(XLM_SAC),
      readContract<bigint>(assetId, "balance", [addr(id)]),
      readContract<bigint>(XLM_SAC, "balance", [addr(id)]),
    ]);
    const spendValue = spend.value as { period?: unknown; spent?: unknown };
    return {
      id,
      managedAsset,
      balances: [
        { asset: managedAsset, amount: BigInt(managedBal.value) },
        ...(assetId === XLM_SAC ? [] : [{ asset: xlm, amount: BigInt(xlmBal.value) }]),
      ],
      members: members.value.map(decodeMember),
      policy: decodePolicy(policy.value),
      periodKey: String(spendValue.period ?? ""),
      periodSpend: decodeSpend(spendValue.spent),
      createdAt: Number(cfg.value.created_at) * 1000,
      proposalCount: Number(cfg.value.proposal_count),
      ledger: Math.max(cfg.ledger, members.ledger, policy.ledger, spend.ledger),
      readAt: Date.now(),
    };
  }

  async getProposals(id: string): Promise<OnChainProposal[]> {
    const out: OnChainProposal[] = [];
    for (let start = 1; ; start += PAGE) {
      const page = await readContract<Raw[]>(id, "list_proposals", [u64(start), u32(PAGE)]);
      out.push(...page.value.map((p) => decodeProposal(id, p)));
      if (page.value.length < PAGE) break;
    }
    return out.sort((a, b) => b.id - a.id);
  }

  async getProposal(id: string, proposalId: number) {
    const res = await readContract<Raw>(id, "get_proposal", [u64(proposalId)]);
    return decodeProposal(id, res.value);
  }

  listTreasuries = api.listTreasuries;
  getTreasuryMetadata = api.getTreasury;

  async getProposalMetadata(id: string) {
    const items = await api.listProposalMetadata(id);
    return Object.fromEntries(items.map((m) => [m.proposalId, m]));
  }

  getActivity = api.activity;

  /** Payments in/out are derived from indexed contract events. */
  async getTransactions(id: string): Promise<TransactionRecord[]> {
    const [events, state] = await Promise.all([api.activity(id), this.getTreasuryState(id)]);
    return events
      .filter((e) => e.type === "proposal_executed" || e.type === "deposit")
      .map((e) => ({
        id: e.id,
        direction: e.type === "deposit" ? ("in" as const) : ("out" as const),
        amount: BigInt(String(e.data.amount ?? "0")),
        asset: state.managedAsset,
        counterparty: e.type === "deposit" ? e.actor : String(e.data.recipient ?? ""),
        at: e.at,
        ledger: e.ledger,
        txHash: e.txHash,
        proposalId: e.proposalId,
        departmentId: e.data.department ? String(e.data.department) : undefined,
      }));
  }

  getNotificationPreferences = (treasuryId: string) => api.getPreferences(treasuryId);

  updateTreasuryMetadata = (id: string, patch: Parameters<DataSource["updateTreasuryMetadata"]>[1]) =>
    api.updateTreasury(id, patch);

  saveNotificationPreferences = (treasuryId: string, _member: string, prefs: NotificationPreferences) =>
    api.savePreferences(treasuryId, prefs);

  async createTreasury(input: NewTreasuryInput, ctx: TxContext) {
    if (!config.factoryContractId) {
      throw new Error("NEXT_PUBLIC_FACTORY_CONTRACT_ID is not configured, so new treasuries cannot be deployed.");
    }
    const salt = xdr.ScVal.scvBytes(hash(Buffer.from(`${ctx.source}:${input.name}:${Date.now()}`)));
    const res = await invokeContract<string>(
      config.factoryContractId,
      "deploy",
      [addr(ctx.source), salt, xdr.ScVal.scvVec(input.members.map(encodeMember)), encodePolicy(input.policy)],
      ctx,
    );
    const id = String(res.value);
    // Metadata is best-effort: the treasury exists on-chain regardless.
    await api
      .registerTreasury({
        id,
        name: input.name,
        description: input.description,
        memberLabels: Object.fromEntries(input.members.filter((m) => m.label).map((m) => [m.address, m.label!])),
      })
      .catch(() => undefined);
    return { ...res, value: id };
  }

  addMember(
    id: string,
    member: { address: string; roles: OnChainTreasuryState["members"][number]["roles"] },
    ctx: TxContext,
  ) {
    return invokeContract<void>(id, "add_member", [addr(ctx.source), encodeMember(member)], ctx);
  }

  updateMemberRoles(
    id: string,
    address: string,
    roles: OnChainTreasuryState["members"][number]["roles"],
    ctx: TxContext,
  ) {
    return invokeContract<void>(id, "set_member_roles", [addr(ctx.source), addr(address), encodeRoles(roles)], ctx);
  }

  removeMember(id: string, address: string, ctx: TxContext) {
    return invokeContract<void>(id, "remove_member", [addr(ctx.source), addr(address)], ctx);
  }

  async setPolicy(id: string, policy: Parameters<DataSource["setPolicy"]>[1], ctx: TxContext) {
    const res = await invokeContract<number>(id, "set_policy", [addr(ctx.source), encodePolicy(policy)], ctx);
    return { ...res, value: Number(res.value) };
  }

  async proposePayment(id: string, input: NewProposalInput, ctx: TxContext) {
    const res = await invokeContract<bigint>(
      id,
      "propose_payment",
      [
        addr(ctx.source),
        addr(input.recipient),
        i128(input.amount),
        sym(input.departmentId),
        xdr.ScVal.scvBytes(metadataHash(input.title, input.description)),
      ],
      ctx,
    );
    const proposalId = Number(res.value);
    await api
      .saveProposalMetadata(id, { proposalId, title: input.title, description: input.description, txHash: res.hash })
      .catch(() => undefined);
    return { ...res, value: proposalId };
  }

  approvePayment(id: string, proposalId: number, ctx: TxContext) {
    return invokeContract<void>(id, "approve_payment", [addr(ctx.source), u64(proposalId)], ctx);
  }

  revokeApproval(id: string, proposalId: number, ctx: TxContext) {
    return invokeContract<void>(id, "revoke_approval", [addr(ctx.source), u64(proposalId)], ctx);
  }

  executePayment(id: string, proposalId: number, ctx: TxContext) {
    return invokeContract<void>(id, "execute_payment", [addr(ctx.source), u64(proposalId)], ctx);
  }

  cancelPayment(id: string, proposalId: number, ctx: TxContext) {
    return invokeContract<void>(id, "cancel_payment", [addr(ctx.source), u64(proposalId)], ctx);
  }
}
