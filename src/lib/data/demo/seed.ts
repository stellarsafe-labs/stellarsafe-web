import { periodKey } from "@/lib/domain/policy";
import type { ActivityEvent, ActivityType, Asset, OnChainPolicy, OnChainProposal, Role } from "@/lib/domain/types";
import { toUnits } from "@/lib/domain/amount";
import { type DemoDB, type DemoTreasury, ledgerAt, mulberry32, seededHex } from "./db";
import { DEMO_PERSONAS, demoAccount, demoContract } from "./personas";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const USDC: Asset = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  contractId: demoContract("usdc"),
  decimals: 7,
};

export const XLM: Asset = {
  code: "XLM",
  contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  decimals: 7,
};

const [ada, ben, chloe, dev, eve] = DEMO_PERSONAS;

export const VENDORS = {
  cloud: { address: demoAccount("vendor-nimbus"), label: "Nimbus Cloud" },
  audit: { address: demoAccount("vendor-ledgerline"), label: "Ledgerline Audit" },
  design: { address: demoAccount("vendor-pixelcraft"), label: "Pixelcraft Studio" },
  legal: { address: demoAccount("vendor-orbit-legal"), label: "Orbit Legal LLP" },
  payroll: { address: demoAccount("vendor-kite"), label: "Kite Payroll" },
  events: { address: demoAccount("vendor-assembly"), label: "Assembly Events" },
};

const usd = (n: number) => toUnits(Math.round(n * 100)) / 100n;

/** Small helper that appends history while keeping balances and spend consistent. */
class Timeline {
  rand = mulberry32(0x5afe);
  constructor(public t: DemoTreasury) {}

  hash() {
    return seededHex(this.rand);
  }

  event(
    type: ActivityType,
    actor: string,
    at: number,
    data: ActivityEvent["data"] = {},
    proposalId?: number,
    txHash = this.hash(),
  ) {
    this.t.activity.push({
      id: `${this.t.chain.id}:${this.t.activity.length}`,
      treasuryId: this.t.chain.id,
      type,
      actor,
      at,
      ledger: ledgerAt(at),
      txHash,
      proposalId,
      data,
    });
    return txHash;
  }

  deposit(from: string, amount: bigint, at: number, asset = USDC) {
    const hash = this.event("deposit", from, at, { amount: amount.toString(), asset: asset.code });
    this.t.chain.balances[asset.contractId] = (this.t.chain.balances[asset.contractId] ?? 0n) + amount;
    this.t.transactions.push({
      id: hash,
      direction: "in",
      amount,
      asset,
      counterparty: from,
      at,
      ledger: ledgerAt(at),
      txHash: hash,
    });
  }

  propose(opts: {
    proposer: string;
    recipient: string;
    amount: bigint;
    dept: string;
    title: string;
    description?: string;
    at: number;
    policy: OnChainPolicy;
  }): OnChainProposal {
    const id = this.t.chain.nextProposalId++;
    const p: OnChainProposal = {
      id,
      treasuryId: this.t.chain.id,
      proposer: opts.proposer,
      recipient: opts.recipient,
      amount: opts.amount,
      departmentId: opts.dept,
      policyVersion: opts.policy.version,
      createdAt: opts.at,
      expiresAt: opts.at + opts.policy.approvalTtlSeconds * 1000,
      status: "pending",
      approvals: [],
      metadataHash: this.hash(),
    };
    this.t.proposals.push(p);
    this.t.proposalMeta[id] = { proposalId: id, title: opts.title, description: opts.description };
    this.event(
      "proposal_created",
      opts.proposer,
      opts.at,
      { amount: opts.amount.toString(), recipient: opts.recipient, department: opts.dept },
      id,
    );
    return p;
  }

  approve(p: OnChainProposal, approver: string, at: number) {
    p.approvals.push({ approver, at, policyVersion: p.policyVersion });
    this.event("proposal_approved", approver, at, {}, p.id);
  }

  execute(p: OnChainProposal, by: string, at: number) {
    const hash = this.event("proposal_executed", by, at, { amount: p.amount.toString(), recipient: p.recipient }, p.id);
    p.status = "executed";
    p.executedAt = at;
    p.executedTxHash = hash;
    const c = this.t.chain;
    c.balances[c.managedAsset.contractId] -= p.amount;
    const key = periodKey(at);
    c.spend[key] ??= {};
    c.spend[key][p.departmentId] = (c.spend[key][p.departmentId] ?? 0n) + p.amount;
    this.t.transactions.push({
      id: hash,
      direction: "out",
      amount: p.amount,
      asset: c.managedAsset,
      counterparty: p.recipient,
      at,
      ledger: ledgerAt(at),
      txHash: hash,
      proposalId: p.id,
      departmentId: p.departmentId,
    });
  }

