import { network } from "@/lib/stellar/network";
import type { WalletAdapter } from "./types";
import { WalletError } from "./types";

const albedo = async () => (await import("@albedo-link/intent")).default;

/** Albedo accepts "public"/"testnet" or a raw passphrase for other networks. */
function albedoNetwork(): string {
  if (network.name === "mainnet") return "public";
  if (network.name === "testnet") return "testnet";
  return network.passphrase;
}

function wrap(e: unknown): WalletError {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : "Albedo request failed";
  const code = e && typeof e === "object" && "code" in e ? Number((e as { code: unknown }).code) : undefined;
  // Albedo uses code -4 for "user rejected"; popup blockers surface as a generic error.
  return new WalletError(
    /popup/i.test(msg) ? "Allow pop-ups for this site to use Albedo." : msg,
    code === -4 || /reject|denied|cancel/i.test(msg) ? "rejected" : "unknown",
  );
}

/**
 * Albedo is a web-based signer (no extension needed). It opens a pop-up on
 * albedo.link for each request and never shares keys with this site.
 */
export const albedoAdapter: WalletAdapter = {
  id: "albedo",
  name: "Albedo",
  description: "Web-based signer. No extension needed; approves in a pop-up.",

  isAvailable: async () => typeof window !== "undefined",

  async connect() {
    try {
      const { pubkey } = await (await albedo()).publicKey({});
      return pubkey;
    } catch (e) {
      throw wrap(e);
    }
  },

  // Albedo has no persistent session; reuse the address the user already proved ownership of.
  getAddress: async (saved) => saved ?? null,

  async signTransaction(xdr, { address }) {
    try {
      const res = await (await albedo()).tx({ xdr, pubkey: address, network: albedoNetwork(), submit: false });
      return res.signed_envelope_xdr;
    } catch (e) {
      throw wrap(e);
    }
  },
};
