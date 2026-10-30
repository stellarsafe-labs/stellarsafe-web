import type { Metadata } from "next";
import { PolicyView } from "@/components/views/policy-view";

export const metadata: Metadata = { title: "Spending policy" };

export default function Page() {
  return <PolicyView />;
}
