export const ORG_URL = "https://github.com/stellarsafe-labs";
export const REPO_URL = `${ORG_URL}/stellarsafe-web`;

export const REPOS = [
  {
    name: "stellarsafe-contracts",
    stack: "Rust · Soroban SDK",
    purpose: "Treasury, policy and approval contracts — the source of authority.",
  },
  {
    name: "stellarsafe-api",
    stack: "Node.js · Fastify · PostgreSQL",
    purpose: "Wallet auth, event indexer, metadata and notifications.",
  },
  {
    name: "stellarsafe-sdk",
    stack: "TypeScript · Stellar SDK",
    purpose: "Typed contract clients, policy readers and simulation helpers.",
  },
  { name: "stellarsafe-web", stack: "Next.js · TypeScript", purpose: "This dashboard." },
] as const;
