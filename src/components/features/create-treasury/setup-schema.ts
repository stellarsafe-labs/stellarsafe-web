import { z } from "zod";
import type { PolicyFormValues } from "@/components/features/policy-form";
import { ROLES, type Role } from "@/lib/domain/types";
import { isStellarAddress } from "@/lib/stellar/address";

export const setupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(60),
    description: z.string().trim().max(280).optional(),
    members: z
      .array(
        z.object({
          address: z.string().trim().refine(isStellarAddress, "Invalid Stellar address"),
          label: z.string().trim().max(60).optional(),
          roles: z.array(z.enum(ROLES as unknown as [Role, ...Role[]])),
        }),
      )
      .min(1),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.members.forEach((m, i) => {
      if (seen.has(m.address))
        ctx.addIssue({ code: "custom", message: "Duplicate address", path: ["members", i, "address"] });
      seen.add(m.address);
    });
    if (!v.members.some((m) => m.roles.includes("admin"))) {
      ctx.addIssue({ code: "custom", message: "At least one member must be an admin.", path: ["members"] });
    }
  });

export type SetupValues = z.infer<typeof setupSchema>;

export const DEFAULT_POLICY: PolicyFormValues = {
  tiers: [
    { minAmount: "0", requiredApprovals: 1 },
    { minAmount: "500", requiredApprovals: 2 },
  ],
  allowlistEnabled: false,
  allowlist: [],
  departments: [
    { id: "operations", name: "Operations", monthlyLimit: "5000" },
    { id: "engineering", name: "Engineering", monthlyLimit: "10000" },
  ],
  approvalTtlDays: 7,
  allowSelfApproval: false,
};

export const STEPS = ["Details", "Members", "Policy", "Review"] as const;
