import Link from "next/link";
import { CodeBlock } from "./code-block";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  body: () => React.ReactNode;
}

function GettingStarted() {
  return (
    <>
      <p>
        StellarSafe lets an organization hold assets in a Soroban smart contract and spend them only through rules the
        contract enforces. This dashboard is one way to use it; the <Link href="/docs/sdk">SDK</Link> is another.
      </p>
      <h2 id="try">Try it in two minutes</h2>
      <ol>
        <li>
          Open <Link href="/connect">the app</Link> and pick a demo persona. Start as <strong>Chloé Martin</strong>{" "}
          (proposer).
        </li>
        <li>
          In <em>Nebula Labs Treasury</em>, choose <strong>New payment</strong> and propose 800 USDC to Pixelcraft
          Studio from Marketing.
        </li>
        <li>
          The policy preview shows it needs <strong>2 approvals</strong> because it&apos;s above 500 USDC.
        </li>
        <li>
          Switch to <strong>Ben Lindqvist</strong> from the wallet menu and approve. Then switch to{" "}
          <strong>Dev Raman</strong> and approve.
        </li>
        <li>Execute the payment. Watch the Marketing budget, balance, transactions and audit log update.</li>
      </ol>
      <p>
        Open a second browser tab to act as two signers side by side — demo state is shared between tabs. Use{" "}
        <em>Reset</em> in the demo banner to start over.
      </p>
      <h2 id="screens">What&apos;s in the dashboard</h2>
      <table>
        <thead>
          <tr>
            <th>Screen</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Overview</td>
            <td>Balances, open proposals, department budgets, policy summary, recent activity.</td>
          </tr>
          <tr>
            <td>Approvals</td>
            <td>Pending proposals, filtered to what needs you. Approve, revoke, execute, cancel.</td>
          </tr>
          <tr>
            <td>New payment</td>
            <td>Propose a payment with a live preview of every policy check.</td>
          </tr>
          <tr>
            <td>Transactions</td>
            <td>Executed payments and deposits with CSV export.</td>
          </tr>
          <tr>
            <td>Members</td>
            <td>On-chain roles: admin, approver, proposer, viewer.</td>
          </tr>
          <tr>
            <td>Spending policy</td>
            <td>Thresholds, allowlist, budgets, approval window. Admins publish new versions.</td>
          </tr>
          <tr>
            <td>Audit log</td>
            <td>Every contract event with ledger and transaction hash.</td>
          </tr>
          <tr>
            <td>Settings</td>
            <td>Display metadata, notification preferences, contract details.</td>
          </tr>
        </tbody>
      </table>
      <h2 id="roles">Roles</h2>
      <ul>
        <li>
          <strong>Admin</strong> — manages members and policy, can cancel any proposal.
        </li>
        <li>
          <strong>Approver</strong> — approvals count toward thresholds.
        </li>
        <li>
          <strong>Proposer</strong> — creates payment proposals.
        </li>
        <li>
          <strong>Viewer</strong> — a member with no roles; read-only, useful for auditors.
        </li>
      </ul>
      <p>A member can hold several roles. Execution is open to any member because the contract re-checks every rule.</p>
    </>
  );
}

