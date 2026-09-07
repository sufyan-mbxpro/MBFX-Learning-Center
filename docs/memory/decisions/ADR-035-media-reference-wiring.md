# ADR-035: Closing ADR-034's usage-guard gap — `syncReferences()` for Article and BrandAsset; Setting and MenuItem named as deferred, not wired

**Status:** Accepted
**Date:** 2026-09-05
**Module:** 16 (Website Builder / CMS), fixing a compliance gap in ADR-034 that PR 3.2 shipped without
**Supersedes:** — (implements ADR-034 §"Consequences": "Articles, brand assets, settings and menu items must be wired in the same PR as the guard, or the guard lies")
**Superseded by:** —

## Context

ADR-034 was explicit that `deleteMedia`'s usage guard is only honest if
every media-holding service calls `syncReferences()`, and named the same
four consumers plan v2.2 §12 PR 3.2 lists: articles, brand assets,
settings, menu items. PR 3.2 shipped the guard wired only for
`PAGE_VERSION` (Phase 1's original wiring) and did not add the other four
— a correctness gap found on this PR's own verification pass, not by a
later bug report: `deleteMedia` will let an admin delete a `MediaAsset`
that is actively an article's cover image, a brand logo, a site favicon,
or an OG image, because no `ContentReference` row exists for any of those
usages.

Wiring turned out not to be uniform across the four named consumers, so
this ADR records what each one actually looks like today before deciding
how to close the gap:

- **`Article.coverImageUrl`, `ArticleTranslation.ogImageUrl`** store a
  plain URL string (`imageUrlSchema`, `packages/contracts/src/content.ts`).
  There is no asset id column to read a reference from — but the admin
  UI's `ImageUploadField` component already returns `{ id, url }` from
  every upload (`apps/web/app/(admin)/admin/_components/image-upload-field.tsx`);
  the id is simply discarded today, kept in neither state nor payload.
- **`BrandAsset`** (`setBrandAsset`, `packages/core/src/brand-assets.ts`)
  already _receives_ a real `mediaAssetId` argument — the contract
  requires it — but only uses it to look up `url`/`width`/`height`/
  `mimeType` to copy onto the row; the id itself is never persisted.
- **`Setting`** is a generic `key → Json` table. The two media-holding
  keys (`site.faviconUrl`, `seo.defaultOgImage`) are plain URL strings
  with the same shape problem as Article, but fixing it means changing
  the value shape of two specific keys inside a generic mechanism that
  every other setting also uses — a materially bigger change for two
  keys than adding one column to one model.
- **`MenuItem.icon`** is a free-text "lucide name or uploaded asset key"
  field per its own schema comment, and — confirmed by reading
  `packages/core/src/navigation.ts` and `admin.ts` — **no service function
  writes to it at all yet**. There is nothing to wire; the feature that
  would populate it doesn't exist.
- **`Course`/`CourseTranslation`** have the same `coverImageUrl`/
  `ogImageUrl` columns as Article, but — confirmed by reading
  `packages/core/src/content.ts` — **no `createCourse`/`updateCourse`/
  `saveCourseTranslation` function exists yet.** Module 11's course editor
  is genuinely unbuilt (matches the project status review from earlier
  this session). Nothing to wire here either.

So of the four named consumers, two (Article, BrandAsset) have a real,
reachable write path missing only the reference sync; two (Setting,
MenuItem) either cost more to fix than the two keys/one field justify
today, or have no write path to hook into at all.

## Decision

### 1. Article and BrandAsset get real columns and real wiring, now

- `Article` gains `coverImageAssetId String?`; `ArticleTranslation` gains
  `ogImageAssetId String?`; `BrandAsset` gains `mediaAssetId String?`. All
  three are plain nullable scalars with no Prisma `@relation` — consistent
  with `ContentReference.refId`'s own non-FK modelling elsewhere in this
  schema, and correct because a soft-deleted `MediaAsset` must stay a
  valid, reportable reference rather than cascade into a broken FK.
- `updateArticleMetaSchema` gains `coverImageAssetId` (nullable,
  optional); `saveArticleTranslationSchema` gains `ogImageAssetId` (same
  shape). `setBrandAssetSchema` needs no change — it already carries
  `mediaAssetId` as a required field.
- `updateArticleMeta` and `saveArticleTranslation` each run inside
  `db.$transaction`, write the asset id column alongside the existing URL
  column, then call `syncReferences` with the **row's resulting value**
  (not the raw input) so a save that doesn't touch the image field can't
  accidentally wipe a previously-recorded reference. `sourceId` is the
  article id for the cover image (one cover per article, one sourceId) and
  `` `${articleId}:${locale}` `` for each translation's OG image (one
  `ContentReference` row set per translation, so two locales' OG images
  don't overwrite each other's `sourceId`-scoped rows).
- `setBrandAsset` persists `mediaAssetId` on the upserted row and syncs a
  reference keyed by `sourceId: key` (`logo_light`, `logo_dark`,
  `favicon`); `clearBrandAsset` syncs an empty reference set for the same
  `sourceId` before deleting the row.
- `duplicateArticle` copies both new columns onto the copy and syncs
  references for the **new** article id — a duplicate's cover image is a
  real, independent usage the guard must see from the moment it exists,
  exactly like the original.