  cancel(p: OnChainProposal, by: string, at: number) {
    p.status = "cancelled";
    p.cancelledAt = at;
    p.cancelledBy = by;
    this.event("proposal_cancelled", by, at, {}, p.id);
  }

  /** Full lifecycle for historical payments. */
  paid(opts: Parameters<Timeline["propose"]>[0] & { approvers: string[]; executor?: string }) {
    const p = this.propose(opts);
    opts.approvers.forEach((a, i) => this.approve(p, a, opts.at + (i + 1) * 3 * HOUR));
    this.execute(p, opts.executor ?? opts.proposer, opts.at + (opts.approvers.length + 1) * 3 * HOUR);
    return p;
  }
}

function basePolicy(now: number, version: number, marketingLimit: number): OnChainPolicy {
  return {
    version,
    approvalTiers: [
      { minAmount: 0n, requiredApprovals: 1 },
      { minAmount: usd(500), requiredApprovals: 2 },
      { minAmount: usd(5000), requiredApprovals: 3 },
    ],
    allowlistEnabled: true,
    allowlist: Object.values(VENDORS),
    departments: [
      { id: "eng", name: "Engineering", monthlyLimit: usd(8000) },
      { id: "mkt", name: "Marketing", monthlyLimit: usd(marketingLimit) },
      { id: "ops", name: "Operations", monthlyLimit: usd(5000) },
      { id: "grants", name: "Ecosystem grants", monthlyLimit: usd(6000) },
    ],
    approvalTtlSeconds: 7 * 86_400,
    allowSelfApproval: false,
    updatedAt: now,
  };
}

function emptyTreasury(
  id: string,
  name: string,
  description: string,
  createdAt: number,
  policy: OnChainPolicy,
): DemoTreasury {
  return {
    chain: {
      id,
      managedAsset: USDC,
      balances: { [USDC.contractId]: 0n, [XLM.contractId]: 0n },
      members: [],
      policy,
      spend: {},
      createdAt,
      nextProposalId: 1,
    },
    proposals: [],
    metadata: { id, name, description, memberLabels: {} },
    proposalMeta: {},
    activity: [],
    transactions: [],
    prefs: {},
  };
}

function addMember(tl: Timeline, address: string, roles: Role[], at: number, label: string) {
  tl.t.chain.members.push({ address, roles, addedAt: at });
  tl.t.metadata.memberLabels[address] = label;
  tl.event("member_added", tl.t.chain.members[0]?.address ?? address, at, { member: address, roles: roles.join(",") });
}

