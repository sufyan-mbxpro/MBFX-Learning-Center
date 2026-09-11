import type { MetadataRoute } from "next";
import {
  articlePath,
  glossaryTermPath,
  loadArticleSitemapEntries,
  loadGlossarySitemapEntries,
  loadLearnSitemapEntries,
  loadPageSitemapEntries,
  loadGlossaryTopicSitemapEntries,
  loadQuizSitemapEntries,
  loadVideoSitemapEntries,
} from "@repo/core";
import {
  ABOUT_PATHS,
  learnTrackGlossaryPath,
  learnTrackPath,
  learnTrackQuizzesPath,
  learnTrackVideosPath,
  LEARN_TRACK_KEYS,
  ROUTE_PATHS,
  publicPagePath,
} from "@repo/contracts";
import { routing } from "@repo/i18n/routing";

// Per-locale sitemap from PUBLISHED content only (the loaders are
// query-scoped to published/publicly-visible + non-deleted; article
// translations flagged noIndex are excluded at the query). Base URL from
// env — the same var Better Auth already requires.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const [
    glossaryEntries,
    articleEntries,
    pageEntries,
    learnEntries,
    quizEntries,
    topicEntries,
    videoEntries,
  ] = await Promise.all([
    loadGlossarySitemapEntries(),
    loadArticleSitemapEntries(),
    loadPageSitemapEntries(),
    loadLearnSitemapEntries(),
    loadQuizSitemapEntries(),
    loadGlossaryTopicSitemapEntries(),
    loadVideoSitemapEntries(),
  ]);

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
  ];
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
    entries.map((entry) => ({
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
