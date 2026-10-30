import { Controller, type UseFormReturn } from "react-hook-form";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { formatAmount } from "@/lib/domain/amount";
import type { OnChainTreasuryState } from "@/lib/domain/types";
import { shortAddress } from "@/lib/stellar/address";
import type { ProposalFormValues } from "./schema";

interface Props {
  form: UseFormReturn<ProposalFormValues>;
  state: OnChainTreasuryState;
  formId: string;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  className?: string;
}

export function ProposalFormCard({ form, state, formId, onSubmit, className }: Props) {
  const { policy, managedAsset: asset } = state;
  return (
    <Card className={className}>
      <CardContent>
        <form onSubmit={onSubmit} noValidate id={formId}>
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
                            <span className="text-muted-foreground font-mono text-xs">{shortAddress(a.address)}</span>
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
                                {formatAmount(left > 0n ? left : 0n, { decimals: asset.decimals, maxFraction: 0 })} left
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
                  <FieldDescription>Stored off-chain; its hash is anchored in the on-chain proposal.</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
