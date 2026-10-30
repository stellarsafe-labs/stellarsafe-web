import type { Metadata } from "next";
import { DOCS } from "@/components/docs/registry";
import { DocContent } from "./doc-page";

export const metadata: Metadata = { title: "Documentation", description: DOCS[0].description };

export default function DocsIndex() {
  return <DocContent doc={DOCS[0]} />;
}