function Concepts() {
  return (
    <>
      <h2 id="lifecycle">Proposal lifecycle</h2>
      <p>
        A payment is a <strong>proposal</strong> stored in the treasury contract. It records the recipient, amount,
        department, the policy version it was created under, and an expiry computed from the approval window.
      </p>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Awaiting approvals</td>
            <td>Pending, fewer valid approvals than the threshold requires.</td>
          </tr>
          <tr>
            <td>Ready to execute</td>
            <td>Enough valid approvals and every other check passes right now.</td>
          </tr>
          <tr>
            <td>Blocked by policy</td>
            <td>Approved, but a budget, balance or allowlist check currently fails.</td>
          </tr>
          <tr>
            <td>Policy changed</td>
            <td>The policy version changed after creation; approvals were invalidated.</td>
          </tr>
          <tr>
            <td>Expired</td>
            <td>The approval window closed. It can no longer be approved or executed.</td>
          </tr>
          <tr>
            <td>Executed / Cancelled</td>
            <td>Final states, recorded on-chain.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="valid-approvals">What counts as a valid approval</h2>
      <p>At execution the contract counts an approval only if, at that moment:</p>
      <ul>
        <li>the approver is still a member with the approver role,</li>
        <li>it was given under the treasury&apos;s current policy version, and</li>
        <li>the approver isn&apos;t the proposer (unless self-approval is allowed).</li>
      </ul>
      <p>
        So removing a member or revoking their approver role immediately stops their past approvals counting, and
        publishing a new policy version invalidates approvals on every pending proposal.
      </p>

      <h2 id="thresholds">Approval tiers</h2>
      <p>
        Tiers map a minimum amount to a number of approvals. The tier with the largest minimum the payment reaches
        applies. One tier must start at 0, larger tiers can&apos;t require fewer approvals, and no tier may require more
        approvals than there are approvers.
      </p>

      <h2 id="budgets">Monthly budgets and the accounting period</h2>
      <p>
        Every payment is charged to a department. The accounting period is the <strong>calendar month in UTC</strong>,
        determined by the ledger close time of the executing transaction. The contract stores spend per (department,
        period) and rejects execution if it would exceed the limit. There is no backend counter involved.
      </p>
      <p>
        Budgets are checked at <em>execution</em>, not at proposal time, because the remaining budget can change in
        between.
      </p>

      <h2 id="managed-asset">Managed asset</h2>
      <p>
        In v1 each treasury has one managed asset (for example USDC) in which thresholds, budgets and payments are
        denominated. Other balances, like XLM, are shown but can&apos;t be spent through proposals.
      </p>
    </>
  );
}

function Security() {
  return (
    <>
      <p>
        StellarSafe&apos;s guarantees come from the treasury contract. The API and this dashboard improve usability but
        are not trusted for anything that moves money.
      </p>
      <h2 id="trust">Trust boundaries</h2>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Trusted for</th>
            <th>Not trusted for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Treasury contract</td>
            <td>Custody, roles, policy, approvals, execution</td>
            <td>—</td>
          </tr>
          <tr>
            <td>User wallet</td>
            <td>Authorizing each action</td>
            <td>—</td>
          </tr>
          <tr>
            <td>StellarSafe API</td>
            <td>Names, descriptions, notifications, indexed history</td>
            <td>Approvals, balances, policy, permissions</td>
          </tr>
          <tr>
            <td>Web dashboard</td>
            <td>Displaying chain state, building transactions</td>
            <td>Enforcing rules (it only previews them)</td>
          </tr>
        </tbody>
      </table>

      <h2 id="web">How the dashboard upholds this</h2>
      <ul>
        <li>
          Policy, roles, approvals, budgets and balances are read from the contract via Soroban RPC and marked{" "}
          <em>On-chain</em> with the ledger they were read at.
        </li>
        <li>
          API metadata is display-only. Addresses are always shown next to labels, so a tampered label can&apos;t hide a
          recipient.
        </li>
        <li>
          Every write is simulated against current contract state first. Contract errors surface before the wallet
          prompt.
        </li>
        <li>
          The confirmation dialog states exactly what will be signed. Users sign in their own wallet; the app never sees
          keys.
        </li>
        <li>
          The app refuses to start against mainnet unless <code>NEXT_PUBLIC_ALLOW_MAINNET=true</code> is set explicitly.
        </li>
        <li>Strict security headers: CSP, frame denial, no referrer leakage, no MIME sniffing.</li>
        <li>API sessions are short-lived, held in session storage, and obtained by signing a challenge.</li>
      </ul>

      <h2 id="threats">Threat model highlights</h2>
      <table>
        <thead>
          <tr>
            <th>Threat</th>
            <th>Mitigation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Compromised API approves a payment</td>
            <td>Impossible: approvals require the approver&apos;s signature; the API holds no keys.</td>
          </tr>
          <tr>
            <td>Compromised API shows fake approval counts</td>
            <td>Counts are read from the contract, not the API.</td>
          </tr>
          <tr>
            <td>Duplicate execution</td>
            <td>Status flips to Executed in the same atomic call as the transfer.</td>
          </tr>
          <tr>
            <td>Old approvals reused after rule changes</td>
            <td>Policy versioning invalidates them.</td>
          </tr>
          <tr>
            <td>Departed employee&apos;s approvals</td>
            <td>Removed members&apos; approvals stop counting immediately.</td>
          </tr>
          <tr>
            <td>Approval used weeks later</td>
            <td>Proposals expire after the approval window.</td>
          </tr>
          <tr>
            <td>Phishing recipient swap</td>
            <td>Recipient allowlist; full address shown at review and signing.</td>
          </tr>
          <tr>
            <td>Wrong network signing</td>
            <td>Wallet network is checked; signing is blocked on mismatch.</td>
          </tr>
          <tr>
            <td>Malicious CSV formulas in exports</td>
            <td>Cells beginning with = + - @ are escaped.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="status">Audit status</h2>
      <p>
        The contracts have <strong>not</strong> completed an independent security review. Use testnet only. Report
        vulnerabilities privately via the security policy in the <code>stellarsafe-contracts</code> repository.
      </p>
    </>
  );
}

