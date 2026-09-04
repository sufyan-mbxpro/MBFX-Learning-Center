import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return {
    rules: [
      // /admin is noindex'd at the page level too — this is the crawl-side
      // half (ADR-006: same origin, two surfaces).
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
