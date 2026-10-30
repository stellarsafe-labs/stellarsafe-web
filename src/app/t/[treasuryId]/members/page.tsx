import type { Metadata } from "next";
import { MembersView } from "@/components/views/members-view";

export const metadata: Metadata = { title: "Members" };

export default function Page() {
  return <MembersView />;
}
