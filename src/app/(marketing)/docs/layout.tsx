import { DocsNav } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[200px_1fr]">
      <aside className="md:sticky md:top-20 md:h-fit">
        <p className="text-muted-foreground mb-3 px-3 text-xs font-medium tracking-wide uppercase">Documentation</p>
        <DocsNav />
      </aside>
      <article>{children}</article>
    </div>
  );
}
