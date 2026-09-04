import type { MetadataRoute } from "next";
import {
  articlePath,
  glossaryTermPath,
  loadArticleSitemapEntries,
  loadGlossarySitemapEntries,
} from "@repo/core";
import { routing } from "@repo/i18n/routing";

// Per-locale sitemap from PUBLISHED content only (the loaders are
// query-scoped to published/publicly-visible + non-deleted; article
// translations flagged noIndex are excluded at the query). Base URL from
// env — the same var Better Auth already requires.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const [glossaryEntries, articleEntries] = await Promise.all([
    loadGlossarySitemapEntries(),
    loadArticleSitemapEntries(),
  ]);

  const staticPages: MetadataRoute.Sitemap = routing.locales.map((locale) => ({
    url: `${base}${locale === routing.defaultLocale ? "" : `/${locale}`}/`,
    lastModified: new Date(),
  }));

  const glossaryPages: MetadataRoute.Sitemap = glossaryEntries.map((entry) => ({
    url: `${base}${glossaryTermPath(entry.locale, routing.defaultLocale, entry.slug)}`,
    lastModified: entry.updatedAt,
  }));

  const articlePages: MetadataRoute.Sitemap = articleEntries.map((entry) => ({
    url: `${base}${articlePath(entry.locale, routing.defaultLocale, entry.slug)}`,
    lastModified: entry.updatedAt,
  }));

  return [...staticPages, ...glossaryPages, ...articlePages];
}
