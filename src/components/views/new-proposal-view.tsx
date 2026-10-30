"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Info, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { PolicyChecks } from "@/components/shared/policy-checks";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { can, previewDraft } from "@/lib/domain/policy";
import { formatAmount, tryParseAmount } from "@/lib/domain/amount";
import { isStellarAddress, shortAddress } from "@/lib/stellar/address";
import { fmtTtl } from "@/lib/format";
import { useMe, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";

const schema = z.object({
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

type FormValues = z.infer<typeof schema>;

export function NewProposalView() {
  const id = useTreasuryId();
  const router = useRouter();
  const run = useTx();
  const { address, setConnectDialogOpen } = useWallet();
  const me = useMe(id);
  const { data: state } = useTreasuryState(id);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
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

  const onSubmit = (v: FormValues) => {
    const amount = tryParseAmount(v.amount)!;
    const dept = policy.departments.find((d) => d.id === v.departmentId);
    const recipientLabel = policy.allowlist.find((a) => a.address === v.recipient)?.label;
    run({
      title: "Submit payment proposal",
      description: "This records the proposal on-chain. No funds move until it is approved and executed.",
      summary: (
        <dl className="divide-y rounded-lg border text-sm">
          {[
            ["Title", v.title],
            ["Amount", `${formatAmount(amount, { decimals: asset.decimals })} ${asset.code}`],
            ["Recipient", `${recipientLabel ? `${recipientLabel} · ` : ""}${shortAddress(v.recipient, 6)}`],
            ["Department", dept?.name],
            ["Approvals needed", String(preview?.required ?? "—")],
            ["Approval window", fmtTtl(policy.approvalTtlSeconds)],
          ].map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium break-words">{val}</dd>
            </div>
          ))}
        </dl>
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
        <Card className="lg:col-span-3">
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate id="proposal-form">
              <FieldGroup>
                <Controller
                  name="title"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="title">Title</FieldLabel>
                      <Input
                        id="title"
                        placeholder="e.g. Cloud infrastructure — November"
                        aria-invalid={fieldState.invalid}
                        {...field}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <Controller
                  name="recipient"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="recipient">Recipient</FieldLabel>
                      {policy.allowlistEnabled ? (
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            field.onBlur();
                          }}
                        >
                          <SelectTrigger id="recipient" className="w-full" aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Choose an allowlisted recipient" />
                          </SelectTrigger>
                          <SelectContent>
                            {policy.allowlist.map((a) => (
                              <SelectItem key={a.address} value={a.address}>
                                {a.label}
                                <span className="text-muted-foreground font-mono text-xs">
                                  {shortAddress(a.address)}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="recipient"
                          placeholder="G… or C…"
                          className="font-mono"
                          spellCheck={false}
                          autoComplete="off"
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                      )}
                      <FieldDescription>
                        {policy.allowlistEnabled
                          ? "The policy only allows payments to allowlisted addresses. Admins can add recipients in Spending policy."
                          : "Double-check the address. Payments on Stellar are irreversible."}
                      </FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />

                <div className="grid gap-6 sm:grid-cols-2">
                  <Controller
                    name="amount"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor="amount">Amount</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="amount"
                            inputMode="decimal"
                            placeholder="0.00"
                            className="tabular"
                            aria-invalid={fieldState.invalid}
                            {...field}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>{asset.code}</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    name="departmentId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor="department">Budget</FieldLabel>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            field.onBlur();
                          }}
                        >
                          <SelectTrigger id="department" className="w-full" aria-invalid={fieldState.invalid}>
                            <SelectValue placeholder="Department" />
                          </SelectTrigger>
                          <SelectContent>
                            {policy.departments.map((d) => {
                              const left = d.monthlyLimit - (state.periodSpend[d.id] ?? 0n);
                              return (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                  <span className="text-muted-foreground tabular text-xs">
                                    {formatAmount(left > 0n ? left : 0n, { decimals: asset.decimals, maxFraction: 0 })}{" "}
                                    left
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  name="description"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor="description">
                        Description <span className="text-muted-foreground font-normal">(optional)</span>
                      </FieldLabel>
                      <Textarea
                        id="description"
                        rows={4}
                        placeholder="Invoice number, context for approvers…"
                        aria-invalid={fieldState.invalid}
                        {...field}
                      />
                      <FieldDescription>
                        Stored off-chain; its hash is anchored in the on-chain proposal.
                      </FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle>Policy preview</CardTitle>
              <CardDescription>
                Evaluated against policy v{policy.version} at ledger {state.ledger.toLocaleString()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="tabular text-2xl font-semibold">{preview?.required ?? 1}</p>
                <p className="text-muted-foreground">
                  approval{preview?.required === 1 ? "" : "s"} required · {preview?.eligibleApprovers ?? 0} eligible
                  approver
                  {preview?.eligibleApprovers === 1 ? "" : "s"}
                </p>
              </div>
              {preview && (
                <PolicyChecks checks={preview.checks.filter((c) => c.id !== "allowlist" || values.recipient)} />
              )}
              <p className="text-muted-foreground text-xs">
                Budget and balance are re-checked at execution. A proposal over the remaining budget can be submitted,
                but it can&apos;t execute until budget frees up (for example next month) within its approval window.
              </p>
              <Button
                type="submit"
                form="proposal-form"
                className="w-full"
                disabled={
                  !address ||
                  !canPropose ||
                  form.formState.isSubmitting ||
                  (preview ? !preview.canSubmit && !!values.recipient : false)
                }
              >
                <Send aria-hidden /> Review & submit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
