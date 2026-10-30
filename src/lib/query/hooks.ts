"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getDataSource } from "@/lib/data";
import { personaByAddress } from "@/lib/data/demo/personas";
import { findMember } from "@/lib/domain/policy";
import { useWallet } from "@/lib/wallet/wallet-provider";
import { shortAddress } from "@/lib/stellar/address";
import { isDemo } from "@/lib/config";

export const qk = {
  treasuries: (address: string | null) => ["account", address, "treasuries"] as const,
  prefs: (address: string | null, id: string) => ["account", address, "prefs", id] as const,
  treasury: (id: string) => ["treasury", id] as const,
  state: (id: string) => ["treasury", id, "state"] as const,
  proposals: (id: string) => ["treasury", id, "proposals"] as const,
  metadata: (id: string) => ["treasury", id, "metadata"] as const,
  proposalMeta: (id: string) => ["treasury", id, "proposal-meta"] as const,
  activity: (id: string) => ["treasury", id, "activity"] as const,
  transactions: (id: string) => ["treasury", id, "transactions"] as const,
};

/** Chain state is polled so approvals by other members show up without a reload. */
const CHAIN_POLL_MS = 15_000;

export function useTreasuryId(): string {
  const params = useParams<{ treasuryId: string }>();
  return decodeURIComponent(params.treasuryId);
}

export function useMyTreasuries() {
  const { address } = useWallet();
  return useQuery({
    queryKey: qk.treasuries(address),
    queryFn: () => getDataSource().listTreasuries(address!),
    enabled: !!address,
  });
}

export function useTreasuryState(id: string) {
  return useQuery({
    queryKey: qk.state(id),
    queryFn: () => getDataSource().getTreasuryState(id),
    refetchInterval: CHAIN_POLL_MS,
  });
}

export function useProposals(id: string) {
  return useQuery({
    queryKey: qk.proposals(id),
    queryFn: () => getDataSource().getProposals(id),
    refetchInterval: CHAIN_POLL_MS,
  });
}

export function useTreasuryMetadata(id: string) {
  return useQuery({
    queryKey: qk.metadata(id),
    queryFn: () => getDataSource().getTreasuryMetadata(id),
    staleTime: 60_000,
  });
}

export function useProposalMetadata(id: string) {
  return useQuery({
    queryKey: qk.proposalMeta(id),
    queryFn: () => getDataSource().getProposalMetadata(id),
    staleTime: 30_000,
  });
}

export function useActivity(id: string) {
  return useQuery({ queryKey: qk.activity(id), queryFn: () => getDataSource().getActivity(id) });
}

export function useTransactions(id: string) {
  return useQuery({ queryKey: qk.transactions(id), queryFn: () => getDataSource().getTransactions(id) });
}

export function useNotificationPrefs(id: string) {
  const { address } = useWallet();
  return useQuery({
    queryKey: qk.prefs(address, id),
    queryFn: () => getDataSource().getNotificationPreferences(id, address!),
    enabled: !!address,
  });
}

/** The connected wallet's on-chain membership in this treasury (undefined if not a member). */
export function useMe(id: string) {
  const { address } = useWallet();
  const state = useTreasuryState(id);
  return useMemo(() => (state.data ? findMember(state.data, address) : undefined), [state.data, address]);
}

/**
 * Human label for an address: API member label → allowlist label → demo
 * persona → shortened address. Labels are cosmetic; the address is always shown too.
 */
export function useAddressLabel(id: string) {
  const meta = useTreasuryMetadata(id);
  const state = useTreasuryState(id);
  return useMemo(() => {
    const labels = meta.data?.memberLabels ?? {};
    const allow = new Map(state.data?.policy.allowlist.map((a) => [a.address, a.label]));
    return (address: string): string =>
      labels[address] ??
      allow.get(address) ??
      (isDemo ? personaByAddress(address)?.name : undefined) ??
      shortAddress(address);
  }, [meta.data, state.data]);
}

/** A clock that re-renders periodically, for expiry countdowns. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
