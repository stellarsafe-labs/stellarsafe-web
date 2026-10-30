import type { Metadata } from "next";
import { JoinView } from "@/components/views/join-view";

export const metadata: Metadata = { title: "Join a treasury" };

export default function JoinPage() {
  return <JoinView />;
}
