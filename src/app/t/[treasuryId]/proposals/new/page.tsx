import type { Metadata } from "next";
import { NewProposalView } from "@/components/views/new-proposal-view";

export const metadata: Metadata = { title: "New payment" };

export default function Page() {
  return <NewProposalView />;
}