- **The admin UI already has everything it needs.** `ImageUploadField`
  already hands back `{ id, url }`; the article editor's cover/OG-image
  fields start tracking the `id` half in state and send it in the same
  save payload that already sends the URL. No new picker UI, no new
  upload flow — this is a wiring fix, not a UX change.
- **Existing rows are not backfilled.** This is a pre-launch project
  (reset, not backfill, is the established DB policy for schema changes
  at this stage); a `MediaAsset` uploaded before this ADR has no
  reference row until the next time its owning article/brand slot is
  saved. Named here as an accepted, temporary gap rather than a silent
  one — closing it fully requires either a one-time admin re-save pass or
  a matching-by-URL backfill script, neither of which is justified for a
  repo with no production data yet.

### 2. Setting and MenuItem stay unwired, named and reasoned, not silently dropped

- **Setting** (`site.faviconUrl`, `seo.defaultOgImage`): wiring these two
  keys would mean changing the value shape of specific keys inside a
  generic `key → Json` mechanism every other setting also uses, or adding
  a parallel side-table just for these two — real added complexity for
  two settings, versus the bounded, obviously-scoped column-per-model fix
  above. Deferred with a named reason, not forgotten: revisit if/when
  Settings grows more media-holding keys and the generic-shape cost is
  paid once instead of twice.
- **MenuItem.icon**: nothing writes to it today, so there is nothing to
  wire — adding reference-sync logic for a write path that doesn't exist
  yet would be exactly the "code for a hypothetical future requirement"
  this repo's engineering guidelines rule out. Wire it when Module 16's
  Phase 6 (or whichever phase first ships a menu-item icon picker) adds
  the write path — same PR, per ADR-034's own rule.
- **Course/CourseTranslation**: same reasoning as MenuItem — no write path
  exists (Module 11's course editor is unbuilt). Wire alongside whichever
  PR first ships `createCourse`/`saveCourseTranslation`.
- `deleteMedia`'s guard therefore remains **honest for CMS pages,
  articles, and brand assets**, and **still blind to Setting-held
  favicon/OG-image URLs and any future MenuItem icon or Course cover**
  until those land. This is narrower than ADR-034's original "wire all
  four" instruction, and this ADR is the record of why: two of the four
  had no reachable write path to wire into, and this ADR chooses to ship
  the two that do rather than block on inventing write paths for features
  nobody has asked to build yet.

## Consequences

- `deleteMedia`'s error message, which already reports usage grouped by
  `sourceType`, will start showing `ARTICLE` and `BRAND` alongside
  `PAGE_VERSION` — genuinely more useful to whoever is trying to delete an
  asset, not a behavior change an admin needs to be told about separately.
- Any code that reads `Article.coverImageAssetId`/`ArticleTranslation.
ogImageAssetId`/`BrandAsset.mediaAssetId` going forward must not assume
  it is populated for rows saved before this ADR — `null` there means
  "not tracked yet," not "no image."
- The Comment/index migration-history gap will very likely bite a third
  time when this ADR's migration runs — same recovery procedure as PR 3.1
  and PR 3.2, documented again in DEVLOG rather than re-litigated here.

## Alternatives considered

- **Backfill existing rows by matching URL to `MediaAsset.url`.** Rejected
  for now: real work for a pre-launch repo with only seed/test data; the
  project's own precedent for schema changes at this stage is reset, not
  backfill. Revisit only if this repo acquires real production content
  before Phase 4/9 would otherwise touch these rows anyway.
- **Change `Setting.value`'s shape for the two media keys to `{ url,
assetId }`.** Rejected: every other reader of `site.faviconUrl`/
  `seo.defaultOgImage` (theme/SEO metadata code) expects a bare string
  today; changing the shape for two keys inside a mechanism shared by
  every setting is a bigger, riskier change than the problem justifies.
- **Add the FK with a real Prisma `@relation` and cascade behavior.**
  Rejected: a hard FK would force a decision about what happens to
  `coverImageAssetId` when the referenced `MediaAsset` is hard-deleted
  (there is no hard-delete path today, only soft), and `ContentReference`
  itself already establishes the plain-scalar, no-FK precedent for exactly
  this kind of polymorphic-ish reference in this schema.
- **Do nothing until Phase 4/9 revisits Article/Course together.**
  Rejected: the gap is a live correctness bug in a guard this repo already
  shipped and documents as authoritative ("refused while any
  `ContentReference` row points at the asset") — leaving it silently
  wrong until an unrelated future phase is the kind of drift this
  project's own governance model exists to catch.

## Compliance

- `articles.integration.test.ts`: `updateArticleMeta` with a
  `coverImageAssetId` creates a `MEDIA` reference on `sourceId: articleId`;
  clearing it (`null`) removes the reference; `saveArticleTranslation`
  with `ogImageAssetId` creates a reference on `` sourceId:
`${articleId}:${locale}` `` independent of the article-level cover
  reference; `duplicateArticle` produces a reference for the new article
  id, not the source's; `deleteMedia` refuses when an `ARTICLE`-sourced
  reference exists and reports it in the error.
- A new brand-assets integration test: `setBrandAsset` creates a `MEDIA`
  reference on `sourceId: key`; `clearBrandAsset` removes it;
  `deleteMedia` refuses when a `BRAND`-sourced reference exists.
- No test claims Setting or MenuItem are wired — their absence is asserted
  by this ADR's text, not silently implied by an untested code path.
