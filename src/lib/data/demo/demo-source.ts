import { Buffer } from "buffer";
import {
  approvalBlocker,
  can,
  countValidApprovals,
  findMember,
  periodKey,
  requiredApprovals,
  validatePolicy,
} from "@/lib/domain/policy";
import {
  type ActivityEvent,
  ContractError,
  type NotificationPreferences,
  type OnChainTreasuryState,
  type TreasurySummary,
} from "@/lib/domain/types";
import type { DataSource, TxContext, TxResult } from "../source";
import { type DemoDB, type DemoTreasury, STORAGE_KEY, deserialize, ledgerAt, randomHex, serialize } from "./db";
import { demoContract } from "./personas";
import { USDC, XLM, seedDemo } from "./seed";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Simulated network latency, shortened in tests. */
const latency = (ms: number) => sleep(process.env.NODE_ENV === "test" ? 0 : ms);

const DEFAULT_PREFS: NotificationPreferences = {
  events: { approvalRequested: true, proposalExecuted: true, policyChanged: true, memberChanged: false },
};

type Clock = () => number;

export interface DemoSourceOptions {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  clock?: Clock;
}

/**
 * An in-browser simulation of the StellarSafe contracts + API.
 *
 * Every write runs the same checks the contract does (sharing the pure
 * functions in `domain/policy.ts`), goes through the wallet signer, and only
 * then mutates state, so the UI exercises exactly the same code paths as
 * against a real network.
 */
export class DemoDataSource implements DataSource {
  readonly kind = "demo" as const;
  private db: DemoDB | null = null;
  private storage: DemoSourceOptions["storage"];
  private now: Clock;

  constructor(opts: DemoSourceOptions = {}) {
    this.storage = opts.storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    this.now = opts.clock ?? Date.now;
  }

  /* ------------------------------------------------------------ */
  /* storage                                                       */
  /* ------------------------------------------------------------ */

