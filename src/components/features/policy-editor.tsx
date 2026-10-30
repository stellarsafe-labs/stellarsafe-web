"use client";

import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { type PolicyFormValues, slugify } from "./policy-form";

interface Props {
  form: UseFormReturn<PolicyFormValues>;
  assetCode: string;
  approverCount: number;
  /** Department ids that already exist on-chain keep their id. */
  lockedDepartmentIds?: string[];
}

export function PolicyEditor({ form, assetCode, approverCount, lockedDepartmentIds = [] }: Props) {
  const { control, register, setValue, getValues } = form;
  const tiers = useFieldArray({ control, name: "tiers" });
  const allow = useFieldArray({ control, name: "allowlist" });
  const depts = useFieldArray({ control, name: "departments" });
  const allowlistEnabled = useWatch({ control, name: "allowlistEnabled" });
  const deptValues = useWatch({ control, name: "departments" });
  const errors = form.formState.errors;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Approval thresholds</CardTitle>
          <CardDescription>
            Larger payments can require more approvals. The tier with the highest minimum that a payment reaches
            applies. {approverCount} member{approverCount === 1 ? "" : "s"} currently hold the approver role.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                tiers.append({
                  minAmount: "",
                  requiredApprovals: Math.min(approverCount, (getValues("tiers").at(-1)?.requiredApprovals ?? 1) + 1),
                })
              }
            >
              <Plus aria-hidden /> Add tier
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {tiers.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_8rem_auto] items-start gap-3">
              <Field data-invalid={!!errors.tiers?.[i]?.minAmount || undefined}>
                <FieldLabel htmlFor={`tier-${i}-min`} className={i > 0 ? "sr-only" : undefined}>
                  Payments of at least
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={`tier-${i}-min`}
                    inputMode="decimal"
                    className="tabular"
                    aria-invalid={!!errors.tiers?.[i]?.minAmount}
                    {...register(`tiers.${i}.minAmount`)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{assetCode}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError errors={[errors.tiers?.[i]?.minAmount]} />
              </Field>
              <Field data-invalid={!!errors.tiers?.[i]?.requiredApprovals || undefined}>
                <FieldLabel htmlFor={`tier-${i}-req`} className={i > 0 ? "sr-only" : undefined}>
                  Approvals
                </FieldLabel>
                <Input
                  id={`tier-${i}-req`}
                  type="number"
                  min={1}
                  max={20}
                  className="tabular"
                  {...register(`tiers.${i}.requiredApprovals`, { valueAsNumber: true })}
                />
                <FieldError errors={[errors.tiers?.[i]?.requiredApprovals]} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={i === 0 ? "mt-6" : undefined}
                onClick={() => tiers.remove(i)}
                disabled={tiers.fields.length === 1}
                aria-label={`Remove tier ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <FieldError errors={[errors.tiers?.root, errors.tiers as { message?: string } | undefined]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Department budgets</CardTitle>
          <CardDescription>
            Monthly outflow caps, counted on-chain per calendar month (UTC). Every payment must be charged to one
            budget.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                depts.append({
                  id: slugify(
                    "department",
                    getValues("departments").map((d) => d.id),
                  ),
                  name: "",
                  monthlyLimit: "",
                })
              }
            >
              <Plus aria-hidden /> Add budget
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {depts.fields.map((f, i) => {
            const deptId = deptValues?.[i]?.id ?? "";
            const locked = lockedDepartmentIds.includes(deptId);
            return (
              <div key={f.id} className="grid grid-cols-[1fr_10rem_auto] items-start gap-3">
                <Field data-invalid={!!errors.departments?.[i]?.name || undefined}>
                  <FieldLabel htmlFor={`dept-${i}-name`} className={i > 0 ? "sr-only" : undefined}>
                    Department
                  </FieldLabel>
                  <Input
                    id={`dept-${i}-name`}
                    placeholder="e.g. Engineering"
                    {...register(`departments.${i}.name`, {
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!locked) {
                          const others = getValues("departments")
                            .filter((_, j) => j !== i)
                            .map((d) => d.id);
                          setValue(`departments.${i}.id`, slugify(e.target.value, others));
                        }
                      },
                    })}
                  />
                  <FieldDescription className="font-mono text-xs">id: {deptId}</FieldDescription>
                  <FieldError errors={[errors.departments?.[i]?.name, errors.departments?.[i]?.id]} />
                </Field>
                <Field data-invalid={!!errors.departments?.[i]?.monthlyLimit || undefined}>
                  <FieldLabel htmlFor={`dept-${i}-limit`} className={i > 0 ? "sr-only" : undefined}>
                    Monthly limit
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`dept-${i}-limit`}
                      inputMode="decimal"
                      className="tabular"
                      {...register(`departments.${i}.monthlyLimit`)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{assetCode}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError errors={[errors.departments?.[i]?.monthlyLimit]} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={i === 0 ? "mt-6" : undefined}
                  onClick={() => depts.remove(i)}
                  disabled={depts.fields.length === 1}
                  aria-label={`Remove budget ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipient allowlist</CardTitle>
          <CardDescription>
            When enabled, the contract rejects payments to any address not on this list.
          </CardDescription>
          <CardAction>
            <Controller
              control={control}
              name="allowlistEnabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Enable recipient allowlist"
                />
              )}
            />
          </CardAction>
        </CardHeader>
        {allowlistEnabled && (
          <CardContent className="space-y-3">
            {allow.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[10rem_1fr_auto] items-start gap-3">
                <Field data-invalid={!!errors.allowlist?.[i]?.label || undefined}>
                  <FieldLabel htmlFor={`allow-${i}-label`} className={i > 0 ? "sr-only" : undefined}>
                    Label
                  </FieldLabel>
                  <Input id={`allow-${i}-label`} placeholder="Vendor name" {...register(`allowlist.${i}.label`)} />
                  <FieldError errors={[errors.allowlist?.[i]?.label]} />
                </Field>
                <Field data-invalid={!!errors.allowlist?.[i]?.address || undefined}>
                  <FieldLabel htmlFor={`allow-${i}-addr`} className={i > 0 ? "sr-only" : undefined}>
                    Address
                  </FieldLabel>
                  <Input
                    id={`allow-${i}-addr`}
                    placeholder="G…"
                    className="font-mono text-xs"
                    spellCheck={false}
                    autoComplete="off"
                    {...register(`allowlist.${i}.address`)}
                  />
                  <FieldError errors={[errors.allowlist?.[i]?.address]} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={i === 0 ? "mt-6" : undefined}
                  onClick={() => allow.remove(i)}
                  aria-label={`Remove recipient ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => allow.append({ label: "", address: "" })}>
              <Plus aria-hidden /> Add recipient
            </Button>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field data-invalid={!!errors.approvalTtlDays || undefined} className="max-w-xs">
            <FieldLabel htmlFor="ttl">Approval window</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="ttl"
                type="number"
                min={1}
                max={90}
                step={1}
                className="tabular"
                {...register("approvalTtlDays", { valueAsNumber: true })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>days</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Proposals that aren&apos;t executed within this window expire and can&apos;t be executed.
            </FieldDescription>
            <FieldError errors={[errors.approvalTtlDays]} />
          </Field>
          <Controller
            control={control}
            name="allowSelfApproval"
            render={({ field }) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="self-approval">Allow proposers to approve their own payments</FieldLabel>
                  <FieldDescription>
                    Off is recommended: it guarantees at least two people see every payment.
                  </FieldDescription>
                </FieldContent>
                <Switch id="self-approval" checked={field.value} onCheckedChange={field.onChange} />
              </Field>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
