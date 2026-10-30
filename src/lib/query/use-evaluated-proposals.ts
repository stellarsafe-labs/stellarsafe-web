"use client";

import { useMemo } from "react";
import { evaluateProposal, type ProposalEvaluation } from "@/lib/domain/policy";
import type { OnChainProposal, ProposalMetadata } from "@/lib/domain/types";
import { fmtAmount } from "@/lib/format";
import { useNow, useProposalMetadata, useProposals, useTreasuryState } from "./hooks";

export interface EvaluatedProposal {
  proposal: OnChainProposal;
  evaluation: ProposalEvaluation;
  meta?: ProposalMetadata;
}

/** Proposals joined with their policy evaluation (chain) and display metadata (API). */
export function useEvaluatedProposals(treasuryId: string) {
  const state = useTreasuryState(treasuryId);
  const proposals = useProposals(treasuryId);
  const meta = useProposalMetadata(treasuryId);
  const now = useNow();

  const items = useMemo<EvaluatedProposal[] | undefined>(() => {
    if (!state.data || !proposals.data) return undefined;
    const asset = state.data.managedAsset;
    return proposals.data.map((p) => ({
      proposal: p,
      evaluation: evaluateProposal(state.data, p, now, { amount: (u) => `${fmtAmount(u, asset)} ${asset.code}` }),
      meta: meta.data?.[p.id],
    }));
  }, [state.data, proposals.data, meta.data, now]);

  return {
    items,
    state: state.data,
    isLoading: state.isLoading || proposals.isLoading,
    error: state.error ?? proposals.error,
    refetch: () => Promise.all([state.refetch(), proposals.refetch()]),
    now,
  };
}
