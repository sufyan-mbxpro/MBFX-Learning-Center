# ADR-022: Content-type and data-provider registry — two interfaces, one query context

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (replaces v1 §6.2–6.4's `content-adapters` design)
**Superseded by:** ADR-030 (in part — the `data-widget` block row is retired before it is built; `DataProvider` stands)

## Context

v1 §6.3 defines a single integration contract: every module normalises its
records to `{ id, slug, title, excerpt, image, date, url, category, tags,
badges }` so "cards are interchangeable". That works for news, analysis and
courses. It does not work for the things
`docs/changes/review-dynamic-site-paln.md` §9 and §13 explicitly ask for —
a live rates table, a currency converter, an economic calendar, a chart. A
USD/PKR quote has no slug, no excerpt and no detail page; forcing it through
a card shape produces either a lie or a special case.

The same critique (§6, §16) points out the second gap: v1 specifies filters,
search, sorting and pagination **only as News blocks** (`news-filter-bar`,
`news-pagination` in §6.4). That is the "NewsPageBuilder" the critique warns
against in §16 — the next content type would need its own filter bar.

And the hardest question is one v1 never asks: when an admin drops a
"Category Filter" block above a "News Grid" block, **what connects them?**

## Decision

### 1. Two provider interfaces, one registry

```ts
// @repo/contracts — the shapes
export interface CollectionItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  imageId?: string;
  imageUrl?: string;
  href: string;
  date?: Date;
  category?: { slug: string; label: string };
  tags?: { slug: string; label: string }[];
  badges?: string[]; // "featured" | "premium" | kind labels
}

export interface CollectionProvider<F = unknown> {
  key: string; // "news" | "analysis" | "course" | "glossary"
  labelKey: string; // i18n key — never a hardcoded string
  list(q: CollectionQuery, ctx: RenderContext): Promise<{ items: CollectionItem[]; total: number }>;
  bySlug?(slug: string, ctx: RenderContext): Promise<DetailItem | null>;
  facets?(ctx: RenderContext): Promise<Facets>; // categories, tags, authors
  related?(item: DetailItem, s: RelationStrategy, n: number): Promise<CollectionItem[]>;
  filters: FilterDescriptor[]; // what a filter block may offer for this type
  sorts: SortDescriptor[];
}

export interface DataProvider<T = unknown> {
  key: string; // "market.rates" | "market.calendar"
  labelKey: string;
  load(params: unknown, ctx: RenderContext): Promise<T>;
  schema: ZodType; // validates the block's params
}
```

Registries live in `@repo/core/src/cms/providers/` — the only place that
touches the database — and are **injected into `renderTree` as context**, so
`@repo/blocks` keeps no db dependency (ADR-020).

### 2. Providers wrap existing services; they never re-query

`news`, `analysis` and `trade-idea` providers call
`getPublishedArticles` / `getArticleFacets` / `publicArticleWhere` from
`packages/core/src/public-articles.ts`. **The frozen article-visibility
rule (ADR-015) is composed, never re-derived** — a provider that writes its
own `where` clause is a bug, and the review checklist says so. Same for
`course`/`glossary` (`public-content.ts`) and `market.*` (`market.ts`).

### 3. Blocks are generic; the provider supplies the vocabulary

Instead of v1 §6.4's eighteen News-specific blocks, the collection block set
is content-type agnostic and configured by `contentType`:

| Block                   | Props (abridged)                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collection`            | `contentType`, `filter` (category/tag/featured/premium), `sort`, `limit` (max 24), `layout` (grid/list/carousel), `columns`, `cardTemplateId` (ADR-023), `bindingId` |
| `collection-filter`     | `bindingId`, `filterKey` (from the provider's `filters`), `style` (pills/dropdown/checkboxes)                                                                        |
| `collection-search`     | `bindingId`, `placeholderKey`, `fields`                                                                                                                              |
| `collection-sort`       | `bindingId`, `options` (subset of the provider's `sorts`)                                                                                                            |
| `collection-pagination` | `bindingId`, `mode` (numbered/load-more)                                                                                                                             |
| `related-content`       | `strategy` (`SAME_CATEGORY \| SAME_TAGS \| SAME_AUTHOR \| MANUAL`), `limit`, `cardTemplateId`                                                                        |
| `content-field`         | `field` (from the provider's detail shape) — the critique's "Dynamic Field"                                                                                          |
| `data-widget`           | `provider` (DataProvider key), `params` (validated by that provider's schema), `variant`                                                                             |

A new content type ships a provider and appears in every one of these blocks
with no builder change. **This is the critique §16 requirement, enforced by
construction.**

### 4. Binding: a `bindingId` and the URL

Each `collection` block owns a `bindingId` (default `"main"`, unique within
a page). Filter, search, sort and pagination blocks name the `bindingId`
they drive. The renderer builds a **query context** per binding by merging,
in this order:

1. the collection block's authored defaults (`contentType`, base filter,
   limit, sort);
2. the URL search params, **namespaced** by binding when a page has more
   than one (`?q=`, `?category=`, `?page=` for `main`; `?g2.category=` for
   a second grid);
3. hard caps applied last: `limit ≤ 24`, `page ≤ 200`, unknown keys dropped.

Search params are parsed with a Zod schema **derived from the provider's own
`filters`/`sorts` descriptors** — so an unknown filter key or a malformed
page number degrades to the unfiltered first page rather than reaching the
database. This is the same posture `publicArticleSearchSchema` already takes
on `/news` (security.md #6), generalised.

The editor renders filter blocks with the provider's real facets so the
admin sees actual categories while designing, and it **warns when a filter
block names a `bindingId` no collection block on the page provides** —
the one failure mode that would otherwise ship silently.

### 5. Detail context

For a `DETAIL` page, the route resolves the item via
`provider.bySlug(slug)` and passes it as `ctx.item`. `content-field`,
`related-content` and SEO blocks read from it. Unknown field references
render nothing in production and a named warning in preview.

## Consequences

- **Two interfaces to maintain instead of one.** A content type that is
  "sort of" both (the economic calendar has items _and_ a widget view)
  implements whichever it needs, possibly both. Accepted: the alternative
  is one interface with half its fields meaningless per implementation.
- **Providers must be pure over `RenderContext`** (locale, subject, item) so
  the renderer can cache their results by tag (ADR-025). A provider that
  reads `headers()` or `cookies()` breaks static rendering of the page shell
  — a review checklist item, and a test that renders every provider from a
  cached scope.
- **Filter descriptors duplicate knowledge** the services already encode
  (which categories exist, which sorts are supported). Mitigated by
  deriving descriptors from the same constants the services use, and a test
  asserting every descriptor's `sortKey` is accepted by the service it
  wraps.
- **Multi-collection pages need namespaced params**, which makes URLs
  uglier. Accepted, and single-collection pages (the overwhelming majority)
  keep clean `?q=`/`?page=` URLs.
- **Back-navigation preserves filters for free**, because the URL is the
  only state — closing the critique §6 requirement without a
  `navigationConfig` blob.

## Alternatives considered

- **One adapter interface (v1 §6.3).** Rejected: rates/calendar/converter
  do not fit `CollectionItem`, and the critique §9 names this exactly.
- **React context between blocks instead of `bindingId` + URL.** Rejected:
  filters must survive a refresh, a share, and a back-navigation, and must
  be crawlable; component-level state gives up all four.
- **Client-side filtering of a pre-fetched list.** Rejected: it either ships
  the whole collection to the browser or lies about `total`, and it puts
  premium/visibility filtering on the client, which security.md forbids.
- **Per-content-type filter blocks** (`news-filter-bar`, `course-filter-bar`).
  Rejected — the critique §16's core objection.

## Compliance

- A conformance test suite runs **every registered provider** through the
  same contract: `list` honours `limit` caps, returns `total`, respects
  locale, and (for content types with a visibility rule) returns nothing a
  logged-out probe should not see.
- A test asserts the news provider's results equal
  `getPublishedArticles(...)` for the same query — proving it composes
  rather than re-derives `publicArticleWhere`.
- Lint/review: no `where:` clause inside `providers/*` that filters
  publication state directly.
- The editor's dangling-`bindingId` warning has a unit test.
