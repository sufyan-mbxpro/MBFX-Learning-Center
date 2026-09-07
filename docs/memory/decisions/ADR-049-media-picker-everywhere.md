# ADR-049: One media picker, everywhere — "Choose from library" beside every upload, and a failure reason the admin can act on

**Status:** Accepted
**Date:** 2026-09-07
**Module:** 11 (Content system — media), touching 09 (admin shell), 15 (articles), 02 (theme/branding)
**Supersedes:** — (delivers the `mode: "select"` picker host ADR-034 §5 specified and `media-library.tsx` names as deferred; closes the reuse half of ADR-034's own acceptance criterion)
**Superseded by:** —

## Context

ADR-034 built a real media library — upload, search, kind filter, folders,
tags, replace-in-place, a usage guard on delete — and stated the owner's
acceptance criterion in its own words: **"a media asset should never need to
be uploaded again because it is used on another page."**

That criterion is not met today. The library is reachable, but nothing
_consumes_ it:

- `ImageUploadField` (`apps/web/app/(admin)/admin/_components/image-upload-field.tsx`)
  is the image input for the whole admin surface — the article editor's
  cover / OG / Twitter images, `settings-group-form.tsx`, the theme
  editor's branding logos, `social-links-manager.tsx`. It offers a file
  dialog and nothing else. An admin who uploaded a logo last week has no
  way to reach it; they re-upload the same bytes under a new random key.
- `rich-text-editor.tsx`'s in-body image button is the same: upload-only.
- The one "pick from library" UI ever written, `MediaPickerControl`, lives
  under `admin/website/pages/[id]/builder/_builder/` — inside the Website
  Builder that **ADR-042 cancelled**. It is unreachable code behind
  `WEBSITE_BUILDER_ADMIN_UI_ENABLED = false`, and by ADR-042 it has no
  resume path.
- `media-library.tsx`'s own header comment records the gap honestly: the
  select-mode picker host was deferred because "nothing consumes it yet
  (the composer is paused per ADR-037), so building it now would be
  unverifiable."

ADR-037/042 removed the consumer the picker was waiting on. The requirement
did not go away with it — reusing an uploaded asset is content-data work,
not layout composition, so it sits squarely on the live side of ADR-042's
static-design line. The picker now has four real consumers that are all
shipped and all reachable.

On failure reporting: the pipeline is better than it looks. `@repo/core`
throws specific messages ("The file is larger than 5 MB", "Only PNG, JPEG,
GIF, WebP, ICO or SVG images are accepted"), `handle-upload-error.ts` maps
them to JSON with a real status, and `UploadProgress` renders the message
with a Retry button. Two genuine defects remain:

1. **A rejected SVG lies about why.** `sniffImageType` returns `null` for an
   SVG containing `<script>` or an `on*=` handler — the same `null` an
   unrecognised binary returns — so the admin is told the file is not a PNG,
   JPEG, GIF, WebP, ICO or SVG when it demonstrably _is_ an SVG. The real
   reason (it carries executable content) never reaches them.
2. **An oversized file is rejected only after it finishes uploading.** The
   size cap is server-side, which is correct and must stay, but the client
   knows `File.size` before a single byte leaves. A 200 MB file currently
   uploads in full, then fails.

## Decision

### 1. One `MediaPickerDialog`, in `_components/`, consumed by every media surface

A new client component `apps/web/app/(admin)/admin/_components/media-picker-dialog.tsx`
with two tabs:

- **Library** — grid of existing assets, text search and kind filter, fed by
  the existing `listMediaAssetsAction` server action. Selecting a tile
  returns `{ id, url, fileName, altText, kind }` and closes.
- **Upload** — the same `useUploadProgress` XHR flow the rest of the admin
  uses, against the same `admin/api/uploads/*` route handlers. A successful
  upload selects the new asset immediately, so "upload new" and "reuse" are
  one control, not two.

It is a picker only. Editing metadata, replacing files and deleting stay in
`MediaLibrary` on `/admin/media` — the picker never becomes a second,
diverging library implementation.

`kinds` narrows what the dialog offers (`["IMAGE"]` for every image field
today). `purpose` selects the upload gate exactly as it does now.

### 2. `ImageUploadField` grows a "Choose from library" button — and every existing call site gets reuse for free

The field keeps its `onChange(next: { id, url } | null)` contract unchanged,
so the article editor, settings group form, social links manager and theme
editor need **no call-site change** to gain library reuse. This is why the
picker goes into the shared field rather than into four screens.

`allowLibrary` defaults to `true`. It exists so a surface that genuinely
must upload fresh bytes can opt out, not as a per-screen rollout switch.

### 3. The rich-text editor gains the same picker for in-body images

One extra toolbar button beside the existing upload button, same dialog,
inserting `{ src, alt }` from the chosen asset — so an image used in one
article can be used in the next without a second upload.

### 4. Strings: catalog keys resolved in the client, per the `UploadProgress` precedent

The picker resolves its own strings with `useTranslations("admin")` rather
than taking a `labels` prop, following `upload-progress.tsx` and
`breadcrumbs.tsx`. Threading a dozen more label props through every
`ImageUploadField` call site would be churn in four screens to say the same
six words. New keys are `admin.*`, English-only per ADR-043 §2.

### 5. Permissions are unchanged, and the picker degrades instead of breaking

`listMediaAssetsAction` already gates on `media.view`; the upload routes
already gate by purpose (`gateForPurpose`). Seeded `editor`, `author` and
`analyst` hold `media.view` + `media.upload`, so the article path works. A
role that can update the theme but holds no `media.view` — possible, since
branding gates on `theme.update` — gets the Library tab's error rendered as
text and a fully working Upload tab. **No permission is added, widened, or
inferred client-side**; the button being visible is UX, the server action is
the boundary (security.md #1).

### 6. Two honest failure reasons

- `sniffImageType` gains a distinguishable outcome for "this is an SVG, and
  it was refused for carrying script or event handlers". `validateImageUpload`
  and `validateMediaUpload` turn that into its own message rather than the
  generic type-list one. The refusal itself is unchanged — only what the
  admin is told.
- `ImageUploadField` and the picker's upload tab check `File.size` against
  the kind's cap **before** sending, and report the actual sizes. The
  server-side check stays exactly where it is and remains the only one that
  decides; the client check is a courtesy, never a substitute (security.md
  #9).

## Consequences

- The same asset is now reachable from the article editor, branding, the
  settings image fields, social links and the article body. ADR-034's
  "never uploaded again" criterion is met for every shipped image surface.
- `MediaAsset` reuse means `usageCount` and the ADR-034 delete guard start
  reflecting genuine multi-use assets, which is what the guard was built
  for and has had little to bite on so far.
- ADR-035's unwired consumers do not change. `Setting`-held
  `site.faviconUrl` / `seo.defaultOgImage` still record no
  `ContentReference` even when picked from the library — the picker returns
  the id, but those two keys still have nowhere to persist it. This ADR
  narrows nothing and fixes nothing there; ADR-035 §2's reasoning stands.
- The cancelled builder's `MediaPickerControl` is **not** deleted (ADR-042:
  hidden, not deleted). It is now redundant with a live component; deleting
  it needs its own ADR, like everything else under that cancellation.

## Alternatives considered

- **Revive `MediaPickerControl` from the builder.** Rejected: it lives
  inside the cancelled tree, is built against the builder's field-control
  props, and calls `uploadImageAction` directly with no progress reporting.
  Reviving cancelled code to serve live screens is exactly the drift ADR-042
  was written to stop.
- **Add `mode: "select"` to `MediaLibrary` itself,** as ADR-034 §5 sketched.
  Rejected on inspection: that component is 400+ lines of management UI
  (metadata form, replace, delete, confirm dialogs) whose every branch would
  need a `mode` guard. A picker needs none of it. Two small components beat
  one component with a mode flag threaded through it.
- **Put the picker only in the article editor,** matching the literal ask.
  Rejected: the owner's ask was explicitly "anywhere in the site", and the
  shared field is what makes that one change instead of four.
- **Client-side size check only, dropping the server cap.** Never
  considered seriously; recorded because security.md #9 makes the answer
  non-negotiable — the client check is additive.

## Compliance

- `media.test.ts`: a `<svg>` carrying `<script>` and one carrying `onload=`
  are both refused, and the thrown message names the script reason rather
  than the accepted-types list; a plain SVG still passes; an unrecognised
  binary still gets the type-list message.
- Existing `media.integration.test.ts` and `articles.integration.test.ts`
  reference-sync assertions are unaffected — the picker returns the same
  `{ id, url }` shape `ImageUploadField` already emitted.
- Permission-key cross-check (testing.md #5) covers the picker's use of
  `media.view` / `media.upload`, both already in the seed registry.
- E2E for the picker is **not** written here and is not claimed: the admin
  Playwright project is still blocked on the hydration issue recorded in the
  DEVLOG. Named as owed, not silently skipped.
