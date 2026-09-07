// Glossary provider (ADR-022 §2 composing `public-content.ts`, never
// re-deriving the PUBLISHED/not-deleted rule it already enforces).
//
// Named, honest gap: `loadPublishedGlossary` has no server-side pagination,
// search or filtering — it returns the whole A–Z list, because nothing has
// ever needed less. `list()` below applies `q`/page/limit **in application
// code, over an already visibility-scoped result** — this is not the
// "provider re-derives the where clause" failure ADR-022 §2 warns about
// (the where clause, PUBLISHED-and-not-deleted, is still the service's
// alone); it is filtering/paging a small, already-fetched, already-safe
// list. No `category` filter is offered: `GlossaryTerm.category` is a
// free-text column with no taxonomy, admin UI or facet counts behind it —
// inventing a filter over it would be UI for data nobody curates yet.
import {
  COLLECTION_LIMIT_MAX,
  type CollectionListResult,
  type CollectionProvider,
  type DetailItem,
  type SortDescriptor,
} from "@repo/contracts";
import { glossaryTermPath } from "../../content.ts";
import {
  getGlossaryTermBySlug,
  getPublishedGlossary,
  type GlossaryListEntry,
} from "../../public-content.ts";
import { getDefaultLocale } from "../paths.ts";

const SORTS: SortDescriptor[] = [{ key: "az", labelKey: "cms.providers.glossary.sorts.az" }];

function toCollectionItem(entry: GlossaryListEntry, locale: string, defaultLocale: string) {
  return {
    id: entry.termId,
    slug: entry.slug,
    title: entry.term,
    href: glossaryTermPath(locale, defaultLocale, entry.slug),
  };
}

export const glossaryProvider: CollectionProvider = {
  key: "glossary",
  labelKey: "cms.providers.glossary.label",
  filters: [],
  sorts: SORTS,

  async list(query, ctx): Promise<CollectionListResult> {
    const [all, defaultLocale] = await Promise.all([
      getPublishedGlossary(ctx.locale),
      getDefaultLocale(),
    ]);
    const q = query.q?.toLowerCase();
    const filtered = q ? all.filter((entry) => entry.term.toLowerCase().includes(q)) : all;
    const limit = Math.min(query.limit, COLLECTION_LIMIT_MAX);
    const start = query.page * limit;
    const page = filtered.slice(start, start + limit);
    return {
      items: page.map((entry) => toCollectionItem(entry, ctx.locale, defaultLocale)),
      total: filtered.length,
      page: query.page,
      limit,
    };
  },

  async bySlug(slug, ctx): Promise<DetailItem | null> {
    const view = await getGlossaryTermBySlug(ctx.locale, slug);
    // ADR-007: a term that exists but has no translation through the
    // fallback chain for this locale is "not available here", not
    // fallback-language content mislabeled as this locale's own.
    if (!view || view.requestedLocaleMissing) return null;
    const defaultLocale = await getDefaultLocale();
    return {
      id: view.termId,
      slug: view.slug,
      title: view.term,
      excerpt: view.simpleExplanation,
      href: glossaryTermPath(ctx.locale, defaultLocale, view.slug),
      body: view.detailedExplanation,
      seoTitle: view.seoTitle,
      seoDescription: view.seoDescription,
    };
  },
};
