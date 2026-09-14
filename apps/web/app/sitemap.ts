import type { MetadataRoute } from "next";
import { articlePath, glossaryTermPath, getSitemapEntries, getEnabledTools } from "@repo/core";
import {
  ABOUT_PATHS,
  learnTrackGlossaryPath,
  learnTrackPath,
  learnTrackQuizzesPath,
  learnTrackVideosPath,
  LEARN_TRACK_KEYS,
  ROUTE_PATHS,
  toolPath,
  publicPagePath,
} from "@repo/contracts";
import { getServableLocales } from "@repo/i18n";
import { routing } from "@repo/i18n/routing";
import { siteUrl } from "./_lib/site-url.ts";

// Per-locale sitemap from PUBLISHED content only (the loaders are
// query-scoped to published/publicly-visible + non-deleted; article
// translations flagged noIndex are excluded at the query). Base URL from
// env — the same var Better Auth already requires, read through the one
// helper that owns its fallback (ADR-090).
//
// The seven content reads are ONE cached call now (`getSitemapEntries`,
// tagged `content`): this route used to run every loader uncached on every
// crawler hit, alone among the public surfaces.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [entries, enabledTools] = await Promise.all([getSitemapEntries(), getEnabledTools()]);
  // ADR-091: active locales, not the static superset. Listing /es and /ar
  // when neither is served is a crawl hint pointing at a 404 — the reasoning
  // ADR-086 #5 already applied to a disabled tool, and that this file already
  // applies twice below to unpublished content.
  const servableLocales = await getServableLocales();
  const servable = new Set<string>(servableLocales);

  /**
   * Content rows carry their OWN locale, so the same rule has to be applied a
   * second time here. A glossary term translated into `es` is a published row
   * whose URL 404s while `es` is inactive — filtering the locale list alone
   * would fix the static paths and leave every translated row behind.
   */
  const served = <T extends { locale: string }>(rows: T[]): T[] =>
    rows.filter((row) => servable.has(row.locale));

  const {
    glossary: glossaryEntries,
    articles: articleEntries,
    pages: pageEntries,
    learn: learnEntries,
    quizzes: quizEntries,
    glossaryTopics: topicEntries,
    videos: videoEntries,
  } = entries;

  // Coded routes — the home page, the About section (ADR-047) and the
  // economic calendar (ADR-050). These are files, not content rows, so they
  // are listed statically rather than loaded: nothing in the database knows
  // they exist.
  // `/learn` joins the static list, not the loaded one: the index is a route
  // file, and `loadLearnSitemapEntries` returns COURSE and LESSON URLs only.
  // Each TRACK's four indexes join it for the same reason (ADR-065 §1) — they
  // are route files over a code registry, so they are enumerated from the
  // registry rather than loaded, and registering a third track puts its four
  // URLs in the sitemap with no edit here.
  // The quiz RUNNER pages are listed; each one is `noindex, follow` in its own
  // metadata, which is not a contradiction — a sitemap entry is a crawl hint
  // and the robots directive is what decides indexing.
  const staticPaths = [
    "/",
    ...ABOUT_PATHS,
    ROUTE_PATHS["economic-calendar"],
    ROUTE_PATHS.learn,
    ...LEARN_TRACK_KEYS.flatMap((track) => [
      learnTrackPath(track),
      learnTrackQuizzesPath(track),
      learnTrackVideosPath(track),
      learnTrackGlossaryPath(track),
    ]),
    `${ROUTE_PATHS.glossary}/topics`,
    // The tools index plus every ENABLED tool (ADR-086 #5): a disabled tool
    // 404s, and listing a 404 in a sitemap is a crawl hint pointing at an
    // error page.
    ROUTE_PATHS.tools,
    ...enabledTools.map((tool) => toolPath(tool.key)),
  ];
  const staticPages: MetadataRoute.Sitemap = servableLocales.flatMap((locale) => {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    return staticPaths.map((path) => ({
      url: `${base}${prefix}${path}`,
      lastModified: new Date(),
    }));
  });

  const glossaryPages: MetadataRoute.Sitemap = served(glossaryEntries).map((entry) => ({
    url: `${base}${glossaryTermPath(entry.locale, routing.defaultLocale, entry.slug)}`,
    lastModified: entry.updatedAt,
  }));

  const articlePages: MetadataRoute.Sitemap = served(articleEntries).map((entry) => ({
    url: `${base}${articlePath(entry.locale, routing.defaultLocale, entry.slug)}`,
    lastModified: entry.updatedAt,
  }));

  // Module 16: CMS STATIC/COLLECTION pages (Phase 1 has only STATIC — the
  // home page is excluded by construction until it is published, PR 2.7).
  const cmsPages: MetadataRoute.Sitemap = served(pageEntries).map((entry) => ({
    url: `${base}${publicPagePath(entry.locale, routing.defaultLocale, entry.path)}`,
    lastModified: entry.updatedAt,
  }));

  /**
   * The learn loaders return an UNPREFIXED path plus the locale it belongs to,
   * so the prefix is applied here.
   *
   * This corrects a latent bug rather than adding a feature: the comment that
   * used to sit here claimed the loaders built the prefix themselves, and they
   * do not — `loadLearnSitemapEntries` returns `/learn/<slug>`. With only `en`
   * active (ADR-007) every entry was correct by coincidence, and activating a
   * second locale would have put unprefixed duplicates in the sitemap.
   */
  const localised = (entries: { path: string; locale: string; updatedAt: Date }[]) =>
    served(entries).map((entry) => ({
      url: `${base}${entry.locale === routing.defaultLocale ? "" : `/${entry.locale}`}${entry.path}`,
      lastModified: entry.updatedAt,
    }));

  // Already filtered to published + PUBLIC visibility — a draft or gated course
  // is ABSENT rather than `noindex`, because an unpublished learn route 404s
  // and a sitemap entry for a 404 is worse than no entry (plan §11).
  const learnPages: MetadataRoute.Sitemap = localised(learnEntries);
  const quizPages: MetadataRoute.Sitemap = localised(quizEntries);
  // D27. A topic with no published terms is omitted by the loader, so this
  // never lists a page that renders an empty list.
  const topicPages: MetadataRoute.Sitemap = localised(topicEntries);
  // ADR-068. Category VIEWS are not listed: they are filtered views over the
  // same topics, so every URL they contain is already here on its own page.
  const videoPages: MetadataRoute.Sitemap = localised(videoEntries);

  return [
    ...staticPages,
    ...glossaryPages,
    ...articlePages,
    ...cmsPages,
    ...learnPages,
    ...quizPages,
    ...topicPages,
    ...videoPages,
  ];
}
