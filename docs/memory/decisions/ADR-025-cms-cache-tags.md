# ADR-025: CMS cache-tag vocabulary — extending the frozen list, and how filtered collections cache

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (extends `.claude/rules/architecture.md` #12's frozen tag
list; replaces v1 §7.3's tag matrix)
**Superseded by:** ADR-033 (in part — adds `style-preset:{id}`), ADR-029 (in part — adds `part-data:{key}` and exempts
global part data from the `content` tag; the rest of the matrix stands)

## Context

`.claude/rules/architecture.md` #12 declares the cache-tag vocabulary frozen
API: `theme`, `settings:{group}`, `navigation`, `rbac:{userId}`. In practice
the shipped code also uses `content` (all content invalidation), plus
`FEATURE_FLAGS_TAG` and `LOCALES_TAG`. ADR-004 fixed the mechanism: Cache
Components (`"use cache"` + `cacheTag()` + `cacheLife()`), `revalidateTag`
with its **mandatory** second argument, always called as
`revalidateTag(tag, { expire: 0 })` in this repo.

v1 §7.3 proposes a nine-row tag matrix and lists `articles`, `article:{id}`,
`category:{id}`, `tag:{id}` as "existing News queries (keep)". **Those tags
do not exist** — grep confirms every article mutation calls
`revalidateTag("content", { expire: 0 })`. v1 also specifies
`export const revalidate = 3600` and `generateStaticParams` in its
walkthrough, which is the legacy ISR path ADR-004 closed.

Two real problems need deciding, not just naming:

1. **Granularity.** Publishing one page must not flush every content read
   on the site. `content` alone cannot express that.
2. **Filtered collections.** A `COLLECTION` page reads `searchParams`, which
   makes the route dynamic per request, while its data reads want to be
   cached and tagged. `/news` already lives with this shape informally.

## Decision

### 1. Four new tags, and `content` stays

| Tag                         | Set by                          | Invalidated by                                       |
| --------------------------- | ------------------------------- | ---------------------------------------------------- |
| `page:{id}`                 | a page's render scope           | publish / unpublish / rollback of that page          |
| `page-path:{locale}:{path}` | the catch-all resolver's lookup | publish, slug change, redirect creation, delete      |
| `layout:{contentType}`      | a DETAIL page's layout read     | publish of that content type's DETAIL page           |
| `card-template:{id}`        | card-template resolution        | card template save (ADR-023)                         |
| `content` _(existing)_      | every provider data read        | any article/course/glossary mutation — **unchanged** |

Provider data reads keep using `content`, deliberately: the alternative
(per-item tags on every collection query) means a publish must know every
listing that might include the item, which is the over-invalidation problem
inverted. `content` is coarse, correct, and already tested. Page **layout**
reads get the fine-grained tags, because those are exactly the ones a
publish knows about.

`publishPage()` therefore calls, in order: write version → point
`publishedVersionId` → `recordAudit()` → `revalidateTag("page:{id}")`,
`revalidateTag("page-path:{locale}:{path}")` for every translation, plus
`layout:{contentType}` when the page is a DETAIL page. **Never
`revalidatePath("/")`** — v1's walkthrough does this and it flushes the
whole site.

### 2. Filtered collections: cached data inside a param-dynamic route

- The **page shell** (layout tree, card templates, static blocks) is read
  inside a `"use cache"` scope tagged `page:{id}` / `page-path:…`. Nothing
  about a search param enters that scope.
- **Provider reads are cached per resolved query**: the provider's `list()`
  runs inside a `"use cache"` scope whose cache key is the serialized,
  validated query object (contentType, filters, sort, page, locale, and the
  subject's visibility tier — never the raw `searchParams`), tagged
  `content` with `cacheLife({ revalidate: 300 })` to match the
  scheduled-publish window ADR-015 #6 established.
- The **unfiltered first page** of every COLLECTION page is the common case
  and stays fully cacheable; a filtered request pays a provider read and
  reuses the cached shell.
- **Visibility is part of the cache key, not a post-filter.** A logged-out
  and a staff request never share a cache entry for a query whose results
  differ by tier (ADR-012). A provider that filters after the cache boundary
  is a leak, and the conformance suite in ADR-022 probes for it.

### 3. `generateStaticParams` and `cacheLife`, not `export const revalidate`

The catch-all pre-generates published STATIC page paths;
DETAIL routes keep whatever `generateStaticParams` their content type
already has. Time-based freshness is expressed with `cacheLife()` inside the
cached scope, never with a route-level `revalidate` export — ADR-004's rule,
restated because v1 breaks it in three places.

## Consequences

- **`architecture.md` #12's list grows by four.** The rule file is updated
  in the same PR as this ADR, citing it. The names above are now frozen on
  the same terms as the originals: renaming one is an ADR, not a refactor.
- **A card-template edit invalidates only `card-template:{id}`**, so pages
  re-render their card region on next request while their data stays warm.
- **Coarse `content` means an article publish still re-renders listing data
  site-wide.** Accepted and measured: it is one tag, it is already the
  shipped behaviour, and Module 14's Lighthouse/`x-nextjs-cache` checks will
  show if it becomes a problem. Splitting it later is a contained change
  because every provider read goes through one helper.
- **Multi-instance hosting** still needs a shared cache handler for
  `revalidateTag` to propagate — unchanged from v1 §7.3's note, and it stays
  a deployment prerequisite recorded in the plan's risk table, not a code
  decision.

## Alternatives considered

- **v1's per-entity tags (`article:{id}`, `category:{id}`).** Rejected for
  MVP: they require the publish path to know every page that could show the
  item. The `content` tag already solves invalidation correctly, if bluntly.
- **Making COLLECTION routes fully dynamic.** Rejected: architecture.md #6
  forbids fixing a caching problem by making public routes dynamic, and the
  Lighthouse budget would notice.
- **Caching the whole page keyed by search params.** Rejected: the key space
  is unbounded (an attacker can mint infinite variants) and the shell
  duplicates per filter.
- **`unstable_cache` for the query-keyed reads** because it takes an
  explicit key array. Rejected: ADR-004 closed that path; `"use cache"`
  derives the key from the arguments, which is why the query object must be
  the validated, normalised one.

## Compliance

- Integration test: publish page A → `page:{A}` and its paths invalidate;
  assert page B's cached render is **not** flushed.
- Integration test: card-template edit propagates to two pages in one
  request cycle.
- Leak test: the same URL requested by a logged-out probe and a staff
  session returns different result sets for a `PREMIUM`-gated item, with no
  cross-contamination after either ordering (extends the Module 05 leak
  test's approach).
- Grep gate in review: no `revalidatePath(` and no `export const revalidate`
  under `apps/web/app/(public)`.