function ContractInterface() {
  return (
    <>
      <p>
        The dashboard expects the following interface from <code>stellarsafe-contracts</code>. Keep this page and{" "}
        <code>src/lib/data/live/codec.ts</code> in sync with the contract.
      </p>
      <h2 id="conventions">Conventions</h2>
      <ul>
        <li>
          Timestamps are <code>u64</code> seconds; amounts are <code>i128</code> base units (7 decimals for Stellar
          assets).
        </li>
        <li>
          Roles are <code>Symbol</code>s: <code>admin</code>, <code>approver</code>, <code>proposer</code>.
        </li>
        <li>
          Every mutating function takes the acting <code>Address</code> first and calls <code>require_auth()</code> on
          it.
        </li>
        <li>
          Errors are a <code>#[contracterror]</code> enum; codes 1–20 map to messages in{" "}
          <code>src/lib/domain/types.ts</code>.
        </li>
      </ul>
      <h2 id="reads">Read functions</h2>
      <CodeBlock
        filename="treasury (reads)"
        code={`get_config() -> Config { asset: Address, created_at: u64, proposal_count: u64 }
get_members() -> Vec<Member { address: Address, roles: Vec<Symbol>, added_at: u64 }>
get_policy() -> Policy {
  version: u32, updated_at: u64,
  approval_tiers: Vec<Tier { min_amount: i128, required_approvals: u32 }>,
  allowlist_enabled: bool, allowlist: Vec<Recipient { address: Address, label: String }>,
  departments: Vec<Department { id: Symbol, name: String, monthly_limit: i128 }>,
  approval_ttl: u64, allow_self_approval: bool,
}
get_period_spend() -> PeriodSpend { period: String /* "YYYY-MM" */, spent: Map<Symbol, i128> }
get_proposal(id: u64) -> Proposal
list_proposals(start: u64, limit: u32) -> Vec<Proposal>`}
      />
      <h2 id="writes">Write functions</h2>
      <CodeBlock
        filename="treasury (writes)"
        code={`add_member(admin: Address, member: Member)
set_member_roles(admin: Address, address: Address, roles: Vec<Symbol>)
remove_member(admin: Address, address: Address)
set_policy(admin: Address, policy: PolicyInput) -> u32           // new version
propose_payment(proposer: Address, recipient: Address, amount: i128,
                department: Symbol, metadata_hash: BytesN<32>) -> u64
approve_payment(approver: Address, id: u64)
revoke_approval(approver: Address, id: u64)
execute_payment(executor: Address, id: u64)
cancel_payment(caller: Address, id: u64)

// factory
deploy(deployer: Address, salt: BytesN<32>, members: Vec<Member>, policy: PolicyInput) -> Address`}
      />
      <h2 id="events">Events</h2>
      <p>
        The indexer in <code>stellarsafe-api</code> turns contract events into the audit log. Topics use the same names
        as the activity types in the dashboard, e.g. <code>proposal_executed</code>.
      </p>
    </>
  );
}

