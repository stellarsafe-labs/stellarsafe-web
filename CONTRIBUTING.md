# Contributing to stellarsafe-web

Thanks for helping! This repo is the dashboard; contract logic lives in `stellarsafe-contracts`.

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Before opening a PR run `npm run check` and, for UI changes, `npm run test:e2e`
(first time: `npx playwright install chromium`).

## Ground rules

1. **The chain is the authority.** Never gate a money-related action on API data. Read roles, policy,
   approvals and balances through `useTreasuryState` / `useProposals`.
2. **Every on-chain write goes through `useTx()`** so users always get the review → simulate → sign → confirm flow.
3. **Money is `bigint`.** Use `lib/domain/amount.ts`; never `parseFloat` an amount.
4. **Keep the policy preview in sync with the contract.** If contract rules change, update
   `lib/domain/policy.ts`, the demo contract in `lib/data/demo/demo-source.ts`, and their tests.
5. **Accessibility is tested.** New screens must pass the axe scan in `e2e/smoke-a11y.spec.ts`.
   Never convey status by color alone.
6. Keep shadcn primitives in `components/ui` close to upstream; compose in `components/`.

## Good first issues

- Add a wallet adapter (xBull, LOBSTR, Albedo) implementing `WalletAdapter` in `lib/wallet/`.
- Swap `lib/data/live` for `@stellarsafe/sdk` once published.
- Add pagination to the audit log API calls.
- Add i18n for date/number formatting.

Each issue should state acceptance criteria and the tests that prove it.

## Commit style

Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) are appreciated.
