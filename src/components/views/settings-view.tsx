"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PageHeader } from "@/components/shared/page-header";
import { Address } from "@/components/shared/address";
import { getDataSource } from "@/lib/data";
import { can } from "@/lib/domain/policy";
import type { NotificationPreferences, TreasuryMetadata } from "@/lib/domain/types";
import { config, isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { fmtDateTime } from "@/lib/format";
import {
  qk,
  useMe,
  useNotificationPrefs,
  useTreasuryId,
  useTreasuryMetadata,
  useTreasuryState,
} from "@/lib/query/hooks";
import { useWallet } from "@/lib/wallet/wallet-provider";

const generalSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  description: z.string().trim().max(280, "Keep it under 280 characters"),
});

function GeneralSettings({ meta, editable }: { meta: TreasuryMetadata; editable: boolean }) {
  const id = useTreasuryId();
  const queryClient = useQueryClient();
  const { address, ensureApiSession } = useWallet();
  const form = useForm<z.infer<typeof generalSchema>>({
    resolver: zodResolver(generalSchema),
    defaultValues: { name: meta.name, description: meta.description ?? "" },
  });

  const onSubmit = async (v: z.infer<typeof generalSchema>) => {
    try {
      await ensureApiSession();
      await getDataSource().updateTreasuryMetadata(
        id,
        { name: v.name, description: v.description || undefined },
        address!,
      );
      await queryClient.invalidateQueries({ queryKey: qk.metadata(id) });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      form.reset(v);
      toast.success("Treasury details saved");
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Display details stored by the StellarSafe API. They don&apos;t affect on-chain behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="t-name">Treasury name</FieldLabel>
                  <Input id="t-name" disabled={!editable} aria-invalid={fieldState.invalid} {...field} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="t-desc">Description</FieldLabel>
                  <Textarea id="t-desc" rows={3} disabled={!editable} aria-invalid={fieldState.invalid} {...field} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between border-t">
          <p className="text-muted-foreground text-xs">
            {editable ? "Admins can edit these details." : "Only admins can edit these details."}
          </p>
          <Button type="submit" disabled={!editable || !form.formState.isDirty || form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const EVENT_LABELS: Record<keyof NotificationPreferences["events"], { title: string; desc: string }> = {
  approvalRequested: { title: "Approval requested", desc: "A proposal needs your approval." },
  proposalExecuted: { title: "Payment executed", desc: "A payment left the treasury." },
  policyChanged: { title: "Policy changed", desc: "A new policy version was published." },
  memberChanged: { title: "Membership changed", desc: "Members or roles were added, changed or removed." },
};

function NotificationSettings({ prefs }: { prefs: NotificationPreferences }) {
  const id = useTreasuryId();
  const queryClient = useQueryClient();
  const { address, ensureApiSession } = useWallet();
  const [value, setValue] = useState(prefs);
  const [saving, setSaving] = useState(false);
  const emailInvalid = !!value.email && !z.email().safeParse(value.email).success;
  const webhookInvalid = !!value.webhookUrl && !/^https:\/\/\S+$/.test(value.webhookUrl);

  const save = async () => {
    setSaving(true);
    try {
      await ensureApiSession();
      await getDataSource().saveNotificationPreferences(id, address!, {
        ...value,
        email: value.email || undefined,
        webhookUrl: value.webhookUrl || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: qk.prefs(address, id) });
      toast.success("Notification preferences saved");
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Personal to your wallet. Delivered by the StellarSafe notification service.</CardDescription>
      </CardHeader>
      <CardContent className="py-6">
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field data-invalid={emailInvalid || undefined}>
              <FieldLabel htmlFor="n-email">Email</FieldLabel>
              <Input
                id="n-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={value.email ?? ""}
                onChange={(e) => setValue({ ...value, email: e.target.value })}
                aria-invalid={emailInvalid}
              />
              {emailInvalid && <FieldError>Enter a valid email.</FieldError>}
            </Field>
            <Field data-invalid={webhookInvalid || undefined}>
              <FieldLabel htmlFor="n-webhook">Webhook URL</FieldLabel>
              <Input
                id="n-webhook"
                type="url"
                placeholder="https://…"
                value={value.webhookUrl ?? ""}
                onChange={(e) => setValue({ ...value, webhookUrl: e.target.value })}
                aria-invalid={webhookInvalid}
              />
              {webhookInvalid ? (
                <FieldError>Must be an https:// URL.</FieldError>
              ) : (
                <FieldDescription>Signed JSON POST per event.</FieldDescription>
              )}
            </Field>
          </div>
          {(Object.keys(EVENT_LABELS) as (keyof NotificationPreferences["events"])[]).map((k) => (
            <Field key={k} orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`n-${k}`}>{EVENT_LABELS[k].title}</FieldLabel>
                <FieldDescription>{EVENT_LABELS[k].desc}</FieldDescription>
              </FieldContent>
              <Switch
                id={`n-${k}`}
                checked={value.events[k]}
                onCheckedChange={(c) => setValue({ ...value, events: { ...value.events, [k]: c } })}
              />
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button onClick={save} disabled={saving || emailInvalid || webhookInvalid}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Save preferences
        </Button>
      </CardFooter>
    </Card>
  );
}

export function SettingsView() {
  const id = useTreasuryId();
  const { address } = useWallet();
  const me = useMe(id);
  const meta = useTreasuryMetadata(id);
  const { data: state } = useTreasuryState(id);
  const prefs = useNotificationPrefs(id);

  return (
    <>
      <PageHeader title="Settings" description="Display details, notifications and contract information." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {meta.data ? (
            <GeneralSettings key={meta.data.name} meta={meta.data} editable={can(me, "manage_members")} />
          ) : (
            <Skeleton className="h-64" />
          )}
          {!address || !me ? (
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Connect a member wallet to manage your notifications for this treasury.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : prefs.data ? (
            <NotificationSettings key={address} prefs={prefs.data} />
          ) : (
            <Skeleton className="h-72" />
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Contract</CardTitle>
            <CardDescription>Verify these against your deployment records.</CardDescription>
          </CardHeader>
          <CardContent>
            {!state ? (
              <Skeleton className="h-48" />
            ) : (
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground mb-1">Treasury contract</dt>
                  <dd>
                    <Address address={id} chars={6} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">Managed asset</dt>
                  <dd className="space-y-1">
                    <span className="font-medium">{state.managedAsset.code}</span>
                    <Address address={state.managedAsset.contractId} chars={6} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Network</dt>
                  <dd className="font-medium">{isDemo ? "Demo (simulated in browser)" : network.label}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Deployed</dt>
                  <dd className="font-medium">{fmtDateTime(state.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Proposals created</dt>
                  <dd className="tabular font-medium">{state.proposalCount}</dd>
                </div>
                {!isDemo && (
                  <div>
                    <dt className="text-muted-foreground">RPC endpoint</dt>
                    <dd className="font-mono text-xs break-all">{network.rpcUrl}</dd>
                  </div>
                )}
                {config.apiUrl && (
                  <div>
                    <dt className="text-muted-foreground">API</dt>
                    <dd className="font-mono text-xs break-all">{config.apiUrl}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
