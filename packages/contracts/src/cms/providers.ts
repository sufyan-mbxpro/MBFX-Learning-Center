// Content-type and data-provider registry (ADR-022, plan v2.2 §12 PR 4.1).
// Two interfaces, one query context: `CollectionProvider` for things with a
// list + a detail page (news, analysis, courses, glossary); `DataProvider`
// for things that are not a list of items at all (a rates table, a
// converter). Both live here (not `@repo/blocks`) so `@repo/core`'s
// concrete providers and `@repo/blocks`'s renderer can each depend on them
// without a cycle — `@repo/blocks` never depends on `@repo/core`.
//
// `ProviderContext` is deliberately narrower than ADR-022's illustrative
// `RenderContext` signature: providers only ever need `locale` today.
// `RenderContext` (defined in `@repo/blocks/render.tsx`) is a structural
// superset of this shape, so passing the real render context to a
// provider's `list`/`bySlug` type-checks with no explicit coupling in
// either direction — widen this interface, not `RenderContext`, if a
// provider ever needs more (e.g. `subject` for a per-viewer relation).
import { z } from "zod";

export interface ProviderContext {
  locale: string;
}

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
  /** "featured" | "premium" | a kind label — free-form, rendered by the card template. */
  badges?: string[];
}

/** What a DETAIL page has beyond the card shape. Extended further as Phase 5 needs it — additive, no existing field changes meaning. */
export interface DetailItem extends CollectionItem {
  body?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
}

export type RelationStrategy = "SAME_CATEGORY" | "SAME_TAGS" | "SAME_AUTHOR" | "MANUAL";

export interface FilterDescriptor {
  key: string;
  labelKey: string;
  kind: "category" | "tag" | "boolean";
}

export interface SortDescriptor {
  key: string;
  labelKey: string;
}

export interface FacetTerm {
  value: string;
  label: string;
  count: number;
}

/** Filter key → its available terms, for the editor's filter block to show real facets while designing (ADR-022 §4). */
export type Facets = Record<string, FacetTerm[]>;

export interface CollectionQuery {
  contentType: string;
  bindingId: string;
  /** Resolved filter key → value (e.g. `{ category: "risk-management" }`), already namespace-stripped and cap-applied by the search schema below. */
  filter: Record<string, string>;
  sort?: string;
  /** 0-based. */
  page: number;
  /** Already ≤ 24 by the time a provider sees it. */
  limit: number;
  q?: string;
}

export interface CollectionListResult {
  items: CollectionItem[];
  total: number;
  /** Echoes the query's own `page`/`limit` back, so a `collection-pagination` block (which only ever sees this result, not the query that produced it) can compute a page count with no second source of truth. */
  page: number;
  limit: number;
}

/**
 * The canonical, already-resolved query for one `collection` block's
 * `bindingId` (plan v2.2 §12 PR 4.2, ADR-022 §4) — built once per render by
 * walking the tree for the `collection` node that owns this binding, so
 * every other block naming the same `bindingId` (a filter/sort/pagination
 * control) can declare an identical `BlockDataNeed` and dedupe onto the
 * SAME resolved result, without any of them hardcoding a provider's filter
 * vocabulary (that genericity is ADR-022 §3's whole point).
 */
export interface CollectionBinding {
  contentType: string;
  query: CollectionQuery;
}

export interface CollectionProvider {
  key: string;
  labelKey: string;
  filters: FilterDescriptor[];
  sorts: SortDescriptor[];
  list(query: CollectionQuery, ctx: ProviderContext): Promise<CollectionListResult>;
  bySlug?(slug: string, ctx: ProviderContext): Promise<DetailItem | null>;
  facets?(ctx: ProviderContext): Promise<Facets>;
  related?(
    item: DetailItem,
    strategy: RelationStrategy,
    limit: number,
    ctx: ProviderContext,
  ): Promise<CollectionItem[]>;
}

export interface DataProvider<T = unknown> {
  key: string;
  labelKey: string;
  schema: z.ZodType;
  load(params: unknown, ctx: ProviderContext): Promise<T>;
}

export type CollectionProviderRegistry = Record<string, CollectionProvider>;
export type DataProviderRegistry = Record<string, DataProvider>;

/** Hard caps applied last, regardless of what a filter/sort block authored or what the URL asked for (ADR-022 §4, security.md #6). */
export const COLLECTION_LIMIT_MAX = 24;
export const COLLECTION_PAGE_MAX = 200;

/**
 * A namespaced search-param schema derived from a provider's own
 * `filters`/`sorts` — an unknown filter key or a malformed page number
 * degrades to the unfiltered first page rather than reaching the database,
 * the same posture `publicArticleSearchSchema` already takes on `/news`,
 * generalised. `namespace` is `undefined` for a page's single (default,
 * `"main"`) binding and the binding id for every additional one, per
 * ADR-022 §4's "clean URLs for the common case" rule.
 */
export function buildCollectionSearchSchema(
  provider: Pick<CollectionProvider, "filters" | "sorts">,
  namespace?: string,
) {
  const prefix = namespace ? `${namespace}.` : "";
  const shape: Record<string, z.ZodTypeAny> = {
    [`${prefix}q`]: z.string().trim().min(1).max(100).optional(),
    [`${prefix}page`]: z.coerce.number().int().min(0).max(COLLECTION_PAGE_MAX).optional(),
    [`${prefix}limit`]: z.coerce.number().int().min(1).max(COLLECTION_LIMIT_MAX).optional(),
  };
  if (provider.sorts.length > 0) {
    const sortKeys = provider.sorts.map((s) => s.key) as [string, ...string[]];
    shape[`${prefix}sort`] = z.enum(sortKeys).optional();
  }
  for (const filter of provider.filters) {
    shape[`${prefix}${filter.key}`] = z.string().trim().min(1).max(150).optional();
  }
  return z.object(shape);
}
