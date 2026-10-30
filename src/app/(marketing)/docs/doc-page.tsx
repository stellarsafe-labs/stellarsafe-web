import { Prose } from "@/components/docs/prose";
import type { DocPage } from "@/components/docs/registry";

export function DocContent({ doc }: { doc: DocPage }) {
  const Body = doc.body;
  return (
    <>
      <header className="mb-8 max-w-3xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
        <p className="text-muted-foreground text-lg">{doc.description}</p>
      </header>
      <Prose>
        <Body />
      </Prose>
    </>
  );
}
