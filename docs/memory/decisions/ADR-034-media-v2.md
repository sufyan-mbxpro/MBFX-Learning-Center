# ADR-034: Media v2 — `storeMedia()` for image, video, audio and document; asset metadata; replace-in-place; usage-guarded deletion; a library that the composer's picker _is_

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS), delivering the Module 11 media-library work the plan lists as deferred
**Supersedes:** — (extends ADR-017; keeps its validation and storage-driver seam unchanged. Replaces plan v2 §12 Phase 3's "minimum picker" wording with the scope in §5 below)
**Superseded by:** —

## Context

ADR-017 shipped the right pipeline for images: `storeImage()` with a 5 MB
cap, magic-byte MIME sniffing, random keys, a `StorageDriver { put, get }`
with local disk now and S3 as the seam, a `MediaAsset` row, an audit entry,
and `GET /uploads/[file]`. It is image-only, `MediaAsset` carries no
`kind`, `title`, `altText`, folder, tags or usage, and there is no library
UI. Plan v2 covered this with a "minimum picker" (select + upload + alt).

The owner's requirement is a **reusable media system**: upload once,
search, organise, reuse anywhere, replace, see usage, delete safely — for
images, videos, audio, documents and embedded video. ADR-032 needs
self-hosted video for backgrounds; ADR-031 needs `MEDIA` link targets for
downloads; ADR-023 assumes a deletion guard "the media library uses"; and
"a media asset should never need to be uploaded again because it is used on
another page" is a stated acceptance criterion.

## Decision

### 1. `storeMedia()` generalises `storeImage()`; the seam does not move

```ts
storeMedia(input: { bytes, fileName, purpose, uploadedBy, kind?: MediaKind }): Promise<MediaAsset>
```

- **Kind is decided by magic bytes**, never by the client's `File.type` or
  extension (security.md #9). Allow-list per kind: `IMAGE` (as today),
  `VIDEO` (`mp4`/H.264+AAC, `webm`), `AUDIO` (`mp3`, `m4a`), `DOCUMENT`
  (`pdf` only in MVP). Anything else is refused. SVG stays refused.
- **Size caps per kind are settings** (`media.maxBytes.{kind}`; defaults
  5 MB image, 100 MB video, 20 MB audio, 20 MB document), validated
  server-side before any byte reaches the driver.
- `storeImage()` remains as a thin wrapper (`kind: IMAGE`) so Module 15's
  callers do not change.
- `StorageDriver` is unchanged. Large uploads go through the same
  `put`; presigned direct-to-S3 replaces the transport later, not the
  validation (ADR-017's own sentence).
- `GET /uploads/[file]` gains **HTTP Range** support (206, `Accept-Ranges:
bytes`) so video and audio seek; headers otherwise unchanged (`nosniff`,
  immutable cache keyed by the random object key). Documents are served
  `Content-Disposition: attachment` unless `purpose` says inline.

### 2. `MediaAsset` metadata

```prisma
enum MediaKind { IMAGE VIDEO AUDIO DOCUMENT }

model MediaAsset {
  …existing…
  kind           MediaKind @default(IMAGE)
  title          String?   @db.VarChar(200)
  altText        String?   @db.VarChar(500)   // default alt; a placement's translatable alt overrides it
  folder         String    @default("/") @db.VarChar(300)   // path string — "/hero/2026"; no folder table
  tags           Json?     // string[] — validated, lower-cased, ≤ 20
  durationMs     Int?
  posterAssetId  String?   // VIDEO: a MediaAsset IMAGE; required for background use (ADR-032 §2)
  version        Int       @default(1)   // bumped by replace-in-place
  deletedAt      DateTime?
  @@index([kind, folder])
}
```

- **Alt text is contextual and translatable.** The `image` block's `alt`
  is a translatable prop on the node (ADR-024 §3) that defaults to
  `MediaAsset.altText` when empty; the library edits the default, the
  composer edits the placement. Decorative images set `alt: ""` explicitly.
- `folder` is a path string, not a table: it gives the library a tree
  view, move and rename with one column and no joins. Promoting it to a
  model later is additive.
- Existing rows backfill to `kind: IMAGE`, `folder: "/"`.

### 3. Replace in place

"Replace file" stores new bytes under a **new object key**, updates the
same `MediaAsset` row (`key`, `url`, `mimeType`, `size`, `width`,
`height`, `version + 1`) after the same magic-byte and kind check (kind
may not change), keeps the id, writes an audit row, and invalidates every
referencing page via `ContentReference` (ADR-033 §4): `page:{id}` for each
referencing version, `card-template:{id}`, `part-data:{key}`, plus
`content` when an article references it. The old object is deleted after
the invalidation succeeds. Because the URL carries the object key, the
immutable cache stays correct.

### 4. Usage-guarded deletion

Delete is **soft** (`deletedAt`), refused while any `ContentReference`
row points at the asset — the error lists sources by type and name. A
"force" path does not exist in the UI; an admin removes the placements
first, which the usage panel links to. Hard deletion of soft-deleted rows
with no references is a maintenance job, not a screen. This is the guard
ADR-023 §5 assumed.

### 5. The library UI — one component, two hosts

`/admin/website/media` and the composer's picker are **the same
`MediaLibrary` component** (list/grid, kind filter, folder tree, tag and
text search, upload with progress, detail panel with title/alt/tags/folder,
usage panel, replace, delete). The picker hosts it in a dialog with
`mode: "select"` and a `kind` filter; the page hosts it full-screen. There
is no separate "minimum picker".

**Phase 3 scope (replaces the plan's "select + upload + alt text"):**
upload (all four kinds) · grid/list · kind filter · folder tree with
move · text search · title/alt/tags edit · select · usage panel · replace
· guarded delete. Deferred, own DEVLOG note: bulk operations, focal
point/crop (`focalX/Y`), image variants/thumbnails generation (`sharp` is
pre-approved in `pnpm-workspace.yaml` for exactly this).

### 6. Embedded video is a source, never an asset and never a background

The `video` block (plan §6.2) has `source: { kind: "MEDIA"; assetId } |
{ kind: "EMBED"; url }` where `EMBED` is validated by the existing
`@repo/utils/video-embeds` allow-list (YouTube, Vimeo — ADR-015 #9) and the
iframe URL is constructed locally at render. Embeds are not `MediaAsset`
rows, do not appear in the library, and are not accepted by
`StyleChoices.background` (ADR-032 §2). The app never fetches an
admin-supplied URL (security.md #9).

### 7. Permissions

The seeded `media.*` keys are reused: `media.view` for the library and
picker, `media.upload`, `media.update` (metadata, replace), `media.delete`.
Every mutation: `requirePermission()` first line → `@repo/core` →
`recordAudit()`.

## Consequences

- **Video files on local disk in dev, S3 later.** 100 MB uploads through a
  Next route handler are fine locally and acceptable for a first launch;
  presigned uploads are the named next step when hosting moves. The
  validation stays server-side either way — the driver seam is the whole
  point of ADR-017.
- **Range serving in a route handler** adds a small amount of code and a
  test; it is the difference between video that seeks and video that does
  not.
- **`tags` as JSON** cannot be indexed for search on MariaDB; text search
  covers `title`/`fileName`/`altText` and tags are filtered in memory per
  page of results. Adequate for a single-site library; a join table is
  additive if it is ever not.
- **Usage guard depends on every media-holding entity calling
  `syncReferences`.** Articles, brand assets, settings and menu items must
  be wired in the same PR as the guard, or the guard lies. A test
  enumerates the models with media columns and asserts each service calls
  the helper.
- **No image variants yet.** Large hero images ship as uploaded; the
  Lighthouse budget will say when thumbnails are needed, and `sharp` is
  already allow-listed.

## Alternatives considered

- **Keep `storeImage()` + a separate video pipeline.** Rejected: two
  validation paths, two size-cap systems, two audit shapes.
- **A `MediaFolder` table and a `MediaTag` join now (v1 §5.3).** Rejected:
  a path string and a JSON array give the same UI for one site; the
  relational versions are additive when a reason appears.
- **Hard delete with cascade to `null` the references.** Rejected: silent
  holes in published pages; refusing with the list is the honest
  behaviour and matches the card-template guard.
- **Alt text on the asset only.** Rejected: alt depends on context and
  locale; the asset carries a default, the placement carries the truth.
- **Background video from YouTube.** Rejected — ADR-032 §Alternatives.
- **Ship the "minimum picker" first and the library later.** Rejected by
  the owner: the picker _is_ the library in select mode, and the deletion
  guard, replace and video need the metadata anyway; splitting them means a
  backfill and two UIs.

## Compliance

- `storeMedia()` tests: each kind's magic bytes accepted, spoofed
  extension/`File.type` refused, per-kind cap from settings enforced,
  SVG refused, `storeImage()` unchanged for Module 15's suite.
- `/uploads/[file]` test: `Range` request → 206 with correct
  `Content-Range`; headers unchanged for full responses.
- Replace test: id stable, key changes, referencing `page:{id}` tags
  invalidated, old object removed, audit row written.
- Guard test: delete refused with the source list while referenced;
  succeeds (soft) when not; a test enumerates media-holding models and
  asserts each service syncs references.
- Contract test: `video` block `EMBED` accepts only allow-listed hosts;
  `StyleChoices.background.video` rejects an embed.
- E2E (Phase 3 journey): upload an image and a video, place both, replace
  the image, attempt to delete it → refused with the page named.
- `check-permission-keys` covers `media.*`.
