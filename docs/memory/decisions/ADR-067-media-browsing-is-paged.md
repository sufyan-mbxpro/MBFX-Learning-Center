# ADR-067: Media browsing is a paginated `GET`; the unbounded read is deleted; usage counts are opt-in

**Status:** Accepted
**Date:** 2026-09-09
**Module:** 11 (content system / media), 09 (admin shell)
**Supersedes:** —
**Amends:** ADR-034 §5 (the library's read path), ADR-049 (the picker's data
source — the picker itself stands)
**Superseded by:** —

## Context

Every media read in the repository returns the entire library.
`listMediaAssets()` has no `take`, `skip` or cursor; it also runs a `groupBy`
over every returned id to compute a `usageCount` the picker never displays.
`/admin/media` serialises the whole result into an RSC payload on a
`force-dynamic` screen, and the picker fetches everything whenever its caller
allows more than one kind — which the lesson resources panel does.

Search compounds it: both surfaces filter client-side over the already-fetched
array. That is not merely slow, it is wrong the moment paging exists — search
could never find an asset the first fetch did not already return.

The owner's rule, given on review of changes-13 v1:

> **Never load the complete media library just because the media picker was
> opened. Every category/type change, search, or pagination action should make
> a small server request.**

A rule stated only in prose gets broken by the next person who needs "the whole
list, just this once". This ADR is about making it structural.

## Decision

### 1. The invariant, and its enforcement

**There is no unbounded read left to call.** `listMediaAssets()` returns a
page, never an array:

```ts
export interface ListMediaAssetsPage {
  items: MediaAssetRow[];
  nextCursor: string | null;
}
```

`limit` defaults to 48 and clamps to `[1, 100]`. There is no `limit: 0`, no
`Infinity`, no `all: true`, and no second "list everything" export beside it.
Every consumer — the picker, `/admin/media`, and the retained hidden Website
Builder picker (ADR-042) — gets a page or gets nothing. Nothing is exempt for
being hidden.

**The changed return type IS the enforcement**, not a side effect of it. A
future developer who wants the whole library has to change a signature and
defeat a test, which is the friction that makes an invariant hold. Three
guards, following the ADR-054 / ADR-057 pattern of a rule plus a test that
names its violation:

| Guard                                                                           | Where                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------ |
| `limit` clamps for `0`, negative, `Infinity`, `10_000`                          | `packages/core/src/media.test.ts`                |
| No exported core function returns a bare `MediaAssetRow[]`                      | `packages/core/src/media.test.ts` (source guard) |
| Opening the picker issues exactly one request, carrying `kind` and `limit ≤ 48` | `apps/web/.../media-picker-dialog.test.tsx`      |

### 2. Browsing is a `GET` route handler, not a server action

```
GET /admin/api/media?category=news&kind=IMAGE&q=chart&cursor=…&limit=48
                     [&include=facets,recent&sourceType=ARTICLE]
```

**One endpoint, not two.** The chrome a picker needs once on open — facet
counts and the recently-used strip — is requested through `include` on the
same call as the first page, so opening a picker is exactly one round trip.
A second endpoint would have made it two, which is a strange way to honour a
rule about not over-fetching. Every later request (tab, search, next page)
omits `include` and carries only rows.

Four reasons, in order of weight:

1. **Abortable.** Typing in search or flipping a kind tab must cancel the
   in-flight request. A server action's transport offers no `AbortController`
   seam; `fetch` does. This is the same reason `admin/api/uploads/*` exists
   beside `uploadMediaAction`.
2. **Not serialised.** Next queues server-action calls per client, so four tab
   clicks in a second become four sequential round-trips.
3. **Honest caching.** A `GET` can carry `Cache-Control: private, max-age=30`;
   a POST cannot.
4. **Shape.** It is a read. Server actions are this repo's mutation transport;
   every other admin read arrives through a server component. This is the first
   genuinely incremental read and it takes the read verb.

