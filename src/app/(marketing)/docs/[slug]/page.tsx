import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOCS } from "@/components/docs/registry";
import { DocContent } from "../doc-page";

const find = (slug: string) => DOCS.find((d) => d.slug === slug && d.slug !== "");

export function generateStaticParams() {
  return DOCS.filter((d) => d.slug).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const doc = find((await params).slug);
  return doc ? { title: doc.title, description: doc.description } : {};
}

export default async function DocPage({ params }: PageProps<"/docs/[slug]">) {
  const doc = find((await params).slug);
  if (!doc) notFound();
  return <DocContent doc={doc} />;
}
