"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Rocket, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { PolicyEditor } from "@/components/features/policy-editor";
import { formToPolicy, policyFormSchema, type PolicyFormValues } from "@/components/features/policy-form";
import {
  DEFAULT_POLICY,
  STEPS,
  setupSchema,
  type SetupValues,
} from "@/components/features/create-treasury/setup-schema";
import { StepNav } from "@/components/features/create-treasury/step-nav";
import { DetailsStep } from "@/components/features/create-treasury/details-step";
import { MembersStep } from "@/components/features/create-treasury/members-step";
import { ReviewStep } from "@/components/features/create-treasury/review-step";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { validatePolicy } from "@/lib/domain/policy";
import { isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { useWallet } from "@/lib/wallet/wallet-provider";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
          <strong>{s.name}</strong> with {plural(s.members.length, "member")},{" "}
          {plural(p.approvalTiers.length, "approval tier")} and {plural(p.departments.length, "budget")}.
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
      <StepNav steps={STEPS} current={step} />

      {step === 0 && <DetailsStep form={setup} />}
      {step === 1 && <MembersStep form={setup} deployer={address} />}
      {step === 2 && <PolicyEditor form={policy} assetCode="USDC" approverCount={approverCount} />}
      {step === 3 && <ReviewStep setup={sv} policy={pv} />}

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
