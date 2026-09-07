// Public-surface article reads (Module 15, ADR-015). Same discipline as
// public-content.ts: cached under the `content` tag, visibility enforced in
// the Prisma `where` — drafts structurally cannot leak. The extra wrinkle
// here is TIME: a SCHEDULED article whose moment has passed is publicly
// live without any cron (ADR-015 #6); the where-clause is the scheduler.
import { cacheLife, cacheTag } from "next/cache";
import { ArticleKind, ContentStatus, db } from "@repo/db";
import { pickTranslation, type LocaleFallbackInfo } from "@repo/i18n";
import { readingTimeMinutes } from "@repo/utils";
import { ARTICLE, RELATED, loadRelationTargets } from "./content-relations.ts";

interface LocaleContext {
  locales: LocaleFallbackInfo[];
  defaultLocale: string;
}

async function localeContext(): Promise<LocaleContext> {
  const locales = await db.locale.findMany({
    select: { code: true, fallbackCode: true, isDefault: true },
  });
  return {
    locales: locales.map((l) => ({ code: l.code, fallbackCode: l.fallbackCode })),
    defaultLocale: locales.find((l) => l.isDefault)?.code ?? "en",
  };
}

/**
 * The visibility rule as one pure, testable expression (ADR-015 compliance
 * note): not deleted × active × active category × (PUBLISHED, or SCHEDULED
 * whose time has come). The module on/off check (`news`/`analysis` feature
 * flags) lives at the page level like every other feature.
 */
export function publicArticleWhere(now: Date) {
  return {
    deletedAt: null,
    isActive: true,
    category: { isActive: true },
    OR: [
      { status: ContentStatus.PUBLISHED },
      { status: ContentStatus.SCHEDULED, scheduledFor: { lte: now } },
    ],
  };
}

/** A due-but-unswept SCHEDULED article's publish time is its scheduled one. */
export function effectivePublishedAt(row: {
  publishedAt: Date | null;
  scheduledFor: Date | null;
}): Date | null {
  return row.publishedAt ?? row.scheduledFor;
}

export interface ArticleListEntry {
  articleId: string;
  kind: ArticleKind;
  locale: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
  /**
   * Byline for the card's author row (changes-04 image-10). Rendering it is
   * gated by `articles.showAuthor` at the call site, the same way the
   * detail page already gates it — this read just makes it available.
   *
   * `Article` carries a bare `authorId` column with NO Prisma relation
   * (which is why the detail page does its own `db.user.findUnique`), so
   * this is batch-resolved: ONE extra query per page regardless of row
   * count, rather than the detail page's pattern repeated 48 times.
   */
  authorName: string | null;
  /**
   * The editor's "Featured" toggle (changes-07 PR 8). Stored since that PR
   * but read by nothing on the public surface until the /news spotlight — a
   * flag an editor sets and no reader ever sees is a promise the product was
   * not keeping.
   */
  isFeatured: boolean;
}

/**
 * authorId → display name for a page of articles, in ONE query. Returns an
 * empty map when no row has an author (the common case for ingested
 * articles, whose authorId is null).
 */
