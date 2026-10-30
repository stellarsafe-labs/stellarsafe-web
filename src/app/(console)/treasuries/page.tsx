import type { Metadata } from "next";
import { TreasuriesView } from "@/components/views/treasuries-view";

export const metadata: Metadata = { title: "Your treasuries" };

export default function TreasuriesPage() {
  return <TreasuriesView />;
}
