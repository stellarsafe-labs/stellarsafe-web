import type { Metadata } from "next";
import { ProposalDetailView } from "@/components/views/proposal-detail-view";

export const metadata: Metadata = { title: "Proposal" };

export default function Page() {
  return <ProposalDetailView />;
}
