"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Pencil, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ChainBadge } from "@/components/shared/chain-badge";
import { Address } from "@/components/shared/address";
import { BudgetMeters } from "@/components/features/budget-meters";
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
import { formatAmount } from "@/lib/domain/amount";
import { fmtDateTime, fmtPeriod, fmtTtl } from "@/lib/format";
import { useMe, useNow, useProposals, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";

export function PolicyView() {
  const id = useTreasuryId();
  const me = useMe(id);
  const { data: state } = useTreasuryState(id);
  if (!state) return <Skeleton className="h-96" />;
  const { policy, managedAsset: asset } = state;
  const fmt = (u: bigint) => `${formatAmount(u, { decimals: asset.decimals })} ${asset.code}`;
  const tiers = [...policy.approvalTiers].sort((a, b) => (a.minAmount < b.minAmount ? -1 : 1));

  return (
    <>
      <PageHeader
        title="Spending policy"
        description="These rules are stored in the treasury contract and checked on every payment. Neither the StellarSafe API nor this interface can bypass them."
        actions={
          can(me, "manage_policy") && (
            <Button asChild>
              <Link href={`/t/${id}/policies/edit`}>
                <Pencil aria-hidden /> Edit policy
              </Link>
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ChainBadge ledger={state.ledger} readAt={state.readAt} />
          <Badge variant="outline">Version {policy.version}</Badge>
          <span className="text-muted-foreground text-xs">Last changed {fmtDateTime(policy.updatedAt)}</span>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approval thresholds</CardTitle>
            <CardDescription>Approvals required, by payment size.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-5">
              {tiers.map((t, i) => (
                <li key={t.minAmount.toString()} className="relative">
                  <span
                    className="border-background bg-primary absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2"
                    aria-hidden
                  />
                  <p className="text-muted-foreground text-sm">
                    {t.minAmount === 0n
                      ? tiers[i + 1]
                        ? `Under ${fmt(tiers[i + 1].minAmount)}`
                        : "Any amount"
                      : tiers[i + 1]
                        ? `${fmt(t.minAmount)} – ${fmt(tiers[i + 1].minAmount)}`
                        : `${fmt(t.minAmount)} and above`}
                  </p>
                  <p className="font-medium">
                    {t.requiredApprovals} approval{t.requiredApprovals === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval rules</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Approval window</dt>
                <dd className="font-medium">{fmtTtl(policy.approvalTtlSeconds)} from proposal creation</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Self-approval</dt>
                <dd className="font-medium">
                  {policy.allowSelfApproval ? "Allowed" : "Forbidden — proposers can't approve their own payments"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">On policy change</dt>
                <dd className="font-medium">Approvals on pending proposals are invalidated</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Removed members</dt>
                <dd className="font-medium">Their approvals stop counting immediately</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department budgets</CardTitle>
            <CardDescription>{fmtPeriod(state.periodKey)} · calendar months in UTC, tracked on-chain</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetMeters state={state} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipient allowlist</CardTitle>
            <CardDescription>
              {policy.allowlistEnabled
                ? `Payments may only go to these ${policy.allowlist.length} addresses.`
                : "Disabled — payments may go to any address."}
            </CardDescription>
          </CardHeader>
          {policy.allowlistEnabled && (
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Recipient</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.allowlist.map((a) => (
                    <TableRow key={a.address}>
                      <TableCell className="pl-6">
                        <Address address={a.address} label={a.label} avatar />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}

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