`requirePermission("media.view")` is still the first line, and search params are
parsed through `@repo/contracts` before use (security.md #6). This is a
**read**, so security.md #1's mutation rule is not what applies — but the gate
is identical to the one `listMediaAssetsAction` already ran, so no surface
loosens.

`listMediaAssetsAction` survives for the retained builder picker, and survives
**paged** — it returns `ListMediaAssetsPage`, because under §1 no signature in
this repo may claim to hand back "the list".

### 3. Keyset pagination on `(createdAt, id)`, not offset

The cursor is `base64("<createdAt ISO>|<id>")`. Offset paging double-shows and
skips rows when a row is inserted mid-scroll — which is exactly what an admin
uploading into the library they are scrolling produces. `createdAt` is not
unique under a fast batch upload, hence the `id` tiebreak.

### 4. `usageCount` is opt-in

`withUsage` defaults to `false`. The picker does not display usage and must not
pay a `groupBy` for it; `/admin/media`'s grid and `getMediaAssetDetail` opt in.
**The delete guard is untouched** — it queries `ContentReference` directly and
remains the boundary (ADR-034 §4). This changes what is _displayed_, never what
is _enforced_.

### 5. The picker's chrome, and what each control asks the server

```
[ Category ▼ ]   [ Images ][ Videos ][ Documents ][ Audio ]
Search media…
Recently Used   (absent when this source has no reference history)
Media Grid
[ Load More ]
```

Category and kind share **one row** — they are the same decision from two
sides, and stacking them reads as two filter bars, the shape code-style.md #9
already rejects on table screens. Search sits beneath because it is scoped _by_
them. Each control change is one request; nothing widens on its own.

- Default on open: the caller's category, `IMAGE`, first 48, newest first.
- Kind tabs offer only the kinds the caller's `kinds` prop allows; a
  single-kind caller renders no tab strip.
- The category dropdown is `AdminCombobox` (code-style.md #10) with a **named**
  "All categories" sentinel, never `""` — the reasoning ADR-065's "Both
  schools" option already established.
- Search is debounced 250 ms and **server-side**, which is a correctness fix,
  not a performance one.
- **`Load More` is a real button, and the `IntersectionObserver` is additive.**
  A scroll sentinel alone is unreachable by keyboard; the button is the
  accessible path and both call the same loader.
- `Recently Used` is **absent, not empty**, when there is no history — the same
  rule the public learn area's flag-off sections follow.

### 6. Caching is client-side, and touches no cache tag

The admin root layout is `force-dynamic` and these reads are permission-scoped,
so `"use cache"` is not available. A module-level `Map` keyed by
`category|kind|q`, 30 s TTL, cleared on any upload/replace/delete. **No new
cache tags and no `revalidateTag` involvement** — architecture.md #11–12 is
untouched, and the frozen tag list does not grow.

The picker dialog keeps its deliberate unmount-on-close reset; the cache lives
outside the component, so reopening mid-edit is instant without reintroducing
stale component state.

## Consequences

- **`listMediaAssets()`'s return type is a breaking change** for three call
  sites, all updated in the same landing. This is intended (§1).
- **A new `admin/api/media` surface exists.** It is inside the `(admin)` route
  group, so the proxy's STAFF gate covers it and the admin CSP applies; it
  re-checks `media.view` server-side regardless (security.md #3 — never assume
  the proxy ran).
- **Client-side search is deleted, not kept as a fallback.** Keeping both would
  mean a query that matches a loaded row behaves differently from one that does
  not.
- **Facets cost one extra `groupBy` per picker open** (client-cached 60 s).
  That is the price of showing counts and disabling empty categories, and it is
  one bounded aggregate against the unbounded row read it replaces.
- **changes-12 is unaffected and slightly helped**: it replaces the bytes
  layer, and a paged reader is what its `status`-column UI (M5, §5) needs
  anyway.

## Alternatives considered

- **Keep the server action and add `limit`.** Rejected — §2.1 and §2.2. An
  un-abortable, serialised transport turns fast tab-flipping into a queue of
  stale responses arriving in order.
- **Offset pagination.** Rejected — §3.
- **Cursor on `id` alone.** Rejected: `cuid()` is not time-ordered, so the page
  boundary would not match the display order.
- **Infinite scroll only.** Rejected — keyboard-unreachable (§5).
- **Keep `usageCount` always-on for simplicity.** Rejected: it is a `groupBy`
  per read for a number the hot path never renders.
- **A server-side cache keyed by permission subject.** Rejected: it would need
  a new cache tag on a `force-dynamic` surface, growing the frozen tag list
  (architecture.md #12) to save a query that is now bounded to 48 rows.

## Compliance

- `packages/core/src/media.test.ts` — the `limit` clamp, cursor
  encode/decode, and the source guard of §1.
- `packages/core/src/media.integration.test.ts` — a query matches a row on
  page 3; paging neither skips nor repeats when a row is inserted between
  pages; `withUsage: false` runs no `groupBy`; facets exclude soft-deleted
  rows.
- `apps/web/app/(admin)/admin/api/media/route.test.ts` — 403 without
  `media.view`; `limit=9999` clamps; `kind=EMBED` is a 400, not a cast.
- `media-picker-dialog.test.tsx` — one request on mount carrying `kind` and a
  bounded `limit`; chrome order; `Recently Used` absent without history;
  `DialogTitle` + `DialogDescription` both present (code-style.md #11).
