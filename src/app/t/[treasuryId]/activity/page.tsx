import type { Metadata } from "next";
import { ActivityView } from "@/components/views/activity-view";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return <ActivityView />;
}