function seedNebula(now: number): DemoTreasury {
  const id = demoContract("nebula-labs");
  const created = now - 170 * DAY;
  const v1 = basePolicy(created, 1, 3000);
  const t = emptyTreasury(
    id,
    "Nebula Labs Treasury",
    "Operating treasury for Nebula Labs. Policy changes require admin sign-off.",
    created,
    v1,
  );
  const tl = new Timeline(t);

  tl.event("treasury_initialized", ada.address, created, { asset: "USDC" });
  addMember(tl, ada.address, ["admin", "approver"], created, `${ada.name} · ${ada.title}`);
  addMember(tl, ben.address, ["approver"], created + HOUR, `${ben.name} · ${ben.title}`);
  addMember(tl, chloe.address, ["proposer"], created + HOUR, `${chloe.name} · ${chloe.title}`);
  addMember(tl, dev.address, ["proposer", "approver"], created + 2 * HOUR, `${dev.name} · ${dev.title}`);
  addMember(tl, eve.address, [], created + 30 * DAY, `${eve.name} · ${eve.title}`);
  tl.event("policy_updated", ada.address, created + 3 * HOUR, { version: 1 });

  const investor = demoAccount("investor-seed-round");
  tl.deposit(investor, usd(48_000), created + 4 * HOUR);
  tl.deposit(investor, toUnits(500), created + 4 * HOUR, XLM);

  // Monthly history: recurring vendors with some variance.
  const monthsBack = 5;
  for (let m = monthsBack; m >= 1; m--) {
    const d = new Date(now);
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, 1);
    const r = tl.rand;
    tl.paid({
      proposer: dev.address,
      recipient: VENDORS.cloud.address,
      amount: usd(1100 + Math.round(r() * 300)),
      dept: "eng",
      title: "Cloud infrastructure",
      at: start + 2 * DAY,
      policy: v1,
      approvers: [ada.address, ben.address],
    });
    tl.paid({
      proposer: chloe.address,
      recipient: VENDORS.payroll.address,
      amount: usd(3800 + Math.round(r() * 600)),
      dept: "eng",
      title: "Contractor payroll",
      at: start + 5 * DAY,
      policy: v1,
      approvers: [ada.address, dev.address],
    });
    tl.paid({
      proposer: chloe.address,
      recipient: VENDORS.design.address,
      amount: usd(600 + Math.round(r() * 1400)),
      dept: "mkt",
      title: "Design sprint",
      at: start + 9 * DAY,
      policy: v1,
      approvers: [ben.address, dev.address],
    });
    tl.paid({
      proposer: chloe.address,
      recipient: VENDORS.legal.address,
      amount: usd(250 + Math.round(r() * 200)),
      dept: "ops",
      title: "Legal retainer",
      at: start + 12 * DAY,
      policy: v1,
      approvers: [ada.address],
    });
    if (m % 2 === 1) {
      tl.paid({
        proposer: dev.address,
        recipient: VENDORS.events.address,
        amount: usd(2200 + Math.round(r() * 1500)),
        dept: "grants",
        title: "Hackathon prize pool",
        at: start + 15 * DAY,
        policy: v1,
        approvers: [ada.address, ben.address],
      });
    }
    if (m === 3) {
      const p = tl.propose({
        proposer: chloe.address,
        recipient: VENDORS.events.address,
        amount: usd(1800),
        dept: "mkt",
        title: "Conference sponsorship",
        description: "Cancelled — event moved online.",
        at: start + 18 * DAY,
        policy: v1,
      });
      tl.approve(p, ben.address, start + 18 * DAY + 4 * HOUR);
      tl.cancel(p, chloe.address, start + 20 * DAY);
    }
    tl.deposit(investor, usd(m === 2 ? 15_000 : 2_500), start + 20 * DAY);
  }

  // A stale proposal: created under v1, then the policy was updated to v2.
  const stale = tl.propose({
    proposer: dev.address,
    recipient: VENDORS.payroll.address,
    amount: usd(2000),
    dept: "eng",
    title: "Contractor payout — milestone 3",
    description: "Final milestone for the indexer rewrite.",
    at: now - 12 * DAY,
    policy: v1,
  });
  tl.approve(stale, ada.address, now - 12 * DAY + 5 * HOUR);
  tl.approve(stale, ben.address, now - 11 * DAY);

  const v2 = basePolicy(now - 10 * DAY, 2, 4000);
  t.chain.policy = v2;
  tl.event("policy_updated", ada.address, now - 10 * DAY, {
    version: 2,
    change: "Marketing monthly limit 3,000 → 4,000 USDC",
  });

  // Current month activity. Executed payments use the timestamps inside this period.
  const monthStart = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
  const inMonth = (dayOffset: number) => Math.min(now - HOUR, monthStart + dayOffset * DAY);
  tl.paid({
    proposer: dev.address,
    recipient: VENDORS.cloud.address,
    amount: usd(1310.4),
    dept: "eng",
    title: "Cloud infrastructure",
    at: inMonth(1),
    policy: v2,
    approvers: [ada.address, ben.address],
  });
  tl.paid({
    proposer: chloe.address,
    recipient: VENDORS.payroll.address,
    amount: usd(3900),
    dept: "eng",
    title: "Contractor payroll",
    at: inMonth(2),
    policy: v2,
    approvers: [ada.address, dev.address],
  });
  tl.paid({
    proposer: chloe.address,
    recipient: VENDORS.design.address,
    amount: usd(1850),
    dept: "mkt",
    title: "Landing page redesign",
    at: inMonth(3),
    policy: v2,
    approvers: [ben.address, dev.address],
  });
  tl.paid({
    proposer: chloe.address,
    recipient: VENDORS.legal.address,
    amount: usd(3940),
    dept: "ops",
    title: "Entity restructuring — legal fees",
    at: inMonth(4),
    policy: v2,
    approvers: [ada.address, ben.address],
  });

  // Expired: approval window closed before enough approvals arrived.
  const expired = tl.propose({
    proposer: chloe.address,
    recipient: VENDORS.events.address,
    amount: usd(750),
    dept: "mkt",
    title: "Meetup venue deposit",
    at: now - 9 * DAY,
    policy: v2,
  });
  tl.approve(expired, dev.address, now - 8 * DAY);

  // Ready to execute.
  const ready = tl.propose({
    proposer: chloe.address,
    recipient: VENDORS.design.address,
    amount: usd(900),
    dept: "mkt",
    title: "Brand refresh — final milestone",
    description: "Delivery of logo system, typography and illustration set. Invoice PX-2291.",
    at: now - 2 * DAY,
    policy: v2,
  });
  tl.approve(ready, ben.address, now - 2 * DAY + 6 * HOUR);
  tl.approve(ready, dev.address, now - DAY);

  // Needs one more approval.
  const cloud = tl.propose({
    proposer: dev.address,
    recipient: VENDORS.cloud.address,
    amount: usd(1240),
    dept: "eng",
    title: "GPU capacity for load testing",
    description: "One-off reservation ahead of the mainnet readiness review.",
    at: now - DAY,
    policy: v2,
  });
  tl.approve(cloud, ada.address, now - 20 * HOUR);

  // Blocked by the monthly limit even if approved.
  const audit = tl.propose({
    proposer: chloe.address,
    recipient: VENDORS.audit.address,
    amount: usd(4500),
    dept: "ops",
    title: "Security audit retainer",
    description:
      "Deposit for the Q1 contract audit. Operations budget is nearly used — consider moving to next period.",
    at: now - 6 * HOUR,
    policy: v2,
  });
  tl.approve(audit, ada.address, now - 4 * HOUR);

  // Fresh, small, needs a single approval.
  tl.propose({
    proposer: dev.address,
    recipient: VENDORS.events.address,
    amount: usd(320),
    dept: "ops",
    title: "Team offsite catering",
    at: now - 2 * HOUR,
    policy: v2,
  });

  t.activity.sort((a, b) => b.at - a.at);
  t.transactions.sort((a, b) => b.at - a.at);
  return t;
}

