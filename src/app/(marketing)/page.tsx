import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarRange,
  CircleCheck,
  CircleDashed,
  Code2,
  FileCheck2,
  GitBranch,
  Hourglass,
  ListChecks,
  RefreshCcw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/docs/code-block";
import { ORG_URL, REPOS } from "@/lib/links";
import { isDemo } from "@/lib/config";

const RULES = [
  {
    icon: Users,
    title: "Approval thresholds",
    body: "Payments above 500 USDC need two approvals; above 5,000, three. Tiers are yours to define.",
  },
  {
    icon: ListChecks,
    title: "Recipient allowlists",
    body: "Only pre-approved vendor and payroll addresses can ever receive treasury funds.",
  },
  {
    icon: CalendarRange,
    title: "Department budgets",
    body: "Monthly caps per department, counted on-chain per UTC calendar month — not in a database.",
  },
  {
    icon: Hourglass,
    title: "Expiring approvals",
    body: "Approvals lapse after a window you set. Stale sign-offs can't be used weeks later.",
  },
  {
    icon: RefreshCcw,
    title: "Versioned policy",
    body: "Changing the rules invalidates approvals on pending payments, so nobody signs under old terms.",
  },
  {
    icon: FileCheck2,
    title: "Verifiable record",
    body: "Every proposal, approval and payment is a contract event with a ledger and transaction hash.",
  },
];

