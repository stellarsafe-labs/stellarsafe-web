"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Plus, Rocket, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadges, roleLabel } from "@/components/shared/role-badges";
import { PolicyEditor } from "@/components/features/policy-editor";
import { formToPolicy, policyFormSchema, type PolicyFormValues } from "@/components/features/policy-form";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { validatePolicy } from "@/lib/domain/policy";
import { ROLES, type Role } from "@/lib/domain/types";
import { formatAmount } from "@/lib/domain/amount";
import { isStellarAddress, shortAddress } from "@/lib/stellar/address";
import { isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { fmtTtl } from "@/lib/format";
import { useWallet } from "@/lib/wallet/wallet-provider";
import { cn } from "@/lib/utils";

const setupSchema = z
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

type SetupValues = z.infer<typeof setupSchema>;

const DEFAULT_POLICY: PolicyFormValues = {
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

const STEPS = ["Details", "Members", "Policy", "Review"] as const;

export function CreateTreasuryView() {
  const router = useRouter();
  const run = useTx();
  const { address, setConnectDialogOpen } = useWallet();
  const [step, setStep] = useState(0);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const setup = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { name: "", description: "", members: [] },
    mode: "onTouched",
  });
  const members = useFieldArray({ control: setup.control, name: "members" });
  const policy = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: DEFAULT_POLICY,
    mode: "onBlur",
  });
  const sv = useWatch({ control: setup.control }) as SetupValues;
  const pv = useWatch({ control: policy.control }) as PolicyFormValues;

  // Seed the deploying wallet as the first admin.
  useEffect(() => {
    if (address && setup.getValues("members").length === 0) {
      setup.setValue("members", [{ address, label: "You", roles: ["admin", "approver"] }]);
    }
  }, [address, setup]);

  if (!address) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Connect the wallet that will deploy the treasury</EmptyTitle>
          <EmptyDescription>The deploying wallet becomes the first admin and pays the network fee.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setConnectDialogOpen(true)}>Connect wallet</Button>
        </EmptyContent>
      </Empty>
    );
  }

  const next = async () => {
    setReviewError(null);
    if (step === 0 && !(await setup.trigger(["name", "description"]))) return;
    if (step === 1 && !(await setup.trigger("members"))) return;
    if (step === 2) {
      if (!(await policy.trigger())) return;
      const draftMembers = setup.getValues("members").map((m) => ({ address: m.address, roles: m.roles, addedAt: 0 }));
      const errors = validatePolicy(formToPolicy(policy.getValues()), draftMembers);
      if (errors.length) {
        setReviewError(errors.join(" "));
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deploy = () => {
    const s = setup.getValues();
    const p = formToPolicy(policy.getValues());
    run({
      title: "Deploy treasury",
      description: isDemo
        ? "Deploys a simulated treasury contract on the demo network."
        : `Deploys a new treasury contract on ${network.label} via the StellarSafe factory. You pay the network fee.`,
      summary: (
        <p className="text-sm">
          <strong>{s.name}</strong> with {s.members.length} member{s.members.length === 1 ? "" : "s"},{" "}
          {p.approvalTiers.length} approval tier
          {p.approvalTiers.length === 1 ? "" : "s"} and {p.departments.length} budget
          {p.departments.length === 1 ? "" : "s"}.
        </p>
      ),
      confirmLabel: "Sign & deploy",
      successMessage: "Treasury deployed",
      action: (ctx) =>
        getDataSource().createTreasury(
          {
            name: s.name,
            description: s.description || undefined,
            members: s.members.map((m) => ({ address: m.address, roles: m.roles, label: m.label || undefined })),
            policy: p,
          },
          ctx,
        ),
      onSuccess: (res) => router.push(`/t/${res.value}`),
    });
  };

  const approverCount = sv.members.filter((m) => m.roles.includes("approver")).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Create a treasury"
        description="Set the rules once. The contract enforces them on every payment from then on."
      />

      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-primary text-primary",
                  i > step && "text-muted-foreground",
                )}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="size-3.5" aria-label="completed" /> : i + 1}
              </span>
              <span className={cn("hidden text-sm sm:inline", i === step ? "font-medium" : "text-muted-foreground")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="bg-border h-px flex-1" aria-hidden />}
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Treasury details</CardTitle>
            <CardDescription>Shown to members in the dashboard. Stored off-chain.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Controller
                name="name"
                control={setup.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      id="name"
                      placeholder="e.g. Acme Operating Treasury"
                      aria-invalid={fieldState.invalid}
                      {...field}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="description"
                control={setup.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="description">
                      Description <span className="text-muted-foreground font-normal">(optional)</span>
                    </FieldLabel>
                    <Textarea id="description" rows={3} {...field} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Field>
                <FieldLabel>Managed asset</FieldLabel>
                <p className="text-sm">USDC</p>
                <FieldDescription>
                  Thresholds and budgets are denominated in the managed asset. v1 supports one managed asset per
                  treasury.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Members & roles</CardTitle>
            <CardDescription>
              Roles are written to the contract. You can change them later, but every change is an on-chain transaction
              signed by an admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.fields.map((f, i) => {
              const errs = setup.formState.errors.members?.[i];
              const roles = sv.members[i]?.roles ?? [];
              return (
                <fieldset key={f.id} className="space-y-3 rounded-lg border p-4">
                  <legend className="sr-only">Member {i + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
                    <Field data-invalid={!!errs?.address || undefined}>
                      <FieldLabel htmlFor={`m-${i}-addr`}>Address</FieldLabel>
                      <Input
                        id={`m-${i}-addr`}
                        className="font-mono text-xs"
                        placeholder="G…"
                        spellCheck={false}
                        autoComplete="off"
                        readOnly={i === 0 && f.address === address}
                        {...setup.register(`members.${i}.address`)}
                      />
                      <FieldError errors={[errs?.address]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`m-${i}-label`}>Label</FieldLabel>
                      <Input id={`m-${i}-label`} placeholder="Name · title" {...setup.register(`members.${i}.label`)} />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="sm:mt-6"
                      disabled={members.fields.length === 1}
                      onClick={() => members.remove(i)}
                      aria-label={`Remove member ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-4" role="group" aria-label="Roles">
                    {ROLES.map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={roles.includes(r)}
                          onCheckedChange={(c) =>
                            setup.setValue(`members.${i}.roles`, c ? [...roles, r] : roles.filter((x) => x !== r), {
                              shouldValidate: true,
                            })
                          }
                        />
                        {roleLabel(r)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <FieldError
              errors={[
                setup.formState.errors.members?.root,
                setup.formState.errors.members as { message?: string } | undefined,
              ]}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => members.append({ address: "", label: "", roles: ["approver"] })}
            >
              <Plus aria-hidden /> Add member
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && <PolicyEditor form={policy} assetCode="USDC" approverCount={approverCount} />}

      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{sv.name}</CardTitle>
              {sv.description && <CardDescription>{sv.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <section>
                <h3 className="mb-2 font-medium">Members</h3>
                <ul className="divide-y rounded-lg border">
                  {sv.members.map((m) => (
                    <li key={m.address} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">{m.label || "—"}</span>
                        <span className="text-muted-foreground font-mono text-xs">{shortAddress(m.address, 6)}</span>
                      </span>
                      <RoleBadges roles={m.roles} />
                    </li>
                  ))}
                </ul>
              </section>
              <section className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-medium">Approval thresholds</h3>
                  <ul className="text-muted-foreground space-y-1">
                    {formToPolicy(pv).approvalTiers.map((t) => (
                      <li key={t.minAmount.toString()}>
                        {t.minAmount === 0n ? "Any amount" : `≥ ${formatAmount(t.minAmount)} USDC`}:{" "}
                        {t.requiredApprovals} approval
                        {t.requiredApprovals === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-medium">Budgets (monthly)</h3>
                  <ul className="text-muted-foreground space-y-1">
                    {pv.departments.map((d) => (
                      <li key={d.id}>
                        {d.name}: {d.monthlyLimit} USDC
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 font-medium">Allowlist</h3>
                  <p className="text-muted-foreground">
                    {pv.allowlistEnabled ? `${pv.allowlist.length} recipients` : "Disabled"}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium">Approval window</h3>
                  <p className="text-muted-foreground">
                    {fmtTtl(Math.round(pv.approvalTtlDays * 86_400))} · self-approval{" "}
                    {pv.allowSelfApproval ? "allowed" : "forbidden"}
                  </p>
                </div>
              </section>
            </CardContent>
          </Card>
          {!isDemo && (
            <Alert>
              <TriangleAlert aria-hidden />
              <AlertTitle>Testnet only until audited</AlertTitle>
              <AlertDescription>
                StellarSafe contracts have not completed an independent security review. Don&apos;t deposit funds you
                can&apos;t afford to lose.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {reviewError && (
        <Alert variant="destructive" className="mt-6">
          <TriangleAlert aria-hidden />
          <AlertTitle>Fix the policy before continuing</AlertTitle>
          <AlertDescription>{reviewError}</AlertDescription>
        </Alert>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Continue <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button onClick={deploy}>
            <Rocket aria-hidden /> Deploy treasury
          </Button>
        )}
      </div>
    </div>
  );
}
