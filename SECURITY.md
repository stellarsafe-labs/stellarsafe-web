# Security policy

StellarSafe is pre-audit, testnet-only software.

Please **do not** open public issues for vulnerabilities. Report them privately through GitHub's
"Report a vulnerability" (Security → Advisories) on this repository, including steps to reproduce and impact.

In scope for this repo: anything that could cause a user to sign something other than what the UI showed,
display API data as if it were on-chain state, leak sessions, or bypass the network/mainnet guards.
Contract-level issues belong in `stellarsafe-contracts`.
