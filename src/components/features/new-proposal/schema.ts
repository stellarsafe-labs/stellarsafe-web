import { z } from "zod";
import { tryParseAmount } from "@/lib/domain/amount";
import { isStellarAddress } from "@/lib/stellar/address";

export const proposalSchema = z.object({
  title: z.string().trim().min(3, "Give the payment a short title").max(80, "Keep the title under 80 characters"),
  description: z.string().trim().max(2000, "Keep the description under 2,000 characters").optional(),
  recipient: z.string().trim().refine(isStellarAddress, "Enter a valid Stellar address (G… or C…)"),
  amount: z
    .string()
    .trim()
    .refine((v) => {
      const p = tryParseAmount(v);
      return p !== null && p > 0n;
    }, "Enter an amount greater than 0 (up to 7 decimals)"),
  departmentId: z.string().min(1, "Choose the budget this payment comes from"),
});

export type ProposalFormValues = z.infer<typeof proposalSchema>;
