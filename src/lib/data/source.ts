import type {
  ActivityEvent,
  NotificationPreferences,
  OnChainMember,
  OnChainProposal,
  OnChainTreasuryState,
  PolicyInput,
  ProposalMetadata,
  Role,
  TransactionRecord,
  TreasuryMetadata,
  TreasurySummary,
} from "@/lib/domain/types";

/**
 * Signs a base64 transaction envelope with the connected wallet and returns
 * the signed envelope. Provided by the wallet layer, never by the backend.
 */
export type TxSigner = (xdr: string) => Promise<string>;

export type TxStage = "building" | "simulating" | "signing" | "submitting" | "confirming";

export interface TxContext {
  source: string;
  sign: TxSigner;
  onStage?: (stage: TxStage) => void;
}

export interface TxResult<T = void> {
  hash: string;
  ledger: number;
  value: T;
}

export interface NewTreasuryInput {
  name: string;
  description?: string;
  members: { address: string; roles: Role[]; label?: string }[];
  policy: PolicyInput;
}

export interface NewProposalInput {
  title: string;
  description?: string;
  recipient: string;
  amount: bigint;
  departmentId: string;
}

/**
 * Everything the UI needs. Read methods for money-related state go to the
 * chain; metadata/indexed history goes to the API. Write methods always go
 * through the user's wallet.
 */
export interface DataSource {
  readonly kind: "demo" | "live";

  /* ---- chain reads (authoritative) ---- */
  getTreasuryState(treasuryId: string): Promise<OnChainTreasuryState>;
  getProposals(treasuryId: string): Promise<OnChainProposal[]>;
  getProposal(treasuryId: string, proposalId: number): Promise<OnChainProposal>;

  /* ---- API reads (metadata + indexer) ---- */
  listTreasuries(member: string): Promise<TreasurySummary[]>;
  getTreasuryMetadata(treasuryId: string): Promise<TreasuryMetadata>;
  getProposalMetadata(treasuryId: string): Promise<Record<number, ProposalMetadata>>;
  getActivity(treasuryId: string): Promise<ActivityEvent[]>;
  getTransactions(treasuryId: string): Promise<TransactionRecord[]>;
  getNotificationPreferences(treasuryId: string, member: string): Promise<NotificationPreferences>;

  /* ---- API writes (metadata only, never authority) ---- */
  updateTreasuryMetadata(
    treasuryId: string,
    patch: Partial<Pick<TreasuryMetadata, "name" | "description" | "memberLabels">>,
    actor: string,
  ): Promise<TreasuryMetadata>;
  saveNotificationPreferences(
    treasuryId: string,
    member: string,
    prefs: NotificationPreferences,
  ): Promise<NotificationPreferences>;

  /* ---- contract writes (signed by the user's wallet) ---- */
  createTreasury(input: NewTreasuryInput, ctx: TxContext): Promise<TxResult<string>>;
  addMember(treasuryId: string, member: Omit<OnChainMember, "addedAt">, ctx: TxContext): Promise<TxResult>;
  updateMemberRoles(treasuryId: string, address: string, roles: Role[], ctx: TxContext): Promise<TxResult>;
  removeMember(treasuryId: string, address: string, ctx: TxContext): Promise<TxResult>;
  setPolicy(treasuryId: string, policy: PolicyInput, ctx: TxContext): Promise<TxResult<number>>;
  proposePayment(treasuryId: string, input: NewProposalInput, ctx: TxContext): Promise<TxResult<number>>;
  approvePayment(treasuryId: string, proposalId: number, ctx: TxContext): Promise<TxResult>;
  revokeApproval(treasuryId: string, proposalId: number, ctx: TxContext): Promise<TxResult>;
  executePayment(treasuryId: string, proposalId: number, ctx: TxContext): Promise<TxResult>;
  cancelPayment(treasuryId: string, proposalId: number, ctx: TxContext): Promise<TxResult>;
}
