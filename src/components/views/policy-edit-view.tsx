"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { PolicyEditor } from "@/components/features/policy-editor";
import {
  diffPolicy,
  formToPolicy,
  policyFormSchema,
  policyToForm,
  type PolicyFormValues,
} from "@/components/features/policy-form";
import { useTx } from "@/components/tx/tx-provider";
import { getDataSource } from "@/lib/data";
import { can, validatePolicy } from "@/lib/domain/policy";
import { useMe, useNow, useProposals, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";

export function PolicyEditView() {
  const id = useTreasuryId();
  const me = useMe(id);
  const { data: state } = useTreasuryState(id);
  if (!state) return <Skeleton className="h-96" />;
  if (!can(me, "manage_policy")) {
    return (
      <Alert>
        <ShieldCheck aria-hidden />
        <AlertTitle>Only admins can change the policy</AlertTitle>
        <AlertDescription>
          The contract rejects policy changes from wallets without the admin role.{" "}
          <Link className="underline" href={`/t/${id}/policies`}>
            View current policy
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  return <PolicyEditForm key={state.policy.version} />;
}

function PolicyEditForm() {
  const id = useTreasuryId();
  const router = useRouter();
  const run = useTx();
  const { data: state } = useTreasuryState(id);
  const proposals = useProposals(id);
  const now = useNow();
  const current = state!.policy;
  const asset = state!.managedAsset;
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: policyToForm(current),
    mode: "onBlur",
  });
  const affected = useMemo(
    () => proposals.data?.filter((p) => p.status === "pending" && p.expiresAt > now).length ?? 0,
    [proposals.data, now],
  );
  const approverCount = state!.members.filter((m) => m.roles.includes("approver")).length;

  const onSubmit = (values: PolicyFormValues) => {
    const next = formToPolicy(values);
    const errors = validatePolicy(next, state!.members);
    if (errors.length) {
      form.setError("root", { message: errors.join(" ") });
      return;
    }
    const changes = diffPolicy(current, next, asset.code);
    if (changes.length === 0) {
      form.setError("root", { message: "No changes to publish." });
      return;
    }
    run({
      title: `Publish policy v${current.version + 1}`,
      description: "The new policy applies to every future approval and execution.",
      summary: (
        <div className="space-y-3">
          <ul className="list-disc space-y-1 rounded-lg border py-2 pr-3 pl-7 text-sm">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {affected > 0 && (
            <p className="border-warning/40 bg-warning/5 flex items-start gap-2 rounded-lg border p-3 text-sm">
              <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
              {affected} open proposal{affected === 1 ? "" : "s"} will become stale. Their approvals stop counting and
              they must be re-proposed under the new policy.
            </p>
          )}
        </div>
      ),
      confirmLabel: "Sign & publish",
      treasuryId: id,
      successMessage: "Policy updated",
      action: (ctx) => getDataSource().setPolicy(id, next, ctx),
      onSuccess: () => router.push(`/t/${id}/policies`),
    });
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={`/t/${id}/policies`}>
          <ArrowLeft aria-hidden /> Spending policy
        </Link>
      </Button>
      <PageHeader
        title="Edit spending policy"
        description={`You're drafting v${current.version + 1}. Nothing changes until you sign the update.`}
      />
      {affected > 0 && (
        <Alert className="border-warning/40 mb-6">
          <TriangleAlert aria-hidden className="text-warning" />
          <AlertTitle>
            {affected} open proposal{affected === 1 ? "" : "s"} will be invalidated
          </AlertTitle>
          <AlertDescription>
            Publishing a new version invalidates approvals on pending proposals, so nobody&apos;s signature is applied
            to rules they didn&apos;t see.
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        <PolicyEditor
          form={form}
          assetCode={asset.code}
          approverCount={approverCount}
          lockedDepartmentIds={current.departments.map((d) => d.id)}
        />
        {form.formState.errors.root && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>Can&apos;t publish this policy</AlertTitle>
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}
        <div className="bg-background/90 sticky bottom-0 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button type="button" variant="outline" onClick={() => form.reset(policyToForm(current))}>
            Reset
          </Button>
          <Button type="submit">Review changes</Button>
        </div>
      </form>
    </>
  );
}
