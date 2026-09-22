import type { MetadataRoute } from "next";
import { getSetting } from "@repo/settings";
import { siteUrl } from "./_lib/site-url.ts";

// ADR-090. `seo.robotsIndex` was seeded, typed and editable at
// /keystone/settings/seo, and read by nothing — an admin could turn "Allow
// search indexing" off and change not one byte of what crawlers saw. This is
// the crawl-side half of that switch; the page-side half is the root layout's
// `robots` directive, and both are needed: a `Disallow: /` alone stops the
// crawl without removing anything already indexed, because the crawler never
// fetches the page whose `noindex` would have told it to drop the URL.
//
// The read is `getSetting`, so this route is a cache hit tagged
// `settings:seo` — flipping the switch in admin invalidates it at once
// rather than waiting out a TTL.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = siteUrl();
  const allowIndexing = await getSetting("seo.robotsIndex");

  // Only an explicit `false` closes the site. A null row is an unseeded
  // database, and a missing setting must not take the site out of the index.
  if (allowIndexing === false) {
    // No sitemap pointer here: advertising a map of pages the same file
    // forbids crawling is a contradiction, not a hint.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      // The staff portal is deliberately NOT listed (ADR-151): this file is
      // public, and a `Disallow: /keystone` would name the portal's address
      // for anyone who read it. An anonymous request there is a 404
      // (ADR-146), and every portal page is `noindex` besides.
      { userAgent: "*", allow: "/", disallow: ["/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