async function authorNamesFor(
  rows: { authorId: string | null }[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(rows.map((r) => r.authorId).filter((id) => id !== null))];
  if (ids.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export interface ArticleListPage {
  entries: ArticleListEntry[];
  total: number;
  pageCount: number;
}

export interface ListPublishedArticlesOptions {
  kinds: ArticleKind[];
  page: number;
  perPage: number;
  categoryId?: string;
  tagId?: string;
  /**
   * Free-text filter over the TRANSLATION rows' title/excerpt
   * (changes-03-plan.md §5.3). Parsed at the route boundary through
   * `publicArticleSearchSchema` — never taken raw from searchParams.
   *
   * Deliberately a `contains` match, not full-text: it filters an already
   * visibility-scoped set, and a real search backend is out of scope (the
   * plan says so explicitly). Matching on translations means a query only
   * ever hits text in a locale the reader can actually see.
   */
  q?: string;
  /**
   * Article ids the page has already rendered elsewhere — the /news
   * spotlight's picks, so the grid beneath it does not repeat them.
   *
   * Applied to the COUNT as well as the rows (it is part of `where`), so
   * `total`/`pageCount` describe the set actually being paginated. The
   * caller must pass the same ids on every page of a run or the pagination
   * shifts under the reader; `getSpotlightArticles` is deterministic for
   * exactly that reason.
   */
  excludeIds?: string[];
  /**
   * Restrict to articles an editor flagged Featured. Composed into the same
   * `where` as everything else so the frozen visibility rule
   * (`publicArticleWhere`) is never re-derived for the spotlight — a
   * featured DRAFT stays invisible, like any other draft.
   */
  featuredOnly?: boolean;
}

export async function loadPublishedArticles(
  locale: string,
  options: ListPublishedArticlesOptions,
): Promise<ArticleListPage> {
  const now = new Date();
  const where = {
    ...publicArticleWhere(now),
    kind: { in: options.kinds },
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.tagId ? { tags: { some: { tagId: options.tagId } } } : {}),
    ...(options.excludeIds?.length ? { id: { notIn: options.excludeIds } } : {}),
    ...(options.featuredOnly ? { isFeatured: true } : {}),
    ...(options.q
      ? {
          translations: {
            some: {
              OR: [{ title: { contains: options.q } }, { excerpt: { contains: options.q } }],
            },
          },
        }
      : {}),
  };
  const [ctx, rows, total] = await Promise.all([
    localeContext(),
    db.article.findMany({
      where,
      // Effective publish time isn't a column; publishedAt with scheduledFor
      // as tiebreaker is close enough for a feed (due-scheduled rows have
      // publishedAt null and sort last until swept — visible either way).
      orderBy: [{ publishedAt: "desc" }, { scheduledFor: "desc" }],
      skip: options.page * options.perPage,
      take: options.perPage,
      include: {
        translations: { select: { locale: true, title: true, slug: true, excerpt: true } },
        category: {
          include: { translations: { select: { locale: true, name: true, slug: true } } },
        },
      },
    }),
    db.article.count({ where }),
  ]);

  const authorNames = await authorNamesFor(rows);
  const entries: ArticleListEntry[] = [];
  for (const row of rows) {
    // ADR-007: no translation through the fallback chain → omitted, never
    // silently-English inside an RTL page.
    const picked = pickTranslation(row.translations, locale, ctx.defaultLocale, ctx.locales);
    if (!picked) continue;
    const category = pickTranslation(
      row.category.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    entries.push({
      articleId: row.id,
      kind: row.kind,
      locale: picked.locale,
      title: picked.title,
      slug: picked.slug,
      excerpt: picked.excerpt,
      coverImageUrl: row.coverImageUrl,
      publishedAt: effectivePublishedAt(row),
      category: category ? { name: category.name, slug: category.slug } : null,
      authorName: row.authorId ? (authorNames.get(row.authorId) ?? null) : null,
      isFeatured: row.isFeatured,
    });
  }
  return { entries, total, pageCount: Math.max(1, Math.ceil(total / options.perPage)) };
}

export async function getPublishedArticles(
  locale: string,
  options: ListPublishedArticlesOptions,
): Promise<ArticleListPage> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadPublishedArticles(locale, options);
}

/**
 * The /news masthead's spotlight: the editor's Featured articles, newest
 * first, TOPPED UP with the newest unflagged ones when there are not enough.
 *
 * Topping up is the design, not a fallback bolted on. The spotlight is part
 * of the page's layout, so it has to fill: a site with nothing flagged would
 * otherwise open on a hole where its lead story goes. An editor who flags
 * three articles gets exactly those three; an editor who flags none gets the
 * three most recent, which is what a reader expects anyway.
 *
 * Deterministic for a given content set — same input, same ids, same order —
 * which is what lets the listing exclude these ids on EVERY page without the
 * pagination shifting under the reader between page 1 and page 2.
 */
export async function loadSpotlightArticles(
  locale: string,
  options: { kinds: ArticleKind[]; limit: number },
): Promise<ArticleListEntry[]> {
  if (options.limit <= 0) return [];
  const { kinds, limit } = options;

  const featured = await loadPublishedArticles(locale, {
    kinds,
    page: 0,
    perPage: limit,
    featuredOnly: true,
  });
  if (featured.entries.length >= limit) return featured.entries.slice(0, limit);

  const topUp = await loadPublishedArticles(locale, {
    kinds,
    page: 0,
    perPage: limit - featured.entries.length,
    excludeIds: featured.entries.map((entry) => entry.articleId),
  });
  return [...featured.entries, ...topUp.entries];
}

export async function getSpotlightArticles(
  locale: string,
  options: { kinds: ArticleKind[]; limit: number },
): Promise<ArticleListEntry[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadSpotlightArticles(locale, options);
}

export interface ArticleView {
  articleId: string;
  kind: ArticleKind;
  locale: string;
  requestedLocaleMissing: boolean;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  coverImageUrl: string | null;
  videoUrl: string | null;
  isPremium: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  readingMinutes: number;
  authorName: string | null;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  // changes-07 PR 8 — per-locale social/robots overrides and the article-level
  // header image, related settings and FAQ list the detail page renders.
  noFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterCard: string | null;
  twitterImageUrl: string | null;
  headerImageUrl: string | null;
  showRelated: boolean;
  relatedCount: number;
  faqItems: { question: string; answer: string }[];
  alternates: { locale: string; slug: string }[];
}

export async function loadArticleBySlug(locale: string, slug: string): Promise<ArticleView | null> {
  const now = new Date();
  const ctx = await localeContext();
  const translation = await db.articleTranslation.findFirst({
    where: { slug, locale, article: publicArticleWhere(now) },
    include: {
      article: {
        include: {
          // FAQ rows ride along with each translation so the picked one has its
          // own locale’s list (changes-07 PR 8).
          translations: { include: { faqItems: { orderBy: { sortOrder: "asc" } } } },
          category: {
            include: { translations: { select: { locale: true, name: true, slug: true } } },
          },
          tags: {
            include: {
              tag: {
                select: {
                  isActive: true,
                  translations: { select: { locale: true, name: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!translation) return null;

  const article = translation.article;
  const picked = pickTranslation(article.translations, locale, ctx.defaultLocale, ctx.locales);
  const alternates = article.translations.map((t) => ({ locale: t.locale, slug: t.slug }));
  const categoryTranslation = pickTranslation(
    article.category.translations,
    locale,
    ctx.defaultLocale,
    ctx.locales,
  );
  const tags = article.tags
    .filter((assignment) => assignment.tag.isActive)
    .map((assignment) =>
      pickTranslation(assignment.tag.translations, locale, ctx.defaultLocale, ctx.locales),
    )
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .map((t) => ({ name: t.name, slug: t.slug }));

  const authorName = article.authorId
    ? ((await db.user.findUnique({ where: { id: article.authorId }, select: { name: true } }))
        ?.name ?? null)
    : null;

  if (!picked) {
    return {
      articleId: article.id,
      kind: article.kind,
      locale,
      requestedLocaleMissing: true,
      title: translation.title,
      slug: translation.slug,
      excerpt: null,
      body: null,
      coverImageUrl: article.coverImageUrl,
      videoUrl: article.videoUrl,
      isPremium: article.isPremium,
      publishedAt: effectivePublishedAt(article),
      updatedAt: article.updatedAt,
      readingMinutes: 0,
      authorName,
      category: categoryTranslation
        ? { name: categoryTranslation.name, slug: categoryTranslation.slug }
        : null,
      tags,
      seoTitle: null,
      seoDescription: null,
      ogImageUrl: null,
      canonicalUrl: null,
      noIndex: true,
      noFollow: false,
      ogTitle: null,
      ogDescription: null,
      twitterCard: null,
      twitterImageUrl: null,
      headerImageUrl: article.headerImageUrl,
      showRelated: article.showRelated,
      relatedCount: article.relatedCount,
      faqItems: [],
      alternates,
    };
  }

  return {
    articleId: article.id,
    kind: article.kind,
    locale: picked.locale,
    requestedLocaleMissing: false,
    title: picked.title,
    slug: picked.slug,
    excerpt: picked.excerpt,
    body: picked.body,
    coverImageUrl: article.coverImageUrl,
    videoUrl: article.videoUrl,
    isPremium: article.isPremium,
    publishedAt: effectivePublishedAt(article),
    updatedAt: article.updatedAt,
    readingMinutes: readingTimeMinutes(picked.body ?? ""),
    authorName,
    category: categoryTranslation
      ? { name: categoryTranslation.name, slug: categoryTranslation.slug }
      : null,
    tags,
    seoTitle: picked.seoTitle,
    seoDescription: picked.seoDescription,
    ogImageUrl: picked.ogImageUrl,
    canonicalUrl: picked.canonicalUrl,
    noIndex: picked.noIndex,
    noFollow: picked.noFollow,
    ogTitle: picked.ogTitle,
    ogDescription: picked.ogDescription,
    twitterCard: picked.twitterCard,
    twitterImageUrl: picked.twitterImageUrl,
    headerImageUrl: article.headerImageUrl,
    showRelated: article.showRelated,
    relatedCount: article.relatedCount,
    faqItems: picked.faqItems.map((f) => ({ question: f.question, answer: f.answer })),
    alternates,
  };
}

export async function getArticleBySlug(locale: string, slug: string): Promise<ArticleView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadArticleBySlug(locale, slug);
}

/** Related by shared tags, newest first (articles.relatedCount drives the limit at the page). */
export async function loadRelatedArticles(
  articleId: string,
  locale: string,
  limit: number,
): Promise<ArticleListEntry[]> {
  if (limit <= 0) return [];
  const tagIds = (
    await db.articleTagAssignment.findMany({ where: { articleId }, select: { tagId: true } })
  ).map((t) => t.tagId);
  if (tagIds.length === 0) return [];

  const now = new Date();
  const ctx = await localeContext();
  const rows = await db.article.findMany({
    where: {
      ...publicArticleWhere(now),
      id: { not: articleId },
      tags: { some: { tagId: { in: tagIds } } },
    },
    orderBy: [{ publishedAt: "desc" }, { scheduledFor: "desc" }],
    take: limit,
    include: {
      translations: { select: { locale: true, title: true, slug: true, excerpt: true } },
      category: {
        include: { translations: { select: { locale: true, name: true, slug: true } } },
      },
    },
  });
  const relatedAuthorNames = await authorNamesFor(rows);
  const entries: ArticleListEntry[] = [];
  for (const row of rows) {
    const picked = pickTranslation(row.translations, locale, ctx.defaultLocale, ctx.locales);
    if (!picked) continue;
    const category = pickTranslation(
      row.category.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    entries.push({
      articleId: row.id,
      kind: row.kind,
      locale: picked.locale,
      title: picked.title,
      slug: picked.slug,
      excerpt: picked.excerpt,
      coverImageUrl: row.coverImageUrl,
      publishedAt: effectivePublishedAt(row),
      category: category ? { name: category.name, slug: category.slug } : null,
      authorName: row.authorId ? (relatedAuthorNames.get(row.authorId) ?? null) : null,
      isFeatured: row.isFeatured,
    });
  }
  return entries;
}

/**
 * CURATED related articles — the ones an editor picked by hand in the article
 * editor (changes-07 PR 3), stored as `ContentRelation` rows.
 *
 * Visibility composes `publicArticleWhere(now)`, the frozen rule from Module
 * 15's SKILL.md, so a curated pick that is drafted, deactivated, deleted,
 * scheduled-for-later or in a deactivated category can never leak through.
 * The rule is never re-derived here.
 *
 * Returns FEWER than `limit` when some curated picks aren't publicly visible.
 * It does not top up with automatic ones: a curated list quietly padded with
 * algorithmic picks is not what the editor chose. (Falling back wholesale when
 * nothing is curated is a different question — see `loadRelatedArticles`.)
 */
export async function loadCuratedRelatedArticles(
  articleId: string,
  locale: string,
  limit: number,
): Promise<ArticleListEntry[]> {
  if (limit <= 0) return [];
  const targetIds = await loadRelationTargets({
    sourceType: ARTICLE,
    sourceId: articleId,
    targetType: ARTICLE,
    relationType: RELATED,
  });
  if (targetIds.length === 0) return [];

  const now = new Date();
  const ctx = await localeContext();
  const rows = await db.article.findMany({
    where: { AND: [{ id: { in: targetIds } }, publicArticleWhere(now)] },
    include: {
      translations: { select: { locale: true, title: true, slug: true, excerpt: true } },
      category: {
        include: { translations: { select: { locale: true, name: true, slug: true } } },
      },
    },
  });
  const authorNames = await authorNamesFor(rows);

  // Restore the editor's order — an `in` query returns database order, not the
  // curated one.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const entries: ArticleListEntry[] = [];
  for (const id of targetIds) {
    if (entries.length >= limit) break;
    const row = byId.get(id);
    if (!row) continue;
    const picked = pickTranslation(row.translations, locale, ctx.defaultLocale, ctx.locales);
    if (!picked) continue;
    const category = pickTranslation(
      row.category.translations,
      locale,
      ctx.defaultLocale,
      ctx.locales,
    );
    entries.push({
      articleId: row.id,
      title: picked.title,
      slug: picked.slug,
      excerpt: picked.excerpt,
      coverImageUrl: row.coverImageUrl,
      publishedAt: effectivePublishedAt(row),
      kind: row.kind,
      locale: picked.locale,
      category: category ? { name: category.name, slug: category.slug } : null,
      authorName: row.authorId ? (authorNames.get(row.authorId) ?? null) : null,
      isFeatured: row.isFeatured,
    });
  }
  return entries;
}

/**
 * What the public detail page renders: the editor's curated picks if there are
 * any, otherwise the automatic by-shared-tags list.
 *
 * Curation is opt-in per article, so an editor who never opens the Related
 * Posts panel keeps exactly the behaviour that shipped with Module 15 — the
 * fallback is what stops "Show Related Posts" from rendering an empty strip on
 * every pre-existing article.
 */
export async function getRelatedArticles(
  articleId: string,
  locale: string,
  limit: number,
): Promise<ArticleListEntry[]> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  const curated = await loadCuratedRelatedArticles(articleId, locale, limit);
  if (curated.length > 0) return curated;
  return loadRelatedArticles(articleId, locale, limit);
}

// ─── Category / tag archive resolution ───────────────────────

export interface ArticleTaxonomyView {
  id: string;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  alternates: { locale: string; slug: string }[];
}

export async function loadArticleCategoryBySlug(
  locale: string,
  slug: string,
): Promise<ArticleTaxonomyView | null> {
  const translation = await db.articleCategoryTranslation.findFirst({
    where: { slug, locale, category: { isActive: true } },
    include: { category: { include: { translations: true } } },
  });
  if (!translation) return null;
  return {
    id: translation.categoryId,
    name: translation.name,
    description: translation.description,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    alternates: translation.category.translations.map((t) => ({
      locale: t.locale,
      slug: t.slug,
    })),
  };
}

export async function getArticleCategoryBySlug(
  locale: string,
  slug: string,
): Promise<ArticleTaxonomyView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadArticleCategoryBySlug(locale, slug);
}

export async function loadArticleTagBySlug(
  locale: string,
  slug: string,
): Promise<ArticleTaxonomyView | null> {
  const translation = await db.articleTagTranslation.findFirst({
    where: { slug, locale, tag: { isActive: true } },
    include: { tag: { include: { translations: true } } },
  });
  if (!translation) return null;
  return {
    id: translation.tagId,
    name: translation.name,
    description: null,
    seoTitle: null,
    seoDescription: null,
    alternates: translation.tag.translations.map((t) => ({ locale: t.locale, slug: t.slug })),
  };
}

export async function getArticleTagBySlug(
  locale: string,
  slug: string,
): Promise<ArticleTaxonomyView | null> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadArticleTagBySlug(locale, slug);
}

// ─── Feeds ───────────────────────────────────────────────────

/** Sitemap feed: publicly visible, non-noIndex translations. */
export async function loadArticleSitemapEntries(): Promise<
  { locale: string; slug: string; updatedAt: Date }[]
> {
  return db.articleTranslation.findMany({
    where: { noIndex: false, article: publicArticleWhere(new Date()) },
    select: { locale: true, slug: true, updatedAt: true },
  });
}

export interface ArticleRssEntry {
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
}

/** RSS 2.0 source (default-locale feed at launch, ADR-015 #11). */
export async function loadArticleRssEntries(
  locale: string,
  limit: number,
): Promise<ArticleRssEntry[]> {
  const page = await loadPublishedArticles(locale, {
    kinds: [ArticleKind.NEWS, ArticleKind.ANALYSIS, ArticleKind.TRADE_IDEA],
    page: 0,
    perPage: limit,
  });
  return page.entries.map((entry) => ({
    title: entry.title,
    slug: entry.slug,
    excerpt: entry.excerpt,
    publishedAt: entry.publishedAt,
    categoryName: entry.category?.name ?? null,
  }));
}

// ─── Blog sidebar facets (changes-03-plan.md §5.3) ────────────
//
// The reference's listing sidebar (image-10.png) shows categories, popular
// tags, latest posts and a month archive. Four reads, one cached function,
// one `content` tag — a sidebar that revalidates with the articles it
// describes rather than four independently-cached fragments drifting apart.

export interface ArticleFacetTerm {
  id: string;
  name: string;
  slug: string;
  /** Published-article count, so empty terms can be hidden by the caller. */
  count: number;
}

export interface ArticleArchiveEntry {
  /** First day of the month, UTC — the caller formats it per locale. */
  month: Date;
  count: number;
}

export interface ArticleFacets {
  categories: ArticleFacetTerm[];
  tags: ArticleFacetTerm[];
  archives: ArticleArchiveEntry[];
  latest: ArticleListEntry[];
}

export async function loadArticleFacets(
  locale: string,
  options: { kinds: ArticleKind[]; latestCount?: number; tagLimit?: number } = {
    kinds: [ArticleKind.NEWS, ArticleKind.ANALYSIS, ArticleKind.TRADE_IDEA],
  },
): Promise<ArticleFacets> {
  const now = new Date();
  const kinds = options.kinds;
  const visible = { ...publicArticleWhere(now), kind: { in: kinds } };

  const [ctx, categories, tags, dated, latest] = await Promise.all([
    localeContext(),
    db.articleCategory.findMany({
      where: { isActive: true },
      include: {
        translations: { select: { locale: true, name: true, slug: true } },
        _count: { select: { articles: { where: visible } } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.articleTag.findMany({
      where: { isActive: true },
      include: {
        translations: { select: { locale: true, name: true, slug: true } },
        _count: { select: { articles: { where: { article: visible } } } },
      },
    }),
    // Archive months are derived in JS rather than SQL: the effective
    // publish date is `publishedAt ?? scheduledFor` (a due-but-unswept
    // SCHEDULED row is live, ADR-015 #6), which no single column can
    // GROUP BY. Selecting two dates is cheap; getting this wrong would
    // silently drop just-published months from the archive.
    db.article.findMany({
      where: visible,
      select: { publishedAt: true, scheduledFor: true },
    }),
    loadPublishedArticles(locale, { kinds, page: 0, perPage: options.latestCount ?? 3 }),
  ]);

  function localize(
    translations: { locale: string; name: string; slug: string }[],
    id: string,
    count: number,
  ): ArticleFacetTerm | null {
    const picked = pickTranslation(translations, locale, ctx.defaultLocale, ctx.locales);
    // Same ADR-007 rule the listing itself follows: no translation through
    // the fallback chain → the term is omitted, never shown in English
    // inside an RTL page.
    return picked ? { id, name: picked.name, slug: picked.slug, count } : null;
  }

  const monthCounts = new Map<number, number>();
  for (const row of dated) {
    const effective = effectivePublishedAt(row);
    if (!effective) continue;
    const month = Date.UTC(effective.getUTCFullYear(), effective.getUTCMonth(), 1);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }

  return {
    categories: categories
      .map((c) => localize(c.translations, c.id, c._count.articles))
      .filter((c) => c !== null),
    tags: tags
      .map((t) => localize(t.translations, t.id, t._count.articles))
      .filter((t) => t !== null)
      // Popularity order, then a cap — the reference shows a tag cloud, not
      // every tag ever created.
      .sort((a, b) => b.count - a.count)
      .slice(0, options.tagLimit ?? 12),
    archives: [...monthCounts.entries()]
      .map(([month, count]) => ({ month: new Date(month), count }))
      .sort((a, b) => b.month.getTime() - a.month.getTime()),
    latest: latest.entries,
  };
}

export async function getArticleFacets(
  locale: string,
  options?: { kinds: ArticleKind[]; latestCount?: number; tagLimit?: number },
): Promise<ArticleFacets> {
  "use cache";
  cacheTag("content");
  cacheLife({ revalidate: 300 });
  return loadArticleFacets(locale, options);
}
