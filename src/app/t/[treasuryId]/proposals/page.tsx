import type { Metadata } from "next";
import { ProposalsView } from "@/components/views/proposals-view";

export const metadata: Metadata = { title: "Approvals" };

export default function Page() {
  return <ProposalsView />;
}
