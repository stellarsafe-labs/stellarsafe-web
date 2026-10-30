/** Key/value list describing exactly what a transaction will do, for the review step. */
export function TxSummary({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
