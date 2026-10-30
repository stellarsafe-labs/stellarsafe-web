"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { ProposalFormCard } from "@/components/features/new-proposal/proposal-form-card";
import { PolicyPreviewCard } from "@/components/features/new-proposal/policy-preview-card";
import { proposalSchema, type ProposalFormValues } from "@/components/features/new-proposal/schema";
import { TxSummary } from "@/components/tx/tx-summary";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { can, previewDraft } from "@/lib/domain/policy";
import { formatAmount, tryParseAmount } from "@/lib/domain/amount";
import { shortAddress } from "@/lib/stellar/address";
import { fmtTtl } from "@/lib/format";
import { useMe, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";

export function NewProposalView() {
  const id = useTreasuryId();
  const router = useRouter();
  const run = useTx();
  const { address, setConnectDialogOpen } = useWallet();
  const me = useMe(id);
  const { data: state } = useTreasuryState(id);

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: { title: "", description: "", recipient: "", amount: "", departmentId: "" },
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });

  const preview = useMemo(() => {
    if (!state) return null;
    const amount = tryParseAmount(values.amount ?? "") ?? 0n;
    const asset = state.managedAsset;
    return previewDraft(
      state,
      address ?? undefined,
      { recipient: values.recipient ?? "", amount, departmentId: values.departmentId ?? "" },
      { amount: (u) => `${formatAmount(u, { decimals: asset.decimals })} ${asset.code}` },
    );
  }, [state, address, values.amount, values.recipient, values.departmentId]);

  if (!state) return <Skeleton className="h-[480px]" />;

  const asset = state.managedAsset;
  const { policy } = state;
  const canPropose = can(me, "propose");

  const onSubmit = (v: ProposalFormValues) => {
    const amount = tryParseAmount(v.amount)!;
    const dept = policy.departments.find((d) => d.id === v.departmentId);
    const recipientLabel = policy.allowlist.find((a) => a.address === v.recipient)?.label;
    run({
      title: "Submit payment proposal",
      description: "This records the proposal on-chain. No funds move until it is approved and executed.",
      summary: (
        <TxSummary
          rows={[
            ["Title", v.title],
            ["Amount", `${formatAmount(amount, { decimals: asset.decimals })} ${asset.code}`],
            ["Recipient", `${recipientLabel ? `${recipientLabel} · ` : ""}${shortAddress(v.recipient, 6)}`],
            ["Department", dept?.name],
            ["Approvals needed", String(preview?.required ?? "—")],
            ["Approval window", fmtTtl(policy.approvalTtlSeconds)],
          ]}
        />
      ),
      confirmLabel: "Sign & submit",
      treasuryId: id,
      successMessage: "Proposal submitted",
      action: (ctx) =>
        getDataSource().proposePayment(
          id,
          {
            title: v.title,
            description: v.description || undefined,
            recipient: v.recipient,
            amount,
            departmentId: v.departmentId,
          },
          ctx,
        ),
      onSuccess: (res) => router.push(`/t/${id}/proposals/${res.value}`),
    });
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={`/t/${id}/proposals`}>
          <ArrowLeft aria-hidden /> Approvals
        </Link>
      </Button>
      <PageHeader
        title="New payment proposal"
        description="Propose a payment from the treasury. The contract enforces the current spending policy; the preview on the right shows what it will check."
      />

      {!address ? (
        <Alert className="mb-6">
          <Info aria-hidden />
          <AlertTitle>Connect a wallet to submit</AlertTitle>
          <AlertDescription>
            You can fill in the form, but the proposal must be signed by a member with the proposer or admin role.
            <Button size="sm" className="mt-2 w-fit" onClick={() => setConnectDialogOpen(true)}>
              Connect wallet
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        !canPropose && (
          <Alert className="mb-6" variant="destructive">
            <ShieldAlert aria-hidden />
            <AlertTitle>Your wallet can&apos;t propose payments</AlertTitle>
            <AlertDescription>Ask a treasury admin to grant you the proposer role.</AlertDescription>
          </Alert>
        )
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <ProposalFormCard
          className="lg:col-span-3"
          form={form}
          state={state}
          formId="proposal-form"
          onSubmit={form.handleSubmit(onSubmit)}
        />

        <div className="space-y-4 lg:col-span-2">
          <PolicyPreviewCard
            state={state}
            preview={preview}
            hasRecipient={!!values.recipient}
            formId="proposal-form"
            submitDisabled={
              !address ||
              !canPropose ||
              form.formState.isSubmitting ||
              (preview ? !preview.canSubmit && !!values.recipient : false)
            }
          />
        </div>
      </div>
    </>
  );
}
