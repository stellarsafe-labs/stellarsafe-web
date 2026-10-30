import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/docs"], disallow: ["/t/", "/treasuries", "/connect"] },
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
