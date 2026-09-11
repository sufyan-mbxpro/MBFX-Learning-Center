# changes-13 — plan: the media browser (categories, paged loading, on-demand kinds)

**Version 2** (2026-09-09) — owner reviewed v1 and accepted it, with one
addition and two confirmations. All three are adopted: the "never load the whole
library" rule is promoted to the plan's enforced invariant (§0), the picker's
chrome is pinned to the owner's layout (§0.1), and folder-as-category /
kind-as-type is recorded as settled rather than assumed (§0.2). The open
question in §8 #1 is closed.
**Status:** **shipped 2026-09-09.** ADR-066 and ADR-067 written and accepted;
PRs 1–6 landed, plus §9 #6 (`Content-Disposition` for documents), which v2 had
named and left unscheduled. Still owed: `media.integration.test.ts` on a machine
with a container runtime (there is none here), E2E to Module 14, and §9 #7–9,
which stay deliberately unscheduled. See the 2026-09-09 DEVLOG entry.
**One deviation from §5, recorded here rather than in an ADR** — PR 3's separate
`api/media/facets/route.ts` was not built. Facets and the recently-used strip
are folded into the first page's response as `include=facets,recent`, which is
§0's "opening a picker costs one round trip" honoured more exactly than a second
endpoint would have. The behaviour ADR-067 records is unchanged.
**Date:** 2026-09-09
**Modules:** 11 (content/media) and 09 (admin shell), on the existing local-disk
`StorageDriver`.
**Relationship to changes-12:** strictly complementary and strictly upstream of
it. changes-12 replaces the _bytes_ layer (object storage, queue, FFmpeg, CDN,
derivatives). This document replaces the _query and selection_ layer. Nothing
here creates work changes-12 has to undo; §4 names every boundary.
**Relationship to ADR-034:** extends §5's library scope. `folder`-as-path
(§2) is **not** revisited — it is the mechanism this plan builds on.

> **One asset list is not a page. The picker must ask the server a narrow
> question and get a small answer back, and every widening of that question
> must be a new request the admin asked for.**

Everything below follows from that sentence.

---

## 0. The invariant, and how it is enforced ⟶ ADR-067

**Owner, 2026-09-09, reviewing v1 — binding:**

> **Never load the complete media library just because the media picker was
> opened. Every category/type change, search, or pagination action makes a
> small server request.**

This is the plan's one non-negotiable, and it is **enforced structurally, not
by discipline**. The mechanism:

**There is no unbounded read left to call.** `listMediaAssets()` takes a
`limit` that defaults to 48 and clamps at 100. There is no `limit: 0`, no
`limit: Infinity`, no `all: true` escape hatch, and none is added later
without superseding ADR-067. Every consumer — the picker, `/admin/media`, the
retained Website Builder picker — gets a page or gets nothing. A future
developer who wants the whole library has to change the signature and defeat a
test to do it, which is exactly the friction that makes an invariant hold.

Three guards, all in PR 2–4:

| Guard                      | Where                                            | What it fails on                                                                                           |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `limit` clamp              | `packages/core/src/media.test.ts`                | `limit: 0`, negative, `Infinity`, `10_000` — each resolves to a bounded page                               |
| One narrow request on open | `media-picker-dialog.test.tsx`                   | More than one request on mount, or a request whose URL lacks `kind` or carries `limit > 48`                |
| No unbounded path exists   | `packages/core/src/media.test.ts` (source guard) | Any exported core function returning `MediaAssetRow[]` rather than a page — the shape _is_ the enforcement |

This follows the repo's established pattern for a rule the owner asks for: a
decision recorded in an ADR, the behaviour made structural, and a test that
names the violation (ADR-054's `type-scale.test.ts` and ADR-057's
`admin-dialog-conventions.test.ts` are the precedents).

### 0.1 — The picker's chrome, in this order

Owner-specified layout, v2. Pinned here because "which control is where" is
what makes the invariant legible to the admin — each row is one axis of the
narrow question:

```
Choose Media
┌──────────────────────────────────────────────────────────┐
│ [ Category ▼ ]   [ Images ][ Videos ][ Documents ][ Audio ]│
│                                                            │
│ Search media…                                              │
│                                                            │
│ Recently Used                              (optional)      │
│ ▢ ▢ ▢ ▢ ▢ ▢                                                │
│                                                            │
│ Media Grid                                                 │
│ ▢ ▢ ▢ ▢ ▢ ▢                                                │
│ ▢ ▢ ▢ ▢ ▢ ▢                                                │
│                                                            │
│                    [ Load More ]                           │
└──────────────────────────────────────────────────────────┘
```

