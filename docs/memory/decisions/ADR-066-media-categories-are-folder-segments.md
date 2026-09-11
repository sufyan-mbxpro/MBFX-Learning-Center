# ADR-066: A media category is the first segment of `folder`, from a code registry — and type stays in `kind`

**Status:** Accepted
**Date:** 2026-09-09
**Module:** 11 (content system / media), 09 (admin shell)
**Supersedes:** —
**Amends:** ADR-034 §2 (`folder` gains a constrained first segment; the
path-string mechanism is unchanged), ADR-034 §5 (the library's filter set)
**Superseded by:** —

## Context

The media library and picker have one taxonomy column that nothing uses.
`MediaAsset.folder` has existed since ADR-034 §2 as a path string with an
`@@index([kind, folder])`, and as of this ADR:

- `listMediaAssets()` accepts no folder argument at all,
- nothing writes anything but the `"/"` column default, except free text an
  admin types into the detail dialog,
- and so every consumer sees one undifferentiated pile.

The owner's requirement is that media be organised by **section** — News,
Learning, General — and, within a section, by **type** — Images, Videos,
Documents, Audio — so that opening the picker on a news article starts at
"News → Images" instead of the whole library.

Two columns already exist that could carry the section axis, and picking the
wrong one is the decision this ADR exists to prevent.

## Decision

### 1. The category is the first path segment of `folder`, and it comes from a code registry

```ts
// packages/contracts/src/media.ts
export const MEDIA_CATEGORIES = ["news", "learn", "brand", "general"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
```

`folder` is `/{category}` or `/{category}/{sub-path}`. Only the first segment
is constrained; `/news/2026-covers` stays legal, so the flexibility ADR-034 §2
bought is not spent.

A registry rather than a `media_folders` table, for three reasons that are all
already settled elsewhere:

- **ADR-042's design philosophy.** Structure is code; content _data_ is
  dynamic. A category is structure — it is the shape of the library, not a row
  in it.
- **ADR-048's precedent.** The mega-menu's panel composition is a code
  registry while the database owns the items. Same split here: the registry
  owns the categories, the database owns the assets.
- **changes-12 M6 explicitly declines to create `media_folders`**, and ADR-034
  §2 chose "path string, not a table" on the merits. Nothing has changed to
  reopen it.

Adding a category is a registry entry plus a catalog key. Removing one is a
superseding ADR, because assets would be stranded.

### 2. Not `purpose` — that column is a permission input

`MediaAsset.purpose` (`brand | setting | article | content`) is the argument to
`gateForPurpose()`, which chooses which `requirePermission()` call runs on an
upload. Widening it into a display taxonomy would couple _where a file is
filed_ to _who may upload it_: adding a "Learning" category would silently
create a permission bucket, and re-filing an asset would be a privilege change.
`purpose` keeps its single job.

### 3. Type lives in `kind`. There are no per-type folders.

`/news/images`, `/news/videos` and their siblings are **rejected, not
deferred**. The brief's "inside each category, organise by type" is delivered
as a filter _pair_ — `folder` prefix AND `kind` — not as a directory tree:

- `kind` is derived from magic bytes (ADR-034 §1) and `replaceMedia` refuses a
  kind change. A stored per-type path would be a second source of truth for a
  value that cannot legitimately change, and the two would drift on the first
  bug.
- "Everything in News" becomes a four-prefix query instead of one.
- It hands a future admin a folder tree to mismanage, which ADR-034 §5 already
  declined to build.

`@@index([folder, kind, createdAt])` serves the composed query in one seek, so
the tree buys no performance either.

### 4. Every upload declares its category

`storeMedia()`/`storeImage()` take a required `category`. The upload routes
read it from the `FormData` and Zod-parse it; they never infer it from
`purpose` (an article's header image and an article's inline diagram share a
purpose and may not share a folder). Each picker call site knows its category
statically — the article editor passes `news`, the lesson resources panel
passes `learn`, the theme editor passes `brand`.

`ImageUploadField` gains a **required** `category` prop. An optional prop with
a `"general"` default would avoid touching every call site and quietly file
half the library in the wrong place; the churn is the point.

### 5. No raw identifier renders

Each category key has an `admin.mediaCategory.*` catalog string
(code-style.md #5). Admin namespace, so `en.json` only (ADR-043 #2).
`humanizeKey()` is the fallback if an unregistered key ever reaches the UI.

### 6. Migration is a reset

The column default becomes `"/general"` and `"/"` stops being a legal value.
Pre-launch policy is reset, not backfill (plan §5.2) — `pnpm db:reset`.

## Consequences

- **The `folder` free-text field disappears from the detail dialog**, replaced
  by an `AdminCombobox` of categories plus a sub-path input. Any hand-typed
  folder not under a registered category is invalid after the reset.
- **Every `ImageUploadField` call site is touched** by the required prop.
- **A category cannot be renamed without a data change**, because it is
  embedded in `folder`. Renaming is an `UPDATE … SET folder = REPLACE(…)` plus
  a registry edit — pre-launch, that is a reset.
- The `@@index([kind, folder])` column order is wrong for the dominant query
  and is replaced by `@@index([folder, kind, createdAt])`.
- **changes-12 is unaffected.** It replaces the bytes layer; `folder` is
  metadata it neither reads nor moves. M6's "no `media_folders`" stands and is
  now positively justified rather than merely deferred.

## Alternatives considered

- **A `MediaFolder` table with a real tree.** Rejected — ADR-034 §2's reasoning
  is unchanged, and a tree is a management surface (create/rename/move/delete,
  orphan handling, permissions) bought to solve a filtering problem.
- **Reuse `purpose`.** Rejected — §2.
- **Per-type sub-folders under each category.** Rejected — §3.
- **A free-text category with no registry.** Rejected: the picker cannot
  default to a category it does not know exists, `humanizeKey()` would be doing
  the work a catalog string should, and typos become permanent folders.
- **Categories as seeded settings rows.** Rejected — that is the
  admin-configurable structure ADR-042 cancelled, and it would make the
  picker's default category a runtime lookup on every open.

## Compliance

- `packages/contracts/src/media.test.ts`: every registered category parses;
  `/`, `/unknown/x`, and a sub-path naming a kind (`/news/images`) are
  rejected; `/news/2026-covers` is accepted.
- `packages/core/src/media.integration.test.ts`: an upload writes the caller's
  category; the category filter matches a prefix and excludes other categories.
- The picker's default request carries the caller's category
  (`media-picker-dialog.test.tsx`).
- `pnpm check:catalog-completeness` — admin namespace, `en.json` only.
- Every mutation keeps `requirePermission()` first (security.md #1); this ADR
  changes no gate.
