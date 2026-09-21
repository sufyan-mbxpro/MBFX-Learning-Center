// The sitemap's one cached read (ADR-090).
//
// `sitemap.ts` fanned out to seven UNCACHED `load*SitemapEntries` loaders on
// every request, while every other public read on the site is `"use cache"` +
// `cacheTag("content")`. That is seven full-table scans per crawler hit, and
// — worse than the cost — it made the sitemap the only public surface whose
// freshness was unrelated to the publish that changed it.
//
// The loaders keep the repo's naming contract: `load*` is the pure read a
// Testcontainers integration test can call without Next's `"use cache"`
// transform, `get*` is the cached production entry point (the `@repo/settings`
// precedent). So the cache goes HERE, on one aggregate, rather than being
// sprinkled across seven files and renaming their tests' entry points.
//
// One tag for all seven because one editorial action is what changes any of
// them; `revalidateTag("content", { expire: 0 })` on a publish already drops
// this alongside the page it added.
import { cacheLife, cacheTag } from "next/cache";
import { loadGlossarySitemapEntries } from "./public-content.ts";
import { loadArticleSitemapEntries, loadArticleTaxonomySitemapEntries } from "./public-articles.ts";
import { loadPageSitemapEntries } from "./cms/public-pages.ts";
import { loadLearnSitemapEntries, type LearnSitemapEntry } from "./public-courses.ts";
import {
  loadGlossaryTopicSitemapEntries,
  type GlossaryTopicSitemapEntry,
} from "./glossary-topics.ts";
import { loadVideoSitemapEntries, type VideoSitemapEntry } from "./videos.ts";

/** A row addressed by its own slug — the sitemap builds the path from it. */
export interface SlugSitemapEntry {
  locale: string;
  slug: string;
  updatedAt: Date;
}

/** A CMS page, addressed by a stored path rather than a slug. */
export interface PathSitemapEntry {
  locale: string;
  path: string;
  updatedAt: Date;
}

export interface SitemapEntries {
  glossary: SlugSitemapEntry[];
  articles: SlugSitemapEntry[];
  /** `/news/category/<slug>` archives with at least one public article. */
  articleCategories: SlugSitemapEntry[];
  /** `/news/tag/<slug>` archives with at least one public article. */
  articleTags: SlugSitemapEntry[];
  pages: PathSitemapEntry[];
  learn: LearnSitemapEntry[];
  glossaryTopics: GlossaryTopicSitemapEntry[];
  videos: VideoSitemapEntry[];
}

/**
 * Every content-derived sitemap URL, in one cached read.
 *
 * Each loader is already query-scoped to publicly visible, non-deleted,
 * non-`noIndex` rows — unpublished content is ABSENT from the sitemap rather
 * than listed and noindexed, because a crawl hint pointing at a 404 is worse
 * than no hint (plan §11). That rule lives in the loaders and is unchanged
 * here; this function only decides when they run.
 */
export async function getSitemapEntries(): Promise<SitemapEntries> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 3600 });

  const [glossary, articles, taxonomy, pages, learn, glossaryTopics, videos] = await Promise.all([
    loadGlossarySitemapEntries(),
    loadArticleSitemapEntries(),
    loadArticleTaxonomySitemapEntries(),
    loadPageSitemapEntries(),
    loadLearnSitemapEntries(),
    loadGlossaryTopicSitemapEntries(),
    loadVideoSitemapEntries(),
  ]);

  return {
    glossary,
    articles,
    articleCategories: taxonomy.categories,
    articleTags: taxonomy.tags,
    pages,
    learn,
    glossaryTopics,
    videos,
  };
}
