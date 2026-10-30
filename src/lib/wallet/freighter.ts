import type { WalletAdapter } from "./types";
import { WalletError } from "./types";

type FreighterError = { message?: string; code?: number } | undefined;

function check<T extends { error?: FreighterError }>(res: T): T {
  if (res.error) {
    const msg = res.error.message ?? "Freighter returned an error";
    throw new WalletError(msg, /reject|denied|declined/i.test(msg) ? "rejected" : "unknown");
  }
  return res;
}

// Loaded lazily so the extension bridge never runs during SSR.
const freighter = () => import("@stellar/freighter-api");

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  name: "Freighter",
  description: "Browser extension wallet by the Stellar Development Foundation.",
  installUrl: "https://www.freighter.app/",

  async isAvailable() {
    try {
      const f = await freighter();
      return (await f.isConnected()).isConnected;
    } catch {
      return false;
    }
  },

  async connect() {
    const f = await freighter();
    if (!(await f.isConnected()).isConnected) {
      throw new WalletError("Freighter is not installed in this browser.", "not_installed");
    }
    const { address } = check(await f.requestAccess());
    if (!address) throw new WalletError("No account was shared by Freighter.", "rejected");
    return address;
  },

  async getAddress() {
    try {
      const f = await freighter();
      if (!(await f.isAllowed()).isAllowed) return null;
      const { address } = check(await f.getAddress());
      return address || null;
    } catch {
      return null;
    }
  },

  async signTransaction(xdr, { address, networkPassphrase }) {
    const f = await freighter();
    const res = check(await f.signTransaction(xdr, { address, networkPassphrase }));
    if (res.signerAddress && res.signerAddress !== address) {
      throw new WalletError("Freighter signed with a different account than the one connected.", "unknown");
    }
    return res.signedTxXdr;
  },

  async getNetworkPassphrase() {
    try {
      const f = await freighter();
      return check(await f.getNetworkDetails()).networkPassphrase;
    } catch {
      return null;
    }
  },
};