Category and kind share **one row** — they are the same decision seen from two
sides, and stacking them would read as two filter bars (the shape code-style.md
#9 already rejects on table screens). Search sits beneath them because it is
scoped _by_ them. `Recently Used` is `(optional)` in the literal sense: the
strip is **absent**, not empty, when this source has no reference history — the
same "a flag-off section is absent, not disabled" rule the public learn area
already follows.

`Load More` is a real button, not only a scroll sentinel — see D9.

### 0.2 — Category lives in `folder`; type lives in `kind`. No physical folders per type.

Owner-confirmed, v2. There is **no** `/news/images`, `/news/videos` directory
structure — the category is the `folder` path, the type is the `kind` column,
and the two compose in the query. The brief's "inside each category, organised
by type" is delivered as a **filter pair**, not as a directory tree.

This is the difference between a UI grouping and a storage layout. A stored
per-type folder would make "show me everything in News" a four-prefix query,
make moving an asset between types conceivable (it is not — `kind` comes from
magic bytes and `replaceMedia` refuses a kind change), and hand a future admin
a folder tree to mismanage. `@@index([folder, kind, createdAt])` (D8) serves
the composed query in one seek either way.

---

## 1. What is actually slow (verified against the repo, 2026-09-09)

| #   | Finding                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`listMediaAssets()` has no `take`, `skip` or cursor.** Every call returns every non-deleted row.                                                                                                                                                            | [media.ts:489-521](packages/core/src/media.ts#L489-L521)                                                                                                                                                                   |
| 2   | **Every call also runs a `groupBy` over every returned id** to compute `usageCount`, which the picker never displays.                                                                                                                                         | [media.ts:481-488](packages/core/src/media.ts#L481-L488)                                                                                                                                                                   |
| 3   | **`/admin/media` serialises the entire library into the RSC payload** on every navigation — the screen is `force-dynamic`, so this is not cached.                                                                                                             | [media/page.tsx:14](<apps/web/app/(admin)/admin/media/page.tsx#L14>)                                                                                                                                                       |
| 4   | **The picker fetches the whole library whenever a caller allows more than one kind.** `singleKind` is `undefined` unless `kinds.length === 1`, and the lesson resources panel passes all four.                                                                | [media-picker-dialog.tsx:158-176](<apps/web/app/(admin)/admin/_components/media-picker-dialog.tsx#L158-L176>), [resources-panel.tsx:268](<apps/web/app/(admin)/admin/learn/lessons/[id]/_panels/resources-panel.tsx#L268>) |
| 5   | **Search is client-side over the already-fetched array** — so it is not only slow, it is _wrong_: it can never find an asset the first fetch did not already return. Once pagination lands, this becomes a correctness bug, not a preference.                 | [media-picker-dialog.tsx:178-192](<apps/web/app/(admin)/admin/_components/media-picker-dialog.tsx#L178-L192>), [media-library.tsx](<apps/web/app/(admin)/admin/_components/media-library.tsx>)                             |
| 6   | **`folder` exists, is indexed, and is never filtered on.** `@@index([kind, folder])` is already in the schema; `listMediaAssets` accepts no folder argument, and nothing writes anything but the `"/"` default except free text typed into the detail dialog. | [schema.prisma:547-555](packages/db/prisma/schema.prisma#L547-L555)                                                                                                                                                        |
| 7   | **`width`/`height` are declared and never populated.** So every tile renders without intrinsic dimensions and `next/image` cannot emit a correct `srcset` candidate set.                                                                                      | [schema.prisma:536-537](packages/db/prisma/schema.prisma#L536-L537); no writer anywhere in `packages/core/src/media.ts`                                                                                                    |
| 8   | **`readStoredFile()` reads the whole object into memory even to answer a `Range` request** — a seek into a 100 MB video allocates 100 MB, then slices.                                                                                                        | [media.ts:404-412](packages/core/src/media.ts#L404-L412) and [uploads/[file]/route.ts](apps/web/app/uploads/[file]/route.ts)                                                                                               |
| 9   | The existing index `@@index([kind, folder])` is in the **wrong column order** for the query this plan makes dominant (`folder` prefix → `kind` → `createdAt desc`).                                                                                           | schema.prisma:555                                                                                                                                                                                                          |

**Scale estimate, not a measurement.** A `MediaAssetRow` serialises to roughly
350 bytes. At 5,000 assets that is a ~1.7 MB action payload, a `groupBy`
returning up to 5,000 rows, and 5,000 `<Image>` elements mounted in one grid —
per picker open. At 48 rows a page it is ~17 KB and 48 elements.

---

## 2. Two corrections to the brief

Both are in the owner's favour — they mean less work, not more.

**2.1 — Thumbnails are already generated; originals are not being loaded.**
The brief asks to "generate optimized thumbnails instead of loading original
files". Both grids already render through `next/image` with `fill` +
`sizes="160px"` / `"200px"` and no `unoptimized` prop, so Next's optimizer
serves a re-encoded ~160px WebP/AVIF, not the original. Lazy loading is also
already on — `next/image` defaults to `loading="lazy"`.

What is _actually_ expensive is the **origin** the optimizer fetches from:
`/uploads/[file]` is a route handler that does a `mediaAsset.findUnique` and
reads the entire file into memory per cold optimizer miss (finding 8). And
there are still no stored derivatives, so the optimizer's cache is the only
thing standing between the grid and a full re-encode.

**Consequence for sequencing:** persistent derivatives are worth real money at
changes-12 M7 scale, but they are the _second_-order win here. At 48 tiles a
page, payload and element count dominate encode cost. This plan therefore
builds the **seam** for derivatives (D6) and lets changes-12 M7 fill it, rather
than standing up a second variant pipeline that M7 would delete.

**2.2 — "Category" already has a home, and it is not `purpose`.**
`MediaAsset.purpose` (`brand | setting | article | content`) looks like the
taxonomy the brief wants. It is not: it is the input to the **permission gate**
([media-actions.ts:36-46](<apps/web/app/(admin)/admin/_actions/media-actions.ts#L36-L46>)),
and widening it into a display taxonomy would couple "which folder is this in"
to "who may upload it". `folder` is the correct column, ADR-034 §2 settled it as
a path string precisely so this is one column and no joins, and changes-12 M6
re-affirmed that no `media_folders` table is created.

---

## 3. Decisions

### D1 — A category is the first segment of `folder`, from a code registry ⟶ ADR-066

```ts
// packages/contracts/src/media.ts
export const MEDIA_CATEGORIES = ["news", "learn", "brand", "general"] as const;
export const mediaCategorySchema = z.enum(MEDIA_CATEGORIES);
export type MediaCategory = z.infer<typeof mediaCategorySchema>;

/** `/news` or `/news/2026-covers` — first segment must be a registered category. */
export const mediaFolderSchema = z
  .string()
  .trim()
  .regex(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/)
  .refine((v) => MEDIA_CATEGORIES.includes(v.split("/")[1] as MediaCategory));
```

- **A registry, not a table.** This is the settled design philosophy (ADR-042:
  structure is code, content data is dynamic) and the ADR-048 precedent (the
  mega-menu's composition is a code registry; the database owns the items).
  Adding a category is a two-line change plus a catalog key.
- **No raw identifier renders** (code-style.md #5): each key gets an
  `admin.mediaCategory.*` catalog string. `humanizeKey()` is the fallback only
  if a key ever reaches the UI unregistered.
- **Sub-folders survive.** `/news/2026-covers` is legal; only the first segment
  is constrained. The detail dialog keeps a free-text sub-path field beneath the
  category dropdown.
- **`"/"` is not legal after this lands.** Pre-launch policy is reset, not
  backfill (plan §5.2) — `pnpm db:reset` + seed, and the schema default becomes
  `"/general"`.

### D2 — Every upload declares its category ⟶ ADR-066

`storeMedia`/`storeImage` gain a required `category: MediaCategory`, written as
`folder: "/" + category` unless an explicit `folder` is supplied. The upload
routes read it from the `FormData`, Zod-parse it, and **never** infer it from
`purpose` — an article's header image and an article's inline diagram are both
`purpose: "article"` but may sit in different folders.

Every picker call site already knows its category statically:

| Call site                                              | Category                                                |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `image-upload-field.tsx` (article header, cover slots) | from a new required `category` prop                     |
| `rich-text-editor.tsx` in-body image                   | prop, threaded from the editor's host                   |
| `resources-panel.tsx` (lesson attachments)             | `"learn"`                                               |
| Theme editor logos/favicons                            | `"brand"`                                               |
| `/admin/media` upload button                           | the currently selected category, `"general"` when "All" |

### D3 — Browsing is a paginated `GET` route handler, not a server action ⟶ ADR-067

```
GET /admin/api/media?category=news&kind=IMAGE&q=chart&cursor=…&limit=48
GET /admin/api/media/facets            → counts per (category, kind)
```

Four reasons a route handler and not the existing `listMediaAssetsAction`:

1. **Abortable.** Typing in the search box or flipping a tab must cancel the
   in-flight request. A server action's transport gives no `AbortController`
   seam; `fetch` does. This is the same reason `api/uploads/*` exists instead of
   the upload action ([that folder's own header comment](<apps/web/app/(admin)/admin/api/uploads/media/route.ts>)).
2. **Not serialised.** Next queues server-action calls per client; four tab
   clicks in a second become four sequential round-trips.
3. **HTTP semantics.** A `GET` can carry `Cache-Control: private, max-age=30`
   honestly; a POST cannot.
4. **Shape.** It is a read. Server actions are the mutation transport in this
   repo; every existing read on an admin screen comes through a server
   component. This is the first genuinely incremental read, and it deserves the
   read verb.

`requirePermission("media.view")` is still the first line, and search params are
parsed through `@repo/contracts` before use (security.md #6). **The existing
`listMediaAssetsAction` stays** as a thin first-page wrapper — returning the
same `ListMediaAssetsPage`, not an array, because under §0 no signature in this
repo may claim to hand back "the list" — so the retained, hidden Website Builder
picker
([website/pages/[id]/builder/_builder/media-picker.tsx](<apps/web/app/(admin)/admin/website/pages/[id]/builder/_builder/media-picker.tsx>))
keeps compiling — ADR-042 retains that code, it does not get to rot.

### D4 — Keyset pagination on `(createdAt, id)`, not offset ⟶ ADR-067

```ts
export interface ListMediaAssetsPage {
  items: MediaAssetRow[];
  nextCursor: string | null; // base64 `${createdAt.toISOString()}|${id}`
}

export async function listMediaAssets(filter?: {
  category?: MediaCategory;
  folder?: string; // exact folder, or prefix when `folderPrefix` is set
  kinds?: MediaKind[]; // plural: the picker's `kinds` prop maps 1:1
  query?: string;
  tag?: string;
  cursor?: string;
  limit?: number; // default 48, max 100
  withUsage?: boolean; // default false — see D5
}): Promise<ListMediaAssetsPage>;
```

Offset pagination double-shows and skips rows when an upload lands mid-scroll,
which is exactly what happens while an admin is uploading into the library they
are scrolling. Keyset does not. `createdAt` is not unique under a fast batch
upload, hence the `id` tiebreak.

**Breaking change, deliberately:** the return type changes from `MediaAssetRow[]`
to a page object. Three call sites, all updated in the same PR.

### D5 — `usageCount` is opt-in ⟶ ADR-067

The picker does not show usage and must not pay for it. `withUsage: true` only
for `/admin/media`'s grid and `getMediaAssetDetail`. The delete guard is
unaffected — it queries `ContentReference` directly
([media.ts:697-704](packages/core/src/media.ts#L697-L704)) and remains the
boundary.

### D6 — `thumbnailUrl` is a field on the row today, a derivative tomorrow

`MediaAssetRow` gains `thumbnailUrl: string`, resolved in `@repo/core` by a
single function:

```ts
// packages/core/src/media.ts
export function resolveThumbnailUrl(row: { url: string; kind: MediaKind }): string {
  return row.kind === "IMAGE" ? row.url : ""; // changes-12 M7 returns the `thumb` derivative
}
```

Every grid reads `asset.thumbnailUrl`, never `asset.url`, for its tile. When
changes-12 M7 lands, one function body changes and no UI moves. This is the
`StorageDriver` lesson applied to derivatives — build the seam before the
implementation.

### D7 — Dimensions are recorded at upload

A ~50-line pure header parser in `@repo/core` (`readImageDimensions(bytes)`)
covering PNG (IHDR), JPEG (SOFn scan), GIF (logical screen descriptor), WebP
(VP8/VP8L/VP8X) and SVG (`viewBox`/`width`+`height`). No new dependency; `sharp`
is not pulled in for a job the first 32 bytes answer. Populates the existing,
unused `width`/`height` columns, which:

- lets `next/image` size the tile without layout shift,
- lets the optimizer choose a sane `srcset` candidate,
- gives the detail dialog something true to show,
- and gives changes-12 M7 the "no upscaling" input it needs (its `thumb`/`card`
  profile choice is a function of the long edge).

An unrecognised container simply leaves both null — never an upload failure.

### D8 — Indexes match the queries this plan creates

```prisma
// replaces @@index([kind, folder])
@@index([folder, kind, createdAt])
@@index([deletedAt, createdAt])
```

Pre-launch policy: reset, not backfill.

### D9 — The picker opens narrow and widens only on request

The chrome and its order are fixed by §0.1; this is what each control _does_.
Default state on open: **the caller's category, `IMAGE`, first 48, newest
first** — one request, and §0's guard fails the build if it is ever two. Then:

- **Kind tabs** — only the kinds the caller's `kinds` prop allows. One tab
  change = one request. A caller passing a single kind renders no tab strip.
- **Category dropdown** — `AdminCombobox` (code-style.md #10 makes this
  structural, not a preference), options = registered categories + an
  "All categories" sentinel. A named sentinel, not `""` — the same reasoning the
  glossary's "Both schools" option already uses.
- **Facet counts** on both, from `GET /admin/api/media/facets` (one `groupBy`,
  client-cached 60 s). A category with zero assets in the current kind is
  rendered disabled rather than hidden, so the library's shape stays legible.
- **Search** — 250 ms debounced, server-side, scoped to the current
  category/kind. Fixes finding 5.
- **Infinite scroll _and_ a "Load more" button.** An `IntersectionObserver`
  sentinel alone is unreachable by keyboard and by screen-reader users who never
  scroll the container; the button is the accessible path and the observer is
  the convenience. Both call the same loader.
- **A "Recently used" strip** above the grid: the last 12 assets referenced by
  this `sourceType`, from `ContentReference` ordered by `createdAt desc`. Most
  picks are re-picks of something placed minutes ago, and this makes the common
  case a zero-scroll case.
- **Keyboard-first**: focus lands in search on open; arrow keys move a roving
  `tabindex` across the grid; Enter selects.

### D10 — A short-lived client cache, not a server cache

The admin root layout is `force-dynamic` and these reads are
permission-scoped, so `"use cache"` is not available (architecture.md #11-12 is
untouched — **no new cache tags, no `revalidateTag` involvement**). Instead a
module-level `Map` keyed by `category|kind|q`, 30 s TTL, cleared on any upload,
replace or delete. The dialog keeps its deliberate unmount-on-close reset
(that comment in `media-picker-dialog.tsx` is right and stays); the cache lives
outside the component, so reopening the picker mid-edit is instant.

---

## 4. What this plan does **not** build

Every item below is changes-12's, and building any of it here creates work that
programme has to undo:

- Object storage, presigned/resumable upload, CDN, CSP change (M1, M2, M11)
- BullMQ, `apps/worker`, job state, reconciler (M3, M14)
- Generated derivatives, AVIF/WebP profiles, `MediaDerivative`, the custom
  `next/image` loader (M7)
- Video transcoding, HLS, posters (M8)
- Checksum deduplication (M12), antivirus (M13), processing dashboard (M10)

And, independently deferred:

- A folder **tree** UI with drag-to-move (ADR-034 §5 already defers it; the
  category dropdown + sub-path field is the flat form of the same data)
- **Physical per-type folders** (`/news/images`, `/news/videos`, …).
  **Rejected, not deferred** — §0.2. `kind` is already the type axis, and it is
  derived from magic bytes; duplicating it into the storage path would create a
  second source of truth that `replaceMedia` would have to keep in sync for a
  kind change it explicitly refuses.
- Bulk select / bulk move / bulk delete
- Tag autocomplete (tags stay JSON, filtered in memory per page — ADR-034
  Consequences, unchanged)
- Client-side image downscaling before upload. **Rejected, not deferred:** it
  silently degrades what the admin chose to upload, and the original is the one
  thing changes-12 M7 wants to keep in `originals/`.

---

## 5. PRs

### PR 1 — Contracts: the category registry

**Files**

- `packages/contracts/src/media.ts` — `MEDIA_CATEGORIES`, `mediaCategorySchema`,
  `mediaFolderSchema`; `listMediaAssetsQuerySchema` gains
  `category`, `kinds` (array), `tag`, `cursor`, `limit`; `updateMediaMetaSchema`'s
  `folder` switches to `mediaFolderSchema`.
- `packages/contracts/src/media.test.ts` — new cases.
- `packages/i18n/messages/en.json` — `admin.mediaCategory.{news,learn,brand,general}`,
  `admin.mediaCategoryAll`, `admin.mediaLoadMore`, `admin.mediaRecentlyUsed`,
  `admin.mediaCategoryLabel`, `admin.mediaSubfolderLabel`. Admin namespace ⇒
  `en.json` only (ADR-043 #2).

**Tests** — every registered category parses; `/` and `/unknown/x` are rejected;
`/news/2026-covers` accepted; `limit` clamps at 100; a `kinds` array of one
behaves as the old `kind`.

### PR 2 — Core: paged query, dimensions, indexes

**Files**

- `packages/db/prisma/schema.prisma` — index swap (D8); `folder` default
  `"/general"`.
- `packages/db/prisma/seed.ts` — seeded media rows (if any) land in a category.
- `packages/core/src/media.ts`
  - `listMediaAssets(filter) → ListMediaAssetsPage` (D4)
  - `getMediaFacets(): Promise<Record<MediaCategory, Record<MediaKind, number>>>`
  - `resolveThumbnailUrl(row)` (D6)
  - `readImageDimensions(bytes): { width: number; height: number } | null` (D7)
  - `storeMedia`/`storeImage` gain `category`, write `width`/`height`
  - `usageCountsByAssetId` called only when `withUsage`
- `packages/core/src/media.test.ts` — `readImageDimensions` unit cases, cursor
  encode/decode, `resolveThumbnailUrl`.
- `packages/core/src/media.integration.test.ts` — pagination, category filter,
  facets, `withUsage` off/on.

**Signature change is breaking on purpose** (D4); PR 3 and PR 5 update the three
callers in the same landing.

### PR 3 — The admin media API

**Files**

- `apps/web/app/(admin)/admin/api/media/route.ts` — `GET`, `requirePermission("media.view")`,
  `listMediaAssetsQuerySchema.parse(Object.fromEntries(searchParams))`,
  `Cache-Control: private, max-age=30`.
- `apps/web/app/(admin)/admin/api/media/facets/route.ts` — `GET`, same gate.
- `apps/web/app/(admin)/admin/api/media/route.test.ts` — gate, parse, shape.
- `apps/web/app/(admin)/admin/_actions/media-actions.ts` — `listMediaAssetsAction`
  becomes a first-page wrapper returning `ListMediaAssetsPage` (D3); upload
  actions/routes accept `category`.
- `apps/web/app/(admin)/admin/website/pages/[id]/builder/_builder/media-picker.tsx`
  — retained hidden code, one line: reads `.items` off the page. It gets the
  invariant too; nothing is exempt from §0 for being hidden.
- `apps/web/app/(admin)/admin/api/uploads/{image,media,media/[id]}/route.ts` —
  read and parse `category` from the `FormData`.

### PR 4 — The picker

**Files**

- `apps/web/app/(admin)/admin/_hooks/use-media-browser.ts` — **new.**
  `useMediaBrowser({ category, kind, kinds, query })` → `{ items, facets,
loading, error, hasMore, loadMore, reset }`; owns fetch, abort, debounce,
  the D10 cache, and cache-busting on upload/delete.
- `apps/web/app/(admin)/admin/_components/media-picker-dialog.tsx` — rebuilt
  around the hook: category combobox, kind tabs, server search, recently-used
  strip, `IntersectionObserver` + Load more, roving-tabindex grid,
  `thumbnailUrl` tiles with real `width`/`height`. New required prop `category`.
- `apps/web/app/(admin)/admin/_components/image-upload-field.tsx`,
  `rich-text-editor.tsx`, `learn/lessons/[id]/_panels/resources-panel.tsx`, and
  the theme editor's logo fields — thread `category` (D2 table).
- `apps/web/app/(admin)/admin/_components/media-picker-dialog.test.tsx` — **new.**

Modal conventions unchanged and re-asserted: `DialogTitle` + `DialogDescription`
both present (code-style.md #11, guarded by
`apps/web/app/admin-dialog-conventions.test.ts`).

### PR 5 — The library screen

**Files**

- `apps/web/app/(admin)/admin/media/page.tsx` — server component renders the
  **first page only** plus facets; passes them as the hook's initial state.
- `apps/web/app/(admin)/admin/_components/media-library.tsx` — same hook;
  category filter and kind tabs join the existing toolbar row (code-style.md #9
  — one filter row, not a stacked bar); detail dialog's free-text `folder` field
  becomes `AdminCombobox` (category) + a sub-path input.
- `apps/web/app/(admin)/admin/website/media/page.tsx` — retained hidden screen,
  updated to the new signature (ADR-042: retained code compiles).

### PR 6 — Upload throughput and range serving

**Files**

- `apps/web/app/(admin)/admin/_hooks/use-upload-progress.ts` — a queue:
  multi-file select, per-file progress, concurrency 2, one failure does not
  cancel the batch.
- `apps/web/app/(admin)/admin/_components/upload-progress.tsx` — per-file rows.
- `packages/core/src/media.ts` — `StorageDriver` gains optional
  `getRange(key, start, end): Promise<Uint8Array | null>`; `createLocalDiskStorage`
  implements it with a positional read; `readStoredFile` gains a range-aware
  sibling. **Additive** — changes-12 M2's S3 driver implements it as a native
  Range GET, and a driver without it falls back to today's whole-file read.
- `apps/web/app/uploads/[file]/route.ts` — uses it (finding 8).
- `apps/web/app/uploads/[file]/route.test.ts` — asserts the whole object is
  never materialised for a partial request.

---

## 6. Criterion → test

| Criterion                                                                                                          | Test                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **§0 — no unbounded read exists.** No exported core function returns a bare `MediaAssetRow[]`                      | `packages/core/src/media.test.ts` source guard                              |
| **§0 — `limit` is always bounded.** `0`, negative, `Infinity`, `10_000` each resolve to a page                     | `packages/core/src/media.test.ts`                                           |
| **§0 — opening the picker issues exactly one request**, carrying `kind` and `limit ≤ 48`                           | `media-picker-dialog.test.tsx`                                              |
| **§0.1 — chrome order**: category + kinds share one row, search below, Load More present                           | source guard in `media-picker-dialog.test.tsx`                              |
| **§0.1 — `Recently Used` is absent, not empty**, with no reference history                                         | `media-picker-dialog.test.tsx`                                              |
| **§0.2 — no folder segment is ever a kind name** (`images`, `videos`, `audio`, `documents` rejected as a sub-path) | `packages/contracts/src/media.test.ts`                                      |
| Opening a picker requests one category, one kind, ≤ 48 rows                                                        | `media-picker-dialog.test.tsx` — asserts the request URL on mount           |
| Changing kind issues exactly one new request and aborts any in flight                                              | `use-media-browser` test with a stubbed `fetch` + abort spy                 |
| Search finds an asset that is not on the first page                                                                | `media.integration.test.ts` — 60 rows, query matches row 55                 |
| Pagination neither skips nor repeats when a row is inserted mid-scroll                                             | `media.integration.test.ts` — page 1, insert, page 2                        |
| `usageCount` costs no query when not requested                                                                     | `media.integration.test.ts` — Prisma query spy asserts no `groupBy`         |
| A folder outside the registry is refused                                                                           | `packages/contracts/src/media.test.ts`                                      |
| Upload writes the caller's category                                                                                | `media.integration.test.ts`                                                 |
| `width`/`height` are populated for each supported container                                                        | `packages/core/src/media.test.ts`, fixture bytes per format                 |
| An unrecognised container uploads fine with null dimensions                                                        | same file                                                                   |
| `GET /admin/api/media` 403s without `media.view`                                                                   | `api/media/route.test.ts`                                                   |
| Search params are parsed, never cast                                                                               | `api/media/route.test.ts` — `limit=9999` clamps, `kind=EMBED` 400s          |
| Facets reflect only non-deleted rows                                                                               | `media.integration.test.ts`                                                 |
| Every grid tile reads `thumbnailUrl`                                                                               | source guard in `media-picker-dialog.test.tsx` (apps/web vitest has no DOM) |
| A partial request never reads the whole object                                                                     | `uploads/[file]/route.test.ts` with a spying driver                         |
| Picker dialog renders title **and** description                                                                    | existing `admin-dialog-conventions.test.ts`                                 |
| Category labels never render a raw key                                                                             | catalog-key assertion in the picker test                                    |
| Admin catalog completeness unaffected                                                                              | `pnpm check:catalog-completeness`                                           |

Plus the standing gate: `pnpm lint` → `pnpm typecheck` → per-package tests →
dev-server verification (root `pnpm test`/`pnpm build` are unreliable on this
machine).

---

## 7. ADRs to write before any code

ADR numbers **059–062 are reserved** by changes-12 §6 Phase M0 and must not be
taken. Next free: **066**.

- **ADR-066 — Media categories are the first segment of `folder`, from a code
  registry.** Records: why not `purpose`; why a registry and not a table
  (ADR-042/ADR-048 precedent); why `folder`-as-path (ADR-034 §2) is extended
  rather than replaced; the reset-not-backfill migration; how a category is
  added.
- **ADR-067 — Media browsing is a paginated `GET`; the unbounded read is
  deleted; usage counts are opt-in.** Records, in this order: **the owner's §0
  invariant and its three structural guards** (this is the load-bearing half —
  the rest is how it is achieved); the four reasons for a route handler over the
  server action; keyset over offset; the breaking return-type change _as the
  enforcement mechanism_, not merely a consequence; the client-cache boundary
  (no new cache tags, architecture.md #12 untouched); why
  `listMediaAssetsAction` survives, and why it survives **paged**.

Both ADRs carry §0.1's chrome and §0.2's folder/kind split — ADR-066 owns the
storage question (§0.2), ADR-067 owns the loading question (§0, §0.1). A future
change to either is a superseding ADR, not an edit.

DEVLOG entry after each PR, per the governance loop.

---

## 8. Risks and open questions for the owner

1. ~~**Category list.**~~ **Closed, v2** — owner confirmed
   `news | learn | brand | general`. `learn` stays one category covering
   courses, lessons and quizzes; a sub-path (`/learn/course-covers`) is the
   escape hatch if they ever need separating, and needs no ADR.
2. **Reset required.** D1 and D8 both need `pnpm db:reset`. Consistent with the
   stated pre-launch policy, but it does mean re-seeding dev databases.
3. **`image-upload-field.tsx` gains a required prop**, so every existing call
   site is touched. Making it optional with a `"general"` default would avoid
   the churn and quietly send half the library to the wrong folder — the churn
   is the point.
4. **The `folder` free-text field disappears** from the detail dialog, replaced
   by a dropdown plus a sub-path input. Any folder an admin has already typed
   that is not under a registered category is invalid after the reset.
5. **This plan assumes changes-12 still lands.** If it does not, D6's
   `resolveThumbnailUrl` stays an identity function forever and stored
   derivatives never arrive — at which point a small `sharp`-on-upload `thumb`
   profile becomes worth its own ADR. `sharp` is already allow-listed in
   `pnpm-workspace.yaml` for exactly this.

---

## 9. Beyond the brief — ranked by value per unit of cost

Ideas 1–5 are folded into the PRs above; 6–9 are named and **not** scheduled.

| #   | Idea                                                          | Where  | Why it earns its place                                                                                                                                                                    |
| --- | ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Drop the unused `usageCount` `groupBy` from picker reads (D5) | PR 2   | One line of condition; removes a whole query from the hot path                                                                                                                            |
| 2   | Populate `width`/`height` (D7)                                | PR 2   | ~50 lines, no dependency; kills layout shift and fixes `srcset`                                                                                                                           |
| 3   | "Recently used" strip (D9)                                    | PR 4   | Most picks are re-picks; turns the common case into zero scrolling                                                                                                                        |
| 4   | Facet counts on tabs and categories (D9)                      | PR 3/4 | One `groupBy`; makes the library's shape visible instead of guessed                                                                                                                       |
| 5   | Range-aware reads (finding 8)                                 | PR 6   | A 100 MB allocation per video seek is a production incident waiting for the first course video                                                                                            |
| 6   | `Content-Disposition: attachment` for documents               | —      | ADR-034 §1 specified it; the route does not implement it. Small, but it is a security-adjacent gap and deserves its own line in a hardening PR                                            |
| 7   | An LRU over the `key → mimeType` lookup in `readStoredFile`   | —      | Keys are immutable, so the cache can never be wrong; but the DB hit is also the "only known keys are served" authorization, so it needs care. Modest win, non-trivial reasoning — not now |
| 8   | Soft-deleted-row reaper                                       | —      | ADR-034 §4 already calls this "a maintenance job's job". Real, but it is changes-12 M-scale operational work                                                                              |
| 9   | Per-category retention/size budgets surfaced in the admin     | —      | Only meaningful once changes-12 M9's settings group and M10's metrics exist                                                                                                               |
