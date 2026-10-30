import type { Metadata } from "next";
import { CreateTreasuryView } from "@/components/views/create-treasury-view";

export const metadata: Metadata = { title: "Create a treasury" };

export default function NewTreasuryPage() {
  return <CreateTreasuryView />;
}
