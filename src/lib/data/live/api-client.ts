import { z } from "zod";
import { config } from "@/lib/config";
import type {
  ActivityEvent,
  NotificationPreferences,
  ProposalMetadata,
  TreasuryMetadata,
  TreasurySummary,
} from "@/lib/domain/types";
import { ROLES } from "@/lib/domain/types";
import { getSession, setSession } from "./session";

/**
 * Typed client for stellarsafe-api. Every response is validated with zod so a
 * backend change fails loudly here instead of rendering garbage.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const bigintStr = z.union([z.string().regex(/^-?\d+$/), z.number().int()]).transform((v) => BigInt(v));
const role = z.enum(ROLES as unknown as [string, ...string[]]);

const treasurySummary = z.object({
  id: z.string(),
  name: z.string(),
  roles: z.array(role),
  memberCount: z.number(),
  pendingCount: z.number(),
  managedAssetCode: z.string(),
  balance: bigintStr,
});

const treasuryMetadata = z.object({
  id: z.string(),
  name: z.string(),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  memberLabels: z.record(z.string(), z.string()).default({}),
});

const proposalMetadata = z.object({
  proposalId: z.number(),
  title: z.string(),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
});

const activityEvent = z.object({
  id: z.string(),
  treasuryId: z.string(),
  type: z.enum([
    "treasury_initialized",
    "deposit",
    "member_added",
    "member_removed",
    "member_roles_changed",
    "policy_updated",
    "proposal_created",
    "proposal_approved",
    "approval_revoked",
    "proposal_executed",
    "proposal_cancelled",
  ]),
  actor: z.string(),
  at: z.string().transform((v) => Date.parse(v)),
  ledger: z.number(),
  txHash: z.string(),
  proposalId: z
    .number()
    .nullish()
    .transform((v) => v ?? undefined),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

const prefs = z.object({
  email: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  webhookUrl: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
  events: z.object({
    approvalRequested: z.boolean(),
    proposalExecuted: z.boolean(),
    policyChanged: z.boolean(),
    memberChanged: z.boolean(),
  }),
});

const page = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  init: RequestInit & { auth?: boolean } = {},
): Promise<z.infer<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.auth) {
    const s = getSession();
    if (!s) throw new ApiError(401, "Sign in with your wallet to continue.");
    headers.set("Authorization", `Bearer ${s.token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Could not reach the StellarSafe API. Check your connection.");
  }

  if (res.status === 401) setSession(null);
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }

  const json = res.status === 204 ? {} : await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(500, `Unexpected API response for ${path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const api = {
  /* auth */
  challenge: (address: string) =>
    request("/auth/challenge", z.object({ challenge: z.string(), networkPassphrase: z.string().optional() }), {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  verify: (address: string, signedChallenge: string) =>
    request("/auth/verify", z.object({ token: z.string(), expiresAt: z.string() }), {
      method: "POST",
      body: JSON.stringify({ address, signedChallenge }),
    }),

  /* treasuries */
  listTreasuries: async (member: string): Promise<TreasurySummary[]> =>
    (await request(`/treasuries?member=${encodeURIComponent(member)}`, page(treasurySummary)))
      .items as TreasurySummary[],
  getTreasury: (id: string): Promise<TreasuryMetadata> => request(`/treasuries/${id}`, treasuryMetadata),
  updateTreasury: (id: string, patch: Partial<TreasuryMetadata>): Promise<TreasuryMetadata> =>
    request(`/treasuries/${id}`, treasuryMetadata, { method: "PATCH", body: JSON.stringify(patch), auth: true }),
  registerTreasury: (body: { id: string; name: string; description?: string; memberLabels: Record<string, string> }) =>
    request(`/treasuries`, treasuryMetadata, { method: "POST", body: JSON.stringify(body), auth: true }),

  /* proposals (metadata only — status/approvals are read from chain) */
  listProposalMetadata: async (id: string): Promise<ProposalMetadata[]> =>
    (await request(`/treasuries/${id}/proposals`, page(proposalMetadata))).items,
  saveProposalMetadata: (id: string, body: ProposalMetadata & { txHash: string }) =>
    request(`/treasuries/${id}/proposals`, proposalMetadata, {
      method: "POST",
      body: JSON.stringify(body),
      auth: true,
    }),

  /* indexer */
  activity: async (id: string): Promise<ActivityEvent[]> =>
    (await request(`/treasuries/${id}/activity?limit=500`, page(activityEvent))).items,

  /* notifications */
  getPreferences: (treasuryId: string): Promise<NotificationPreferences> =>
    request(`/notifications/preferences?treasuryId=${treasuryId}`, prefs, { auth: true }),
  savePreferences: (treasuryId: string, body: NotificationPreferences): Promise<NotificationPreferences> =>
    request(`/notifications/preferences`, prefs, {
      method: "POST",
      body: JSON.stringify({ treasuryId, ...body }),
      auth: true,
    }),

  health: () => request("/health", z.object({ status: z.string() })),
};
