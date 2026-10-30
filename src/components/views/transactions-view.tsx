"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, ExternalLink, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError } from "@/components/shared/query-error";
import { Stat } from "@/components/shared/stat";
import { formatAmount } from "@/lib/domain/amount";
import { isDemo } from "@/lib/config";
import { explorer } from "@/lib/stellar/network";
import { downloadFile, fmtDateTime, fmtIso, toCsv } from "@/lib/format";
import { useAddressLabel, useTransactions, useTreasuryId, useTreasuryState } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";

type Dir = "all" | "in" | "out";
const PAGE = 25;

export function TransactionsView() {
  const id = useTreasuryId();
  const txs = useTransactions(id);
  const { data: state } = useTreasuryState(id);
  const label = useAddressLabel(id);
  const [dir, setDir] = useState<Dir>("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => (txs.data ?? []).filter((t) => dir === "all" || t.direction === dir), [txs.data, dir]);
  const totals = useMemo(() => {
    let inflow = 0n;
    let outflow = 0n;
    for (const t of txs.data ?? []) {
      if (t.direction === "in") inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow };
  }, [txs.data]);

  const deptName = (d?: string) => state?.policy.departments.find((x) => x.id === d)?.name ?? d ?? "—";

  const exportCsv = () => {
    downloadFile(
      `stellarsafe-transactions-${id.slice(0, 8)}.csv`,
      toCsv(
        rows.map((t) => ({
          timestamp_utc: fmtIso(t.at),
          direction: t.direction,
          amount: formatAmount(t.amount, { decimals: t.asset.decimals, grouping: false, maxFraction: 7 }),
          asset: t.asset.code,
          counterparty: t.counterparty,
          counterparty_label: label(t.counterparty),
          proposal_id: t.proposalId,
          department: t.departmentId ? deptName(t.departmentId) : undefined,
          ledger: t.ledger,
          tx_hash: t.txHash,
        })),
      ),
    );
  };

  const asset = state?.managedAsset;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every executed payment and deposit, indexed from contract events. Each row links to its on-chain transaction."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download aria-hidden /> Export CSV
          </Button>
        }
      />

      {asset && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Total received"
            icon={ArrowDownLeft}
            value={`${formatAmount(totals.inflow, { decimals: asset.decimals, maxFraction: 0 })}`}
            hint={asset.code}
          />
          <Stat
            label="Total paid out"
            icon={ArrowUpRight}
            value={`${formatAmount(totals.outflow, { decimals: asset.decimals, maxFraction: 0 })}`}
            hint={asset.code}
          />
          <Stat label="Transactions" icon={Receipt} value={txs.data?.length ?? "—"} hint="All time" />
        </div>
      )}

      <div className="mb-4">
        <ToggleGroup
          type="single"
          variant="outline"
          value={dir}
          onValueChange={(v) => v && setDir(v as Dir)}
          aria-label="Filter by direction"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="out">Outgoing</ToggleGroupItem>
          <ToggleGroupItem value="in">Incoming</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {txs.error ? (
        <QueryError error={txs.error} retry={() => txs.refetch()} />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            {!txs.data ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty className="py-14">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Receipt />
                  </EmptyMedia>
                  <EmptyTitle>No transactions yet</EmptyTitle>
                  <EmptyDescription>Deposits and executed payments will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead className="hidden lg:table-cell">Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="hidden pr-4 text-right md:table-cell">Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, limit).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground pl-4 whitespace-nowrap">
                          {fmtDateTime(t.at)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {t.direction === "in" ? (
                              <ArrowDownLeft className="text-success size-4 shrink-0" aria-label="Incoming" />
                            ) : (
                              <ArrowUpRight className="text-muted-foreground size-4 shrink-0" aria-label="Outgoing" />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{label(t.counterparty)}</span>
                              <span className="text-muted-foreground block font-mono text-xs">
                                {t.counterparty.slice(0, 6)}…{t.counterparty.slice(-4)}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {t.proposalId ? (
                            <Link
                              href={`/t/${id}/proposals/${t.proposalId}`}
                              className="text-primary underline underline-offset-4"
                            >
                              #{t.proposalId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Deposit</span>
                          )}
                          {t.departmentId && (
                            <span className="text-muted-foreground"> · {deptName(t.departmentId)}</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tabular text-right font-medium whitespace-nowrap",
                            t.direction === "in" && "text-success",
                          )}
                        >
                          {t.direction === "in" ? "+" : "−"}
                          {formatAmount(t.amount, { decimals: t.asset.decimals })}{" "}
                          <span className="text-muted-foreground text-xs">{t.asset.code}</span>
                        </TableCell>
                        <TableCell className="hidden pr-4 text-right md:table-cell">
                          {isDemo ? (
                            <span className="text-muted-foreground font-mono text-xs" title={t.txHash}>
                              {t.txHash.slice(0, 10)}…
                            </span>
                          ) : (
                            <a
                              href={explorer.tx(t.txHash)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary inline-flex items-center gap-1 font-mono text-xs hover:underline"
                            >
                              {t.txHash.slice(0, 10)}… <ExternalLink className="size-3" aria-hidden />
                              <span className="sr-only">Open transaction in explorer</span>
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > limit && (
                  <div className="border-t p-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                      Show more ({rows.length - limit} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
