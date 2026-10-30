# stellarsafe-web

The dashboard for **StellarSafe** — an open-source treasury and policy engine for organizations on Stellar.
Approval thresholds, recipient allowlists, monthly department budgets and expiring approvals are enforced by
Soroban smart contracts; this app is the management interface on top of them.

> **Testnet software.** The StellarSafe contracts have not completed an independent security review.
> The app refuses to run against mainnet unless `NEXT_PUBLIC_ALLOW_MAINNET=true` is set.

## Quick start

```bash
npm ci
cp .env.example .env.local   # defaults to demo mode, no backend needed
npm run dev                  # http://localhost:3000
```

In **demo mode** a simulated treasury contract runs in your browser (state in `localStorage`) with the same
rules as the real one. Pick a persona on `/connect`, then switch personas from the wallet menu to walk a
payment through propose → approve → approve → execute. Open two tabs to act as two signers at once.

## Screens

| Route                          | Screen                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `/`, `/docs/*`                 | Landing page and documentation                                |
| `/connect`                     | Connect wallet (Freighter, or demo personas)                  |
| `/treasuries`, `/new`, `/join` | Your treasuries, create (4-step wizard), join by contract id  |
| `/t/:id`                       | Overview: balances, open proposals, budgets, policy, activity |
| `/t/:id/members`               | Members and on-chain roles                                    |
| `/t/:id/policies[/edit]`       | Spending policy, versioned editor with change diff            |
| `/t/:id/proposals/new`         | Submit payment proposal with live policy preview              |
| `/t/:id/proposals[/:pid]`      | Pending approvals; approve / revoke / execute / cancel        |
| `/t/:id/transactions`          | Transaction history (CSV export)                              |
| `/t/:id/activity`              | Audit log of contract events (CSV export)                     |
| `/t/:id/settings`              | Metadata, notification preferences, contract details          |

## Architecture

```
src/
  app/                 Next.js App Router (marketing, console, /t/[treasuryId] shell)
  components/
    views/             One component per screen
    features/          Shared feature pieces (policy editor, budget meters, …)
    tx/                Transaction flow: review → simulate → sign → submit → confirm
    ui/                shadcn/ui primitives
  lib/
    domain/            Pure domain model + policy engine (mirrors contract checks)
    data/
      source.ts        DataSource interface
      demo/            In-browser simulated contract + seeded data
      live/            Soroban RPC (authoritative reads/writes) + typed API client
    wallet/            Wallet adapters (Freighter, demo) and provider
    query/             TanStack Query hooks
```

**Authority rule.** Types prefixed `OnChain*` come from the contract and are the only inputs to anything that
affects money: roles, policy, approvals, budgets, balances. `*Metadata` from the API is display-only. The UI
marks chain-read values with an _On-chain · ledger N_ badge, always shows full addresses next to labels, and
simulates every write before asking the wallet to sign. `lib/domain/policy.ts` only _previews_ what the
contract will decide.

The contract interface the app expects is documented at `/docs/contract-interface`.

## Configuration

All variables are public (`NEXT_PUBLIC_*`) and validated at startup with zod — see `.env.example` and
`/docs/self-hosting`. Live mode requires `NEXT_PUBLIC_SOROBAN_RPC_URL` and `NEXT_PUBLIC_API_URL`.

## Scripts

| Command                   | What it does                                           |
| ------------------------- | ------------------------------------------------------ |
| `npm run dev`             | Dev server                                             |
| `npm run build` / `start` | Production build / server                              |
| `npm run check`           | Typecheck + lint + unit tests                          |
| `npm test`                | Vitest unit tests (policy engine, contract sim, codec) |
| `npm run test:e2e`        | Playwright: full approval flow + axe WCAG 2 AA scans   |
| `npm run format`          | Prettier                                               |

CI (`.github/workflows/ci.yml`) runs all of the above on every PR.

## Security

- Non-custodial: keys never leave the wallet; the backend cannot approve or execute.
- Strict CSP, `frame-ancestors 'none'`, no-referrer, HSTS (`next.config.ts`).
- Network mismatch between wallet and app blocks signing.
- API sessions come from a signed challenge and live in `sessionStorage` only.
- CSV exports neutralize spreadsheet formula injection.

See `/docs/security` for the trust model and threat model, and [SECURITY.md](SECURITY.md) to report issues.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
