import { hash, Keypair, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import type { Role } from "@/lib/domain/types";

/** Deterministic, valid Stellar addresses so the demo looks and validates like the real thing. */
export function demoAccount(seed: string): string {
  return Keypair.fromRawEd25519Seed(hash(Buffer.from(`stellarsafe-demo:${seed}`))).publicKey();
}

export function demoContract(seed: string): string {
  return StrKey.encodeContract(hash(Buffer.from(`stellarsafe-demo-contract:${seed}`)));
}

export interface DemoPersona {
  key: string;
  name: string;
  title: string;
  address: string;
  /** Roles in the primary demo treasury, for the persona picker. */
  roles: Role[];
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "ada", name: "Ada Okafor", title: "CFO", address: demoAccount("ada"), roles: ["admin", "approver"] },
  { key: "ben", name: "Ben Lindqvist", title: "CEO", address: demoAccount("ben"), roles: ["approver"] },
  { key: "chloe", name: "Chloé Martin", title: "Operations lead", address: demoAccount("chloe"), roles: ["proposer"] },
  {
    key: "dev",
    name: "Dev Raman",
    title: "Engineering lead",
    address: demoAccount("dev"),
    roles: ["proposer", "approver"],
  },
  { key: "eve", name: "Eve Tanaka", title: "External auditor", address: demoAccount("eve"), roles: [] },
];

export const personaByAddress = (address?: string | null) => DEMO_PERSONAS.find((p) => p.address === address);
