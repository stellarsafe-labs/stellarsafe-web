import { DEMO_PERSONAS } from "@/lib/data/demo/personas";
import type { WalletAdapter } from "./types";
import { WalletError } from "./types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A wallet that holds the demo personas' keys. It "signs" the simulated
 * envelopes produced by the demo data source; it can never sign a real
 * network transaction.
 */
export const demoAdapter: WalletAdapter = {
  id: "demo",
  name: "Demo wallet",
  description: "Try StellarSafe as one of five team members. No real funds.",

  isAvailable: async () => true,

  async connect(hint) {
    const persona = DEMO_PERSONAS.find((p) => p.key === hint || p.address === hint) ?? DEMO_PERSONAS[0];
    await delay(250);
    return persona.address;
  },

  getAddress: async () => null,

  async signTransaction(xdr, { address }) {
    if (!DEMO_PERSONAS.some((p) => p.address === address)) {
      throw new WalletError("The demo wallet only holds keys for demo personas.");
    }
    await delay(500);
    return xdr;
  },
};
