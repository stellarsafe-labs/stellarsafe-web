import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { DOCS } from "@/components/docs/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: config.siteUrl, priority: 1 },
    ...DOCS.map((d) => ({ url: `${config.siteUrl}/docs${d.slug ? `/${d.slug}` : ""}`, priority: 0.7 })),
  ];
}