  private load(): DemoDB {
    if (this.db) return this.db;
    const raw = this.storage?.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = deserialize(raw);
        if (parsed.schema === 2) {
          this.db = parsed;
          return parsed;
        }
      } catch {
        // fall through to reseed
      }
    }
    this.db = seedDemo(this.now());
    this.persist();
    return this.db;
  }

  /** Re-read from storage (e.g. another tab changed it). */
  refresh() {
    this.db = null;
  }

  reset() {
    this.storage?.removeItem(STORAGE_KEY);
    this.db = null;
  }

  private persist() {
    if (this.db) this.storage?.setItem(STORAGE_KEY, serialize(this.db));
  }

  private treasury(id: string): DemoTreasury {
    const t = this.load().treasuries[id];
    if (!t)
      throw new ContractError("NotInitialized", "No treasury contract found at this address on the demo network.");
    return t;
  }

  /* ------------------------------------------------------------ */
  /* chain reads                                                   */
  /* ------------------------------------------------------------ */

  private stateOf(t: DemoTreasury): OnChainTreasuryState {
    const now = this.now();
    const key = periodKey(now);
    const c = t.chain;
    return structuredClone({
      id: c.id,
      managedAsset: c.managedAsset,
      balances: [
        { asset: c.managedAsset, amount: c.balances[c.managedAsset.contractId] ?? 0n },
        { asset: XLM, amount: c.balances[XLM.contractId] ?? 0n },
      ],
      members: c.members,
      policy: c.policy,
      periodSpend: c.spend[key] ?? {},
      periodKey: key,
      createdAt: c.createdAt,
      proposalCount: c.nextProposalId - 1,
      ledger: ledgerAt(now),
      readAt: now,
    });
  }

  async getTreasuryState(id: string) {
    await latency(250);
    return this.stateOf(this.treasury(id));
  }

  async getProposals(id: string) {
    await latency(250);
    return structuredClone(this.treasury(id).proposals).sort((a, b) => b.id - a.id);
  }

  async getProposal(id: string, proposalId: number) {
    await latency(150);
    const p = this.treasury(id).proposals.find((x) => x.id === proposalId);
    if (!p) throw new ContractError("ProposalNotFound");
    return structuredClone(p);
  }

  /* ------------------------------------------------------------ */
  /* API reads                                                     */
  /* ------------------------------------------------------------ */

  async listTreasuries(member: string): Promise<TreasurySummary[]> {
    await latency(200);
    return Object.values(this.load().treasuries)
      .map((t) => ({ t, m: t.chain.members.find((x) => x.address === member) }))
      .filter(({ m }) => !!m)
      .map(({ t, m }) => ({
        id: t.chain.id,
        name: t.metadata.name,
        roles: m!.roles,
        memberCount: t.chain.members.length,
        pendingCount: t.proposals.filter((p) => p.status === "pending" && p.expiresAt > this.now()).length,
        managedAssetCode: t.chain.managedAsset.code,
        balance: t.chain.balances[t.chain.managedAsset.contractId] ?? 0n,
      }));
  }

  async getTreasuryMetadata(id: string) {
    await latency(120);
    return structuredClone(this.treasury(id).metadata);
  }

  async getProposalMetadata(id: string) {
    await latency(120);
    return structuredClone(this.treasury(id).proposalMeta);
  }

  async getActivity(id: string): Promise<ActivityEvent[]> {
    await latency(200);
    return structuredClone(this.treasury(id).activity);
  }

  async getTransactions(id: string) {
    await latency(200);
    return structuredClone(this.treasury(id).transactions);
  }

  async getNotificationPreferences(id: string, member: string) {
    await latency(120);
    return structuredClone(this.treasury(id).prefs[member] ?? DEFAULT_PREFS);
  }

  /* ------------------------------------------------------------ */
  /* API writes (metadata)                                         */
  /* ------------------------------------------------------------ */

  async updateTreasuryMetadata(
    id: string,
    patch: Partial<Pick<DemoTreasury["metadata"], "name" | "description" | "memberLabels">>,
    actor: string,
  ) {
    await latency(300);
    const t = this.treasury(id);
    // The API checks the wallet-authenticated session against on-chain admin role.
    if (!can(findMember(t.chain, actor), "manage_members")) throw new ContractError("Unauthorized");
    t.metadata = {
      ...t.metadata,
      ...patch,
      memberLabels: { ...t.metadata.memberLabels, ...patch.memberLabels },
    };
    this.persist();
    return structuredClone(t.metadata);
  }

  async saveNotificationPreferences(id: string, member: string, prefs: NotificationPreferences) {
    await latency(300);
    const t = this.treasury(id);
    if (!findMember(t.chain, member)) throw new ContractError("NotMember");
    t.prefs[member] = structuredClone(prefs);
    this.persist();
    return prefs;
  }

  /* ------------------------------------------------------------ */
  /* contract writes                                               */
  /* ------------------------------------------------------------ */

  /**
   * Runs a contract call: simulate on a copy (surfacing contract errors
   * before the wallet prompt), ask the wallet to sign, then apply.
   */
  private async invoke<T>(
    treasuryId: string | null,
    fn: string,
    args: unknown,
    ctx: TxContext,
    apply: (db: DemoDB, env: { now: number; hash: string; ledger: number }) => T,
  ): Promise<TxResult<T>> {
    ctx.onStage?.("building");
    await latency(200);
    if (treasuryId) this.treasury(treasuryId); // existence check

    ctx.onStage?.("simulating");
    await latency(350);
    const now = this.now();
    const env = { now, hash: randomHex(), ledger: ledgerAt(now) };
    apply(structuredClone(this.load()), env); // throws ContractError like a failed simulation

    ctx.onStage?.("signing");
    const envelope = Buffer.from(
      JSON.stringify({ network: "demo", contract: treasuryId, fn, args, source: ctx.source }, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ).toString("base64");
    await ctx.sign(envelope);

    ctx.onStage?.("submitting");
    await latency(450);
    ctx.onStage?.("confirming");
    await latency(800);

    const db = this.load();
    const value = apply(db, { ...env, now: this.now(), ledger: ledgerAt(this.now()) });
    this.persist();
    return { hash: env.hash, ledger: env.ledger, value };
  }

  private log(t: DemoTreasury, e: Omit<ActivityEvent, "id" | "treasuryId">) {
    t.activity.unshift({
      ...e,
      id: `${t.chain.id}:${t.activity.length}:${e.txHash.slice(0, 8)}`,
      treasuryId: t.chain.id,
    });
  }

  private requireAdmin(t: DemoTreasury, who: string) {
    if (!can(findMember(t.chain, who), "manage_members")) throw new ContractError("Unauthorized");
  }

  async createTreasury(input: Parameters<DataSource["createTreasury"]>[0], ctx: TxContext) {
    return this.invoke(null, "initialize", input, ctx, (db, env) => {
      if (!input.members.some((m) => m.address === ctx.source && m.roles.includes("admin"))) {
        throw new ContractError("InvalidPolicy", "The deploying wallet must be an admin of the new treasury.");
      }
      const members = input.members.map((m) => ({ address: m.address, roles: m.roles, addedAt: env.now }));
      const errors = validatePolicy(input.policy, members);
      if (errors.length) throw new ContractError("InvalidPolicy", errors[0]);

      const id = demoContract(`${input.name}:${env.hash}`);
      const t: DemoTreasury = {
        chain: {
          id,
          managedAsset: USDC,
          balances: { [USDC.contractId]: 0n, [XLM.contractId]: 0n },
          members,
          policy: { ...input.policy, version: 1, updatedAt: env.now },
          spend: {},
          createdAt: env.now,
          nextProposalId: 1,
        },
        proposals: [],
        metadata: {
          id,
          name: input.name,
          description: input.description,
          memberLabels: Object.fromEntries(input.members.filter((m) => m.label).map((m) => [m.address, m.label!])),
        },
        proposalMeta: {},
        activity: [],
        transactions: [],
        prefs: {},
      };
      const base = { actor: ctx.source, at: env.now, ledger: env.ledger, txHash: env.hash };
      this.log(t, { ...base, type: "treasury_initialized", data: { asset: USDC.code } });
      for (const m of members)
        this.log(t, { ...base, type: "member_added", data: { member: m.address, roles: m.roles.join(",") } });
      this.log(t, { ...base, type: "policy_updated", data: { version: 1 } });
      db.treasuries[id] = t;
      return id;
    });
  }

  async addMember(
    id: string,
    member: { address: string; roles: DemoTreasury["chain"]["members"][number]["roles"] },
    ctx: TxContext,
  ) {
    return this.invoke(id, "add_member", member, ctx, (db, env) => {
      const t = db.treasuries[id];
      this.requireAdmin(t, ctx.source);
      if (findMember(t.chain, member.address)) throw new ContractError("MemberExists");
      t.chain.members.push({ ...member, addedAt: env.now });
      this.log(t, {
        type: "member_added",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        data: { member: member.address, roles: member.roles.join(",") },
      });
    });
  }

  async updateMemberRoles(
    id: string,
    address: string,
    roles: DemoTreasury["chain"]["members"][number]["roles"],
    ctx: TxContext,
  ) {
    return this.invoke(id, "set_member_roles", { address, roles }, ctx, (db, env) => {
      const t = db.treasuries[id];
      this.requireAdmin(t, ctx.source);
      const m = findMember(t.chain, address);
      if (!m) throw new ContractError("NotMember");
      if (
        m.roles.includes("admin") &&
        !roles.includes("admin") &&
        t.chain.members.filter((x) => x.roles.includes("admin")).length === 1
      ) {
        throw new ContractError("LastAdmin");
      }
      const next = t.chain.members.map((x) => (x.address === address ? { ...x, roles } : x));
      const errors = validatePolicy(t.chain.policy, next);
      if (errors.length)
        throw new ContractError("InvalidPolicy", `This change would break the current policy: ${errors[0]}`);
      m.roles = roles;
      this.log(t, {
        type: "member_roles_changed",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        data: { member: address, roles: roles.join(",") },
      });
    });
  }

  async removeMember(id: string, address: string, ctx: TxContext) {
    return this.invoke(id, "remove_member", { address }, ctx, (db, env) => {
      const t = db.treasuries[id];
      this.requireAdmin(t, ctx.source);
      const m = findMember(t.chain, address);
      if (!m) throw new ContractError("NotMember");
      const remaining = t.chain.members.filter((x) => x.address !== address);
      if (!remaining.some((x) => x.roles.includes("admin"))) throw new ContractError("LastAdmin");
      const errors = validatePolicy(t.chain.policy, remaining);
      if (errors.length)
        throw new ContractError("InvalidPolicy", `Removing this member would break the current policy: ${errors[0]}`);
      t.chain.members = remaining;
      // Approvals by removed members stop counting automatically (see countValidApprovals).
      this.log(t, {
        type: "member_removed",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        data: { member: address },
      });
    });
  }

  async setPolicy(id: string, policy: Parameters<DataSource["setPolicy"]>[1], ctx: TxContext) {
    return this.invoke(id, "set_policy", policy, ctx, (db, env) => {
      const t = db.treasuries[id];
      if (!can(findMember(t.chain, ctx.source), "manage_policy")) throw new ContractError("Unauthorized");
      const errors = validatePolicy(policy, t.chain.members);
      if (errors.length) throw new ContractError("InvalidPolicy", errors[0]);
      const version = t.chain.policy.version + 1;
      t.chain.policy = { ...structuredClone(policy), version, updatedAt: env.now };
      const invalidated = t.proposals.filter((p) => p.status === "pending" && p.approvals.length > 0).length;
      this.log(t, {
        type: "policy_updated",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        data: { version, invalidatedProposals: invalidated },
      });
      return version;
    });
  }

  async proposePayment(id: string, input: Parameters<DataSource["proposePayment"]>[1], ctx: TxContext) {
    return this.invoke(id, "propose_payment", input, ctx, (db, env) => {
      const t = db.treasuries[id];
      const { policy } = t.chain;
      if (!can(findMember(t.chain, ctx.source), "propose")) throw new ContractError("Unauthorized");
      if (input.amount <= 0n) throw new ContractError("InvalidAmount");
      if (!policy.departments.some((d) => d.id === input.departmentId)) throw new ContractError("UnknownDepartment");
      if (policy.allowlistEnabled && !policy.allowlist.some((a) => a.address === input.recipient)) {
        throw new ContractError("RecipientNotAllowed");
      }
      const pid = t.chain.nextProposalId++;
      t.proposals.push({
        id: pid,
        treasuryId: id,
        proposer: ctx.source,
        recipient: input.recipient,
        amount: input.amount,
        departmentId: input.departmentId,
        policyVersion: policy.version,
        createdAt: env.now,
        expiresAt: env.now + policy.approvalTtlSeconds * 1000,
        status: "pending",
        approvals: [],
        metadataHash: randomHex(),
      });
      t.proposalMeta[pid] = { proposalId: pid, title: input.title, description: input.description };
      this.log(t, {
        type: "proposal_created",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        proposalId: pid,
        data: { amount: input.amount.toString(), recipient: input.recipient, department: input.departmentId },
      });
      return pid;
    });
  }

  async approvePayment(id: string, proposalId: number, ctx: TxContext) {
    return this.invoke(id, "approve_payment", { proposalId }, ctx, (db, env) => {
      const t = db.treasuries[id];
      const p = t.proposals.find((x) => x.id === proposalId);
      if (!p) throw new ContractError("ProposalNotFound");
      const blocker = approvalBlocker(this.stateOf(t), p, ctx.source, env.now);
      if (blocker) {
        if (p.status !== "pending") throw new ContractError("ProposalNotPending");
        if (env.now > p.expiresAt) throw new ContractError("ProposalExpired");
        if (p.policyVersion !== t.chain.policy.version) throw new ContractError("PolicyVersionMismatch");
        if (p.approvals.some((a) => a.approver === ctx.source)) throw new ContractError("AlreadyApproved");
        if (p.proposer === ctx.source && !t.chain.policy.allowSelfApproval)
          throw new ContractError("SelfApprovalForbidden");
        throw new ContractError("Unauthorized");
      }
      p.approvals.push({ approver: ctx.source, at: env.now, policyVersion: t.chain.policy.version });
      this.log(t, {
        type: "proposal_approved",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        proposalId,
        data: {},
      });
    });
  }

  async revokeApproval(id: string, proposalId: number, ctx: TxContext) {
    return this.invoke(id, "revoke_approval", { proposalId }, ctx, (db, env) => {
      const t = db.treasuries[id];
      const p = t.proposals.find((x) => x.id === proposalId);
      if (!p) throw new ContractError("ProposalNotFound");
      if (p.status !== "pending") throw new ContractError("ProposalNotPending");
      if (!p.approvals.some((a) => a.approver === ctx.source)) throw new ContractError("NotApproved");
      p.approvals = p.approvals.filter((a) => a.approver !== ctx.source);
      this.log(t, {
        type: "approval_revoked",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        proposalId,
        data: {},
      });
    });
  }

  async executePayment(id: string, proposalId: number, ctx: TxContext) {
    return this.invoke(id, "execute_payment", { proposalId }, ctx, (db, env) => {
      const t = db.treasuries[id];
      const c = t.chain;
      const p = t.proposals.find((x) => x.id === proposalId);
      if (!p) throw new ContractError("ProposalNotFound");
      if (!can(findMember(c, ctx.source), "execute")) throw new ContractError("Unauthorized");
      // Duplicate-execution guard: status flips before transfer, in the same atomic call.
      if (p.status !== "pending") throw new ContractError("ProposalNotPending");
      if (env.now > p.expiresAt) throw new ContractError("ProposalExpired");
      if (p.policyVersion !== c.policy.version) throw new ContractError("PolicyVersionMismatch");
      const state = this.stateOf(t);
      if (countValidApprovals(state, p).valid.length < requiredApprovals(c.policy, p.amount)) {
        throw new ContractError("InsufficientApprovals");
      }
      if (c.policy.allowlistEnabled && !c.policy.allowlist.some((a) => a.address === p.recipient)) {
        throw new ContractError("RecipientNotAllowed");
      }
      const dept = c.policy.departments.find((d) => d.id === p.departmentId);
      if (!dept) throw new ContractError("UnknownDepartment");
      const key = periodKey(env.now);
      const spent = c.spend[key]?.[dept.id] ?? 0n;
      if (spent + p.amount > dept.monthlyLimit) throw new ContractError("MonthlyLimitExceeded");
      const bal = c.balances[c.managedAsset.contractId] ?? 0n;
      if (bal < p.amount) throw new ContractError("InsufficientBalance");

      p.status = "executed";
      p.executedAt = env.now;
      p.executedTxHash = env.hash;
      c.balances[c.managedAsset.contractId] = bal - p.amount;
      c.spend[key] = { ...c.spend[key], [dept.id]: spent + p.amount };
      t.transactions.unshift({
        id: env.hash,
        direction: "out",
        amount: p.amount,
        asset: c.managedAsset,
        counterparty: p.recipient,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        proposalId,
        departmentId: dept.id,
      });
      this.log(t, {
        type: "proposal_executed",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        proposalId,
        data: { amount: p.amount.toString(), recipient: p.recipient },
      });
    });
  }

  async cancelPayment(id: string, proposalId: number, ctx: TxContext) {
    return this.invoke(id, "cancel_payment", { proposalId }, ctx, (db, env) => {
      const t = db.treasuries[id];
      const p = t.proposals.find((x) => x.id === proposalId);
      if (!p) throw new ContractError("ProposalNotFound");
      if (p.status !== "pending") throw new ContractError("ProposalNotPending");
      const member = findMember(t.chain, ctx.source);
      if (p.proposer !== ctx.source && !can(member, "cancel_any")) throw new ContractError("Unauthorized");
      p.status = "cancelled";
      p.cancelledAt = env.now;
      p.cancelledBy = ctx.source;
      this.log(t, {
        type: "proposal_cancelled",
        actor: ctx.source,
        at: env.now,
        ledger: env.ledger,
        txHash: env.hash,
        proposalId,
        data: {},
      });
    });
  }

  /** Demo-only: simulate an incoming transfer to the treasury contract. */
  async simulateDeposit(id: string, from: string, amount: bigint) {
    await latency(600);
    const t = this.treasury(id);
    const now = this.now();
    const hash = randomHex();
    const c = t.chain;
    c.balances[c.managedAsset.contractId] = (c.balances[c.managedAsset.contractId] ?? 0n) + amount;
    t.transactions.unshift({
      id: hash,
      direction: "in",
      amount,
      asset: c.managedAsset,
      counterparty: from,
      at: now,
      ledger: ledgerAt(now),
      txHash: hash,
    });
    this.log(t, {
      type: "deposit",
      actor: from,
      at: now,
      ledger: ledgerAt(now),
      txHash: hash,
      data: { amount: amount.toString(), asset: c.managedAsset.code },
    });
    this.persist();
  }
}
