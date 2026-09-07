// Shared factory behind the news/analysis/trade-idea providers (ADR-022 §2:
// they wrap `public-articles.ts`, never re-deriving `publicArticleWhere`).
// Not one of the plan's four named provider files itself — it exists so
// those three files stay a one-line "here's our `ArticleKind`" call instead
// of triplicating the same composition.
import type { ArticleKind } from "@repo/db";
import {
  COLLECTION_LIMIT_MAX,
  type CollectionItem,
  type CollectionListResult,
  type CollectionProvider,
  type DetailItem,
  type Facets,
  type FilterDescriptor,
  type SortDescriptor,
} from "@repo/contracts";
import { articlePath } from "../../articles.ts";
import {
  getArticleBySlug,
  getArticleFacets,
  getPublishedArticles,
  getRelatedArticles,
  loadArticleCategoryBySlug,
  loadArticleTagBySlug,
  type ArticleListEntry,
} from "../../public-articles.ts";
import { getDefaultLocale } from "../paths.ts";

const FILTERS: FilterDescriptor[] = [
  { key: "category", labelKey: "cms.providers.article.filters.category", kind: "category" },
  { key: "tag", labelKey: "cms.providers.article.filters.tag", kind: "tag" },
];
const SORTS: SortDescriptor[] = [{ key: "newest", labelKey: "cms.providers.article.sorts.newest" }];

function toCollectionItem(
  entry: ArticleListEntry,
  locale: string,
  defaultLocale: string,
): CollectionItem {
  return {
    id: entry.articleId,
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.excerpt ?? undefined,
    imageUrl: entry.coverImageUrl ?? undefined,
    href: articlePath(locale, defaultLocale, entry.slug),
    date: entry.publishedAt ?? undefined,
    category: entry.category
      ? { slug: entry.category.slug, label: entry.category.name }
      : undefined,
  };
}

export function createArticleProvider(options: {
  key: string;
  labelKey: string;
  kinds: ArticleKind[];
}): CollectionProvider {
  return {
    key: options.key,
    labelKey: options.labelKey,
    filters: FILTERS,
    sorts: SORTS,

    async list(query, ctx): Promise<CollectionListResult> {
      const defaultLocale = await getDefaultLocale();
      const [category, tag] = await Promise.all([
        query.filter.category
          ? loadArticleCategoryBySlug(ctx.locale, query.filter.category)
          : Promise.resolve(undefined),
        query.filter.tag
          ? loadArticleTagBySlug(ctx.locale, query.filter.tag)
          : Promise.resolve(undefined),
      ]);
      // A named filter value that doesn't resolve to a real category/tag in
      // this locale degrades to zero results, not the unfiltered list — the
      // opposite failure mode would show content the filter meant to
      // exclude (security.md #6's "parse, don't cast" posture, generalised).
      if ((query.filter.category && !category) || (query.filter.tag && !tag)) {
        return { items: [], total: 0, page: query.page, limit: query.limit };
      }
      // Defense in depth: the search schema (`buildCollectionSearchSchema`)
      // already caps this at the route boundary, but a provider that trusts
      // its caller unconditionally is one bypassed boundary away from an
      // unbounded query (security.md #6, generalised).
      const limit = Math.min(query.limit, COLLECTION_LIMIT_MAX);
      const result = await getPublishedArticles(ctx.locale, {
        kinds: options.kinds,
        page: query.page,
        perPage: limit,
        ...(category ? { categoryId: category.id } : {}),
        ...(tag ? { tagId: tag.id } : {}),
        ...(query.q ? { q: query.q } : {}),
      });
      return {
        items: result.entries.map((e) => toCollectionItem(e, ctx.locale, defaultLocale)),
        total: result.total,
        page: query.page,
        limit,
      };
    },

    async bySlug(slug, ctx): Promise<DetailItem | null> {
      const view = await getArticleBySlug(ctx.locale, slug);
      // ADR-007: an article with no translation through the fallback chain
      // for this locale is "not available here," not fallback-language
      // content mislabeled as this locale's own.
      if (!view || view.requestedLocaleMissing || !options.kinds.includes(view.kind)) return null;
      const defaultLocale = await getDefaultLocale();
      return {
        id: view.articleId,
        slug: view.slug,
        title: view.title,
        excerpt: view.excerpt ?? undefined,
        imageUrl: view.coverImageUrl ?? undefined,
        href: articlePath(ctx.locale, defaultLocale, view.slug),
        date: view.publishedAt ?? undefined,
        category: view.category
          ? { slug: view.category.slug, label: view.category.name }
          : undefined,
        tags: view.tags.map((t) => ({ slug: t.slug, label: t.name })),
        body: view.body,
        seoTitle: view.seoTitle,
        seoDescription: view.seoDescription,
        ogImageUrl: view.ogImageUrl,
        canonicalUrl: view.canonicalUrl,
      };
    },

    async facets(ctx): Promise<Facets> {
      const f = await getArticleFacets(ctx.locale, { kinds: options.kinds });
      return {
        category: f.categories.map((c) => ({ value: c.slug, label: c.name, count: c.count })),
        tag: f.tags.map((t) => ({ value: t.slug, label: t.name, count: t.count })),
      };
    },

    // Only SAME_TAGS is real today — `loadRelatedArticles` is the only
    // relation `public-articles.ts` computes. The other three strategies
    // are Phase 5's `related-content` block surface, not invented here.
    async related(item, strategy, limit, ctx): Promise<CollectionItem[]> {
      if (strategy !== "SAME_TAGS") return [];
      const defaultLocale = await getDefaultLocale();
      const entries = await getRelatedArticles(item.id, ctx.locale, limit);
      return entries.map((e) => toCollectionItem(e, ctx.locale, defaultLocale));
    },
  };
}
