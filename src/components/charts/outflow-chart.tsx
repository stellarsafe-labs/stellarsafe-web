"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { unitsToNumber } from "@/lib/domain/amount";
import { periodKey } from "@/lib/domain/policy";
import type { Asset, TransactionRecord } from "@/lib/domain/types";

const chartConfig = {
  outflow: { label: "Outflow", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Single-series monthly outflow. The card title names the series, so no legend. */
export function OutflowChart({
  transactions,
  asset,
  months = 6,
}: {
  transactions: TransactionRecord[];
  asset: Asset;
  months?: number;
}) {
  const [showTable, setShowTable] = useState(false);

  const data = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; outflow: number; payments: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15);
      buckets.push({ key: periodKey(d), label: format(d, "MMM"), outflow: 0, payments: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const t of transactions) {
      if (t.direction !== "out") continue;
      const b = byKey.get(periodKey(t.at));
      if (b) {
        b.outflow += unitsToNumber(t.amount, asset.decimals);
        b.payments += 1;
      }
    }
    return buckets.map((b) => ({ ...b, outflow: Math.round(b.outflow * 100) / 100 }));
  }, [transactions, asset.decimals, months]);

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="space-y-2">
      {showTable ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Outflow ({asset.code})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.key}>
                <TableCell>{d.label}</TableCell>
                <TableCell className="tabular text-right">{d.payments}</TableCell>
                <TableCell className="tabular text-right">{fmt(d.outflow)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-56 w-full"
          role="img"
          aria-label={`Monthly outflow for the last ${months} months: ${data.map((d) => `${d.label} ${fmt(d.outflow)} ${asset.code}`).join(", ")}`}
        >
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} strokeDasharray="0" strokeOpacity={0.5} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <ChartTooltip
              cursor={{ fillOpacity: 0.4 }}
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex w-full justify-between gap-4">
                      <span className="text-muted-foreground">
                        {(item.payload as { payments: number }).payments} payments
                      </span>
                      <span className="tabular font-mono font-medium">
                        {fmt(Number(value))} {asset.code}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="outflow" fill="var(--color-outflow)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ChartContainer>
      )}
      <Button
        variant="link"
        size="xs"
        className="text-muted-foreground h-auto px-0"
        onClick={() => setShowTable((s) => !s)}
      >
        {showTable ? "Show chart" : "Show as table"}
      </Button>
    </div>
  );
}
