import type { MetadataRoute } from "next";
import {
  articlePath,
  glossaryTermPath,
  loadArticleSitemapEntries,
  loadGlossarySitemapEntries,
  loadPageSitemapEntries,
} from "@repo/core";
import { ABOUT_PATHS, ROUTE_PATHS, publicPagePath } from "@repo/contracts";
import { routing } from "@repo/i18n/routing";

// Per-locale sitemap from PUBLISHED content only (the loaders are
// query-scoped to published/publicly-visible + non-deleted; article
// translations flagged noIndex are excluded at the query). Base URL from
// env — the same var Better Auth already requires.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const [glossaryEntries, articleEntries, pageEntries] = await Promise.all([
    loadGlossarySitemapEntries(),
    loadArticleSitemapEntries(),
    loadPageSitemapEntries(),
  ]);

  // Coded routes — the home page, the About section (ADR-047) and the
  // economic calendar (ADR-050). These are files, not content rows, so they
  // are listed statically rather than loaded: nothing in the database knows
  // they exist.
  const staticPaths = ["/", ...ABOUT_PATHS, ROUTE_PATHS["economic-calendar"]];
  const staticPages: MetadataRoute.Sitemap = routing.locales.flatMap((locale) => {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    return staticPaths.map((path) => ({
      url: `${base}${prefix}${path}`,
      lastModified: new Date(),
    }));
  });

  const glossaryPages: MetadataRoute.Sitemap = glossaryEntries.map((entry) => ({
    url: `${base}${glossaryTermPath(entry.locale, routing.defaultLocale, entry.slug)}`,
    lastModified: entry.updatedAt,
  }));

  const articlePages: MetadataRoute.Sitemap = articleEntries.map((entry) => ({
    url: `${base}${articlePath(entry.locale, routing.defaultLocale, entry.slug)}`,
    lastModified: entry.updatedAt,
  }));

  // Module 16: CMS STATIC/COLLECTION pages (Phase 1 has only STATIC — the
  // home page is excluded by construction until it is published, PR 2.7).
  const cmsPages: MetadataRoute.Sitemap = pageEntries.map((entry) => ({
    url: `${base}${publicPagePath(entry.locale, routing.defaultLocale, entry.path)}`,
    lastModified: entry.updatedAt,
  }));

  return [...staticPages, ...glossaryPages, ...articlePages, ...cmsPages];
}
