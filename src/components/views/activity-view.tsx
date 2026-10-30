"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, ExternalLink, ListFilter, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError } from "@/components/shared/query-error";
import { ACTIVITY_META, describeActivity } from "@/components/features/activity-describe";
import type { ActivityType } from "@/lib/domain/types";
import { isDemo } from "@/lib/config";
import { explorer } from "@/lib/stellar/network";
import { downloadFile, fmtIso, toCsv } from "@/lib/format";
import { useActivity, useAddressLabel, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";

const CATEGORIES: Record<string, { label: string; types: ActivityType[] }> = {
  all: { label: "All events", types: [] },
  payments: { label: "Payments", types: ["proposal_created", "proposal_executed", "proposal_cancelled", "deposit"] },
  approvals: { label: "Approvals", types: ["proposal_approved", "approval_revoked"] },
  governance: {
    label: "Governance",
    types: ["treasury_initialized", "member_added", "member_removed", "member_roles_changed", "policy_updated"],
  },
};

export function ActivityView() {
  const id = useTreasuryId();
  const activity = useActivity(id);
  const { data: state } = useTreasuryState(id);
  const label = useAddressLabel(id);
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [limit, setLimit] = useState(50);

  const actors = useMemo(() => [...new Set((activity.data ?? []).map((e) => e.actor))], [activity.data]);

  const filtered = useMemo(() => {
    const types = CATEGORIES[category].types;
    return (activity.data ?? []).filter(
      (e) => (types.length === 0 || types.includes(e.type)) && (actor === "all" || e.actor === actor),
    );
  }, [activity.data, category, actor]);

  const grouped = useMemo(() => {
    const out: { day: string; items: typeof filtered }[] = [];
    for (const e of filtered.slice(0, limit)) {
      const day = format(e.at, "EEEE, MMMM d, yyyy");
      const last = out.at(-1);
      if (last?.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [filtered, limit]);

  const exportCsv = () => {
    if (!state) return;
    downloadFile(
      `stellarsafe-audit-log-${id.slice(0, 8)}.csv`,
      toCsv(
        filtered.map((e) => ({
          timestamp_utc: fmtIso(e.at),
          event: e.type,
          actor: e.actor,
          actor_label: label(e.actor),
          proposal_id: e.proposalId,
          description: describeActivity(e, label, state.managedAsset),
          ledger: e.ledger,
          tx_hash: e.txHash,
        })),
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Indexed from the treasury contract's events. Every entry references the ledger and transaction that produced it, so it can be verified independently."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!state || filtered.length === 0}>
            <Download aria-hidden /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ListFilter className="text-muted-foreground size-4" aria-hidden />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44" aria-label="Event type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="w-56" aria-label="Actor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a} value={a}>
                {label(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-sm" aria-live="polite">
          {filtered.length} event{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {activity.error ? (
        <QueryError error={activity.error} retry={() => activity.refetch()} />
      ) : !activity.data || !state ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <Empty className="border py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>No matching events</EmptyTitle>
            <EmptyDescription>Try a different filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.day} aria-label={g.day}>
              <h2 className="text-muted-foreground mb-2 text-sm font-medium">{g.day}</h2>
              <Card className="py-0">
                <CardContent className="px-0">
                  <ol className="divide-y">
                    {g.items.map((e) => {
                      const m = ACTIVITY_META[e.type];
                      return (
                        <li key={e.id} className="flex gap-3 px-4 py-3">
                          <span
                            className={cn(
                              "bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                              m.tone,
                            )}
                          >
                            <m.icon className="size-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">
                              <span className="sr-only">{m.label}: </span>
                              {describeActivity(e, label, state.managedAsset)}
                              {e.proposalId && (
                                <>
                                  {" "}
                                  <Link
                                    href={`/t/${id}/proposals/${e.proposalId}`}
                                    className="text-primary underline underline-offset-4"
                                  >
                                    View
                                  </Link>
                                </>
                              )}
                            </p>
                            <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-xs">
                              <time dateTime={fmtIso(e.at)}>{format(e.at, "HH:mm:ss")}</time>
                              <span>Ledger {e.ledger.toLocaleString()}</span>
                              {isDemo ? (
                                <span className="font-mono">{e.txHash.slice(0, 12)}…</span>
                              ) : (
                                <a
                                  href={explorer.tx(e.txHash)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-foreground inline-flex items-center gap-1 font-mono"
                                >
                                  {e.txHash.slice(0, 12)}… <ExternalLink className="size-3" aria-hidden />
                                </a>
                              )}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>
            </section>
          ))}
          {filtered.length > limit && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + 50)}>
                Load older events
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
