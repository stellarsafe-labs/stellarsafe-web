"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isDemo } from "@/lib/config";
import { network } from "@/lib/stellar/network";
import { api } from "@/lib/data/live/api-client";
import { getSession, setSession } from "@/lib/data/live/session";
import type { TxSigner } from "@/lib/data/source";
import { demoAdapter } from "./demo";
import { freighterAdapter } from "./freighter";
import type { WalletAdapter, WalletId } from "./types";
import { WalletError } from "./types";

const STORAGE_KEY = "stellarsafe:wallet";

export const WALLETS: WalletAdapter[] = isDemo ? [demoAdapter] : [freighterAdapter];

type Status = "restoring" | "disconnected" | "connecting" | "connected";

interface WalletContextValue {
  status: Status;
  address: string | null;
  wallet: WalletAdapter | null;
  /** True when the wallet reports a different network than the app. */
  wrongNetwork: boolean;
  connect: (id: WalletId, hint?: string) => Promise<string>;
  disconnect: () => void;
  sign: TxSigner;
  /** Live mode: obtain an API session by signing a challenge. No-op in demo. */
  ensureApiSession: () => Promise<void>;
  connectDialogOpen: boolean;
  setConnectDialogOpen: (open: boolean) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

interface Persisted {
  id: WalletId;
  address: string;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("restoring");
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletAdapter | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const addressRef = useRef<string | null>(null);

  const apply = useCallback(
    (w: WalletAdapter | null, addr: string | null) => {
      const changed = addressRef.current !== addr;
      addressRef.current = addr;
      setWallet(w);
      setAddress(addr);
      setStatus(addr ? "connected" : "disconnected");
      if (addr && w) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: w.id, address: addr }));
      else window.localStorage.removeItem(STORAGE_KEY);
      // Account-scoped queries (treasury list, prefs) must refetch for the new identity.
      if (changed) void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    [queryClient],
  );

  // Restore the previous connection without prompting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Persisted) : null;
        const w = saved && WALLETS.find((x) => x.id === saved.id);
        if (!saved || !w) return !cancelled && apply(null, null);
        const addr = w.id === "demo" ? await w.connect(saved.address) : await w.getAddress();
        if (!cancelled) apply(addr ? w : null, addr);
      } catch {
        if (!cancelled) apply(null, null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  // Watch for network mismatches (Freighter can switch networks at any time).
  useEffect(() => {
    if (!wallet?.getNetworkPassphrase) return;
    let active = true;
    const check = async () => {
      const passphrase = await wallet.getNetworkPassphrase!();
      if (active) setNetworkMismatch(!!passphrase && passphrase !== network.passphrase);
    };
    void check();
    const id = window.setInterval(check, 5000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [wallet]);

  const wrongNetwork = !!wallet?.getNetworkPassphrase && networkMismatch;

  const connect = useCallback(
    async (id: WalletId, hint?: string) => {
      const w = WALLETS.find((x) => x.id === id);
      if (!w) throw new WalletError(`Wallet ${id} is not available in this deployment.`);
      setStatus("connecting");
      try {
        const addr = await w.connect(hint);
        apply(w, addr);
        return addr;
      } catch (e) {
        setStatus(addressRef.current ? "connected" : "disconnected");
        throw e;
      }
    },
    [apply],
  );

  const disconnect = useCallback(() => {
    setSession(null);
    apply(null, null);
  }, [apply]);

  const sign = useCallback<TxSigner>(
    async (xdr) => {
      if (!wallet || !addressRef.current) throw new WalletError("Connect a wallet first.");
      if (wrongNetwork) {
        throw new WalletError(`Switch your wallet to ${network.label} before signing.`, "wrong_network");
      }
      return wallet.signTransaction(xdr, { address: addressRef.current, networkPassphrase: network.passphrase });
    },
    [wallet, wrongNetwork],
  );

  const ensureApiSession = useCallback(async () => {
    if (isDemo) return;
    const addr = addressRef.current;
    if (!addr || !wallet) throw new WalletError("Connect a wallet first.");
    if (getSession(addr)) return;
    const { challenge } = await api.challenge(addr);
    const signed = await wallet.signTransaction(challenge, { address: addr, networkPassphrase: network.passphrase });
    const { token, expiresAt } = await api.verify(addr, signed);
    setSession({ address: addr, token, expiresAt: Date.parse(expiresAt) });
  }, [wallet]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      wallet,
      wrongNetwork,
      connect,
      disconnect,
      sign,
      ensureApiSession,
      connectDialogOpen,
      setConnectDialogOpen,
    }),
    [status, address, wallet, wrongNetwork, connect, disconnect, sign, ensureApiSession, connectDialogOpen],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