function Sdk() {
  return (
    <>
      <p>
        <code>@stellarsafe/sdk</code> exposes the same capabilities as this dashboard for other applications: typed
        contract clients, policy readers, proposal preparation, transaction simulation and event decoding.
      </p>
      <CodeBlock
        filename="example.ts"
        code={`import { StellarSafeClient } from "@stellarsafe/sdk";

const client = new StellarSafeClient({ network: "testnet", rpcUrl: process.env.STELLAR_RPC_URL! });
const treasury = await client.getTreasury("CBX…");

// Preview before asking anyone to sign
const sim = await client.simulateProposal(treasury.id, {
  proposer: "GABC…", recipient: "GVEN…", amount: 1_240_0000000n, department: "eng",
});
if (!sim.ok) console.error(sim.error); // e.g. RecipientNotAllowed`}
      />
      <p>
        The SDK is an illustrative API design under development in its own repository. The dashboard currently ships its
        own thin client in <code>src/lib/data/live</code>, structured so it can be swapped for the SDK.
      </p>
    </>
  );
}

function SelfHosting() {
  return (
    <>
      <p>The dashboard is a static-friendly Next.js app. All configuration is public and set at build time.</p>
      <h2 id="env">Environment variables</h2>
      <table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Default</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>NEXT_PUBLIC_DATA_SOURCE</code>
            </td>
            <td>
              <code>demo</code>
            </td>
            <td>
              <code>demo</code> (simulated contract in-browser) or <code>live</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_STELLAR_NETWORK</code>
            </td>
            <td>
              <code>testnet</code>
            </td>
            <td>
              <code>testnet</code>, <code>futurenet</code> or <code>mainnet</code>.
            </td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_SOROBAN_RPC_URL</code>
            </td>
            <td>network default</td>
            <td>Soroban RPC endpoint. Required for live.</td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_API_URL</code>
            </td>
            <td>—</td>
            <td>stellarsafe-api base URL. Required for live.</td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_FACTORY_CONTRACT_ID</code>
            </td>
            <td>—</td>
            <td>Factory used to deploy new treasuries.</td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_SITE_URL</code>
            </td>
            <td>
              <code>http://localhost:3000</code>
            </td>
            <td>Canonical URL for metadata.</td>
          </tr>
          <tr>
            <td>
              <code>NEXT_PUBLIC_ALLOW_MAINNET</code>
            </td>
            <td>
              <code>false</code>
            </td>
            <td>
              Must be <code>true</code> to run against mainnet.
            </td>
          </tr>
        </tbody>
      </table>
      <h2 id="run">Run locally</h2>
      <CodeBlock filename="terminal" code={`npm ci\ncp .env.example .env.local\nnpm run dev`} />
      <h2 id="deploy">Deploy</h2>
      <p>
        Build with <code>npm run build</code> and serve with <code>npm start</code>, or deploy to any Next.js host.
        Configuration is validated at startup and the build fails fast on invalid values.
      </p>
    </>
  );
}

export const DOCS: DocPage[] = [
  { slug: "", title: "Getting started", description: "What StellarSafe is and how to try it.", body: GettingStarted },
  {
    slug: "concepts",
    title: "Policies & approvals",
    description: "Proposal lifecycle, valid approvals, tiers, budgets and periods.",
    body: Concepts,
  },
  { slug: "security", title: "Security model", description: "Trust boundaries and threat model.", body: Security },
  {
    slug: "contract-interface",
    title: "Contract interface",
    description: "The contract ABI the dashboard expects.",
    body: ContractInterface,
  },
  { slug: "sdk", title: "SDK", description: "Integrate StellarSafe into your own application.", body: Sdk },
  { slug: "self-hosting", title: "Self-hosting", description: "Configuration and deployment.", body: SelfHosting },
];
