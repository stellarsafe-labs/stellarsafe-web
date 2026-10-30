import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PolicyChecks } from "@/components/shared/policy-checks";
import type { previewDraft } from "@/lib/domain/policy";
import type { OnChainTreasuryState } from "@/lib/domain/types";

interface Props {
  state: OnChainTreasuryState;
  preview: ReturnType<typeof previewDraft> | null;
  /** Hide the allowlist check until a recipient is entered. */
  hasRecipient: boolean;
  submitDisabled: boolean;
  formId: string;
}

export function PolicyPreviewCard({ state, preview, hasRecipient, submitDisabled, formId }: Props) {
  const required = preview?.required ?? 1;
  const eligible = preview?.eligibleApprovers ?? 0;
  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>Policy preview</CardTitle>
        <CardDescription>
          Evaluated against policy v{state.policy.version} at ledger {state.ledger.toLocaleString()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="tabular text-2xl font-semibold">{required}</p>
          <p className="text-muted-foreground">
            approval{required === 1 ? "" : "s"} required · {eligible} eligible approver{eligible === 1 ? "" : "s"}
          </p>
        </div>
        {preview && <PolicyChecks checks={preview.checks.filter((c) => c.id !== "allowlist" || hasRecipient)} />}
        <p className="text-muted-foreground text-xs">
          Budget and balance are re-checked at execution. A proposal over the remaining budget can be submitted, but it
          can&apos;t execute until budget frees up (for example next month) within its approval window.
        </p>
        <Button type="submit" form={formId} className="w-full" disabled={submitDisabled}>
          <Send aria-hidden /> Review & submit
        </Button>
      </CardContent>
    </Card>
  );
}
