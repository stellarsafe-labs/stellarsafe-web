export type WalletId = "freighter" | "albedo" | "demo";

export interface WalletAdapter {
  id: WalletId;
  name: string;
  description: string;
  installUrl?: string;
  isAvailable(): Promise<boolean>;
  /** Prompts the user and resolves with the selected account address. */
  connect(hint?: string): Promise<string>;
  /** Returns the currently selected account without prompting, if any. `saved` is the last connected address. */
  getAddress(saved?: string): Promise<string | null>;
  signTransaction(xdr: string, opts: { address: string; networkPassphrase: string }): Promise<string>;
  /** Passphrase of the network the wallet is set to, when the wallet exposes it. */
  getNetworkPassphrase?(): Promise<string | null>;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: "not_installed" | "rejected" | "wrong_network" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "WalletError";
  }
}