function seedGrants(now: number): DemoTreasury {
  const id = demoContract("orbit-grants");
  const created = now - 60 * DAY;
  const policy: OnChainPolicy = {
    version: 1,
    approvalTiers: [
      { minAmount: 0n, requiredApprovals: 2 },
      { minAmount: usd(10_000), requiredApprovals: 3 },
    ],
    allowlistEnabled: false,
    allowlist: [],
    departments: [{ id: "grants", name: "Community grants", monthlyLimit: usd(25_000) }],
    approvalTtlSeconds: 14 * 86_400,
    allowSelfApproval: false,
    updatedAt: created,
  };
  const t = emptyTreasury(
    id,
    "Orbit Grants Committee",
    "Community grants program run by a three-member committee.",
    created,
    policy,
  );
  const tl = new Timeline(t);
  tl.event("treasury_initialized", ben.address, created, { asset: "USDC" });
  addMember(tl, ben.address, ["admin", "approver"], created, `${ben.name} · Committee chair`);
  addMember(tl, ada.address, ["approver"], created, `${ada.name} · Committee member`);
  addMember(tl, eve.address, ["approver", "proposer"], created, `${eve.name} · Committee member`);
  tl.event("policy_updated", ben.address, created + HOUR, { version: 1 });
  tl.deposit(demoAccount("foundation"), usd(75_000), created + 2 * HOUR);
  const grantee = demoAccount("grantee-wasm-tools");
  tl.paid({
    proposer: eve.address,
    recipient: grantee,
    amount: usd(9_500),
    dept: "grants",
    title: "Grant: Soroban WASM tooling",
    at: now - 30 * DAY,
    policy,
    approvers: [ada.address, ben.address],
    executor: ben.address,
  });
  const p = tl.propose({
    proposer: eve.address,
    recipient: demoAccount("grantee-edu"),
    amount: usd(4_000),
    dept: "grants",
    title: "Grant: Stellar developer workshop series",
    at: now - 3 * DAY,
    policy,
  });
  tl.approve(p, ben.address, now - 2 * DAY);
  t.activity.sort((a, b) => b.at - a.at);
  t.transactions.sort((a, b) => b.at - a.at);
  return t;
}

export function seedDemo(now: number): DemoDB {
  const nebula = seedNebula(now);
  const grants = seedGrants(now);
  return {
    schema: 2,
    seededAt: now,
    treasuries: { [nebula.chain.id]: nebula, [grants.chain.id]: grants },
  };
}
