"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FilePlus2, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError } from "@/components/shared/query-error";
import { ProposalRow } from "@/components/features/proposal-row";
import { approvalBlocker, can } from "@/lib/domain/policy";
import { useAddressLabel, useMe, useTreasuryId } from "@/lib/query/hooks";
import { useEvaluatedProposals } from "@/lib/query/use-evaluated-proposals";
import { useWallet } from "@/lib/wallet/wallet-provider";

type Filter = "mine" | "open" | "closed" | "all";

export function ProposalsView() {
  const id = useTreasuryId();
  const { address } = useWallet();
  const me = useMe(id);
  const label = useAddressLabel(id);
  const { items, state, now, error, refetch } = useEvaluatedProposals(id);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const all = items ?? [];
    const open = all.filter((i) => ["pending", "ready", "blocked"].includes(i.evaluation.status));
    const mine = state
      ? open.filter(
          (i) =>
            approvalBlocker(state, i.proposal, address ?? undefined, now) === null ||
            (i.evaluation.status === "ready" && can(me, "execute")),
        )
      : [];
    const closed = all.filter((i) => !open.includes(i));
    return { mine, open, closed, all };
  }, [items, state, address, me, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = groups[filter];
    if (!q) return list;
    return list.filter(
      (i) =>
        String(i.proposal.id) === q.replace("#", "") ||
        i.meta?.title.toLowerCase().includes(q) ||
        label(i.proposal.recipient).toLowerCase().includes(q) ||
        i.proposal.recipient.toLowerCase().includes(q),
    );
  }, [groups, filter, query, label]);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Every payment starts as a proposal. It executes only once the contract confirms enough valid approvals and every policy rule passes."
        actions={
          can(me, "propose") && (
            <Button asChild>
              <Link href={`/t/${id}/proposals/new`}>
                <FilePlus2 aria-hidden /> New payment
              </Link>
            </Button>
          )
        }
      />

      {error && !items ? (
        <QueryError error={error} retry={refetch} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ToggleGroup
              type="single"
              variant="outline"
              value={filter}
              onValueChange={(v) => v && setFilter(v as Filter)}
              aria-label="Filter proposals"
            >
              <ToggleGroupItem value="mine">Needs you ({groups.mine.length})</ToggleGroupItem>
              <ToggleGroupItem value="open">Open ({groups.open.length})</ToggleGroupItem>
              <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
            </ToggleGroup>
            <InputGroup className="sm:w-72">
              <InputGroupAddon>
                <Search aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                placeholder="Search title, recipient or #id"
                aria-label="Search proposals"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
          </div>

          <Card className="gap-0 py-0">
            {!items || !state ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <Empty className="py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>
                    {query ? "No matches" : filter === "mine" ? "Nothing needs you right now" : "No proposals here"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {filter === "mine" && !address
                      ? "Connect a member wallet to see proposals you can approve or execute."
                      : "Proposals appear here as soon as they're recorded on-chain."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y" aria-label="Proposals">
                {visible.map((i) => (
                  <li key={i.proposal.id}>
                    <ProposalRow
                      treasuryId={id}
                      proposal={i.proposal}
                      evaluation={i.evaluation}
                      title={i.meta?.title}
                      asset={state.managedAsset}
                      label={label}
                      now={now}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
