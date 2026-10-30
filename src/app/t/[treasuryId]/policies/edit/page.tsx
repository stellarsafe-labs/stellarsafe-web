import type { Metadata } from "next";
import { PolicyEditView } from "@/components/views/policy-view";

export const metadata: Metadata = { title: "Edit policy" };

export default function Page() {
  return <PolicyEditView />;
}