function PolicyPreviewMock() {
  const checks = [
    { ok: true, label: "Recipient allowlisted", detail: "Nimbus Cloud" },
    { ok: true, label: "Engineering budget", detail: "1,489.60 USDC left after payment" },
    { ok: true, label: "Within approval window", detail: "Expires in 6 days" },
    { ok: false, label: "Approvals", detail: "1 of 2 required" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="from-primary/25 via-chart-1/10 absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br to-transparent blur-2xl" />
      <div className="bg-card shadow-primary/5 rounded-2xl border p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground font-mono text-xs">Proposal #42</p>
            <p className="font-medium">GPU capacity for load testing</p>
          </div>
          <span className="border-info/20 bg-info/10 text-info inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium">
            Awaiting approvals
          </span>
        </div>
        <p className="tabular mt-4 text-3xl font-semibold tracking-tight">
          1,240.00 <span className="text-muted-foreground text-base font-normal">USDC</span>
        </p>
        <ul className="mt-4 divide-y rounded-lg border">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-3 px-3 py-2 text-sm">
              {c.ok ? (
                <CircleCheck className="text-success mt-0.5 size-4" />
              ) : (
                <CircleDashed className="text-muted-foreground mt-0.5 size-4" />
              )}
              <span>
                <span className="block font-medium">{c.label}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="bg-muted/60 mt-4 flex items-center justify-between rounded-lg px-3 py-2 text-xs">
          <span className="text-success inline-flex items-center gap-1 font-medium">
            <ShieldCheck className="size-3.5" /> Read on-chain · ledger 58,123,904
          </span>
          <span className="text-muted-foreground">Policy v2</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div className="space-y-6">
            <Badge variant="outline" className="gap-1.5">
              <span className="bg-success size-1.5 rounded-full" aria-hidden /> Open source · Built on Soroban
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Spending rules your team <span className="text-primary">can&apos;t bypass.</span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg text-pretty">
              StellarSafe is a treasury and policy engine for organizations on Stellar. Approval thresholds, recipient
              allowlists, monthly budgets and expiring approvals are enforced by smart contracts — not by a server you
              have to trust.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-10 px-4">
                <Link href="/connect">
                  {isDemo ? "Try the interactive demo" : "Launch app"} <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-10 px-4">
                <Link href="/docs">Read the docs</Link>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              No sign-up.{" "}
              {isDemo
                ? "The demo runs a simulated contract in your browser."
                : "Connect a Stellar wallet to get started."}
            </p>
          </div>
          <PolicyPreviewMock />
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
        <div className="mb-12 max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">Imagine a startup holding 20,000 USDC</h2>
          <p className="text-muted-foreground text-pretty">
            Instead of giving one employee unrestricted control of the money, the organization writes its rules into a
            contract. Every payment follows the same path.
          </p>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {[
            {
              n: 1,
              t: "Propose",
              d: "A team member with the proposer role submits a payment: recipient, amount, and the budget it comes from.",
            },
            {
              n: 2,
              t: "Approve",
              d: "Approvers review and sign. The contract tracks who approved, under which policy version, and when it expires.",
            },
            {
              n: 3,
              t: "Execute",
              d: "Anyone on the team can trigger execution. The contract re-checks every rule and transfers funds only if all pass.",
            },
          ].map((s) => (
            <li key={s.n} className="bg-card rounded-xl border p-6">
              <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                {s.n}
              </span>
              <h3 className="mt-4 font-semibold">{s.t}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-10 text-3xl font-semibold tracking-tight">Policies that hold up</h2>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((r) => (
              <li key={r.title} className="space-y-2">
                <r.icon className="text-primary size-5" aria-hidden />
                <h3 className="font-semibold">{r.title}</h3>
                <p className="text-muted-foreground text-sm">{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="security" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold tracking-tight">The contract is the authority</h2>
            <p className="text-muted-foreground text-pretty">
              StellarSafe separates what must be trusted from what merely helps. The dashboard displays policy state
              read straight from the chain, and every action is a transaction you sign in your own wallet.
            </p>
            <ul className="space-y-3 text-sm">
              {[
                "The backend can't approve, execute or bypass a policy — it never holds keys.",
                "Approval counts and budgets shown in the UI are read from the contract, not a database.",
                "Each action is simulated against current on-chain state before you're asked to sign.",
                "Duplicate execution is impossible: status flips atomically with the transfer.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <BadgeCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="px-0">
              <Link href="/docs/security">
                Read the security model <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3" role="list" aria-label="Architecture">
            {[
              {
                icon: ShieldCheck,
                name: "Soroban contracts",
                role: "Authority",
                d: "Custody, policy, approvals, execution",
                strong: true,
              },
              {
                icon: Server,
                name: "StellarSafe API",
                role: "Coordination",
                d: "Indexing, metadata, notifications — no keys",
              },
              {
                icon: Building2,
                name: "Web dashboard",
                role: "Interface",
                d: "Reads chain state, builds transactions for your wallet",
              },
              { icon: Code2, name: "TypeScript SDK", role: "Integration", d: "Embed treasury flows in your own apps" },
            ].map((l) => (
              <div
                role="listitem"
                key={l.name}
                className={`flex items-center gap-4 rounded-xl border p-4 ${l.strong ? "border-primary/40 bg-primary/5" : "bg-card"}`}
              >
                <l.icon
                  className={`size-5 shrink-0 ${l.strong ? "text-primary" : "text-muted-foreground"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-muted-foreground text-sm">{l.d}</p>
                </div>
                <Badge variant={l.strong ? "default" : "outline"}>{l.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="developers" className="bg-muted/30 scroll-mt-16 border-t">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold tracking-tight">A policy engine, not just a dashboard</h2>
            <p className="text-muted-foreground text-pretty">
              Use the dashboard, or integrate treasury flows directly with the TypeScript SDK: typed contract clients,
              policy readers, proposal preparation, transaction simulation and event decoding.
            </p>
            <ul className="space-y-2 text-sm">
              {REPOS.map((r) => (
                <li key={r.name} className="flex items-start gap-2">
                  <GitBranch className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <a
                      href={`${ORG_URL}/${r.name}`}
                      className="font-mono font-medium hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.name}
                    </a>{" "}
                    <span className="text-muted-foreground">— {r.purpose}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <CodeBlock
            filename="treasury.ts"
            code={`import { StellarSafeClient } from "@stellarsafe/sdk";

const client = new StellarSafeClient({
  network: "testnet",
  rpcUrl: process.env.STELLAR_RPC_URL!,
});

const treasury = await client.getTreasury("CBX…TREASURY");

console.log(treasury.policy);
console.log(treasury.pendingProposals);`}
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="border-warning/40 bg-warning/5 flex flex-col items-start gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center">
          <TriangleAlert className="text-warning size-6 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">Testnet first</p>
            <p className="text-muted-foreground text-sm">
              StellarSafe contracts have not yet completed an independent security review. Don&apos;t deposit real
              assets until they have.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/docs/security">Threat model</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
