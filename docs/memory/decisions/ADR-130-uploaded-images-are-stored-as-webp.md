# ADR-130: Uploaded images are stored as WebP, aimed at 80 KB

**Status:** Accepted
**Date:** 2026-09-17
**Module:** 11 (content system: media), consumed by 15 (article covers) and 12 (public pages)
**Plan:** owner request, 2026-09-17
**Supersedes:** the "No image resizing/variants yet" consequence of ADR-017, and the "No image variants yet" line of ADR-034. The rest of both ADRs stands: one entry point, magic-byte sniffing, the storage driver seam, serving by key, and replace-in-place.
**Superseded by:** —

## Context

The owner asked whether uploads are converted, how far they are reduced, and
whether the format is WebP. The answer was no on all three counts:

- `storeMedia` wrote the uploaded bytes unchanged. A 4000×3000 phone photo
  of 4.8 MB was stored and served as a 4000×3000 JPEG of 4.8 MB. It also kept
  its EXIF block, which includes the GPS position.
- Pages that render through `next/image` without `unoptimized` got a
  resized WebP from Next's own optimizer at request time. Course covers,
  video covers and the media library's thumbnails are in this group.
- The news surfaces (the listing card, the sidebar thumbnails, the article
  cover and the header banner) hard-coded `unoptimized`. The reason was that
  a cover URL could be an absolute URL on an arbitrary host. Every uploaded
  cover was therefore sent at full size, including into a 56px sidebar
  thumbnail.
- Images inside rich text are a plain `<img>` and have never been optimized.

`sharp` has been allowed to run its install script since ADR-017 ("for when
[variants] land"), and it is already in the lockfile as Next's optional
dependency.

## Decision

1. **Optimization happens once, at upload.** In `storeMedia` and
   `replaceMedia`, an IMAGE goes through `optimizeImage()`
   (`packages/core/src/image-optimize.ts`) before it reaches the storage
   driver:
   - EXIF orientation is applied to the pixels.
   - The image is encoded as **WebP with `smartSubsample`, aimed at
     `OPTIMIZE_TARGET_BYTES` = 80,000 bytes**. The owner asked for images of
     around 80 KB. A fixed quality cannot deliver that, because a detailed
     1920px photograph and a flat diagram differ tenfold at the same setting.
   - **Quality before resolution.** The longest edge starts at the upload's
     own size, capped at 3840px (never enlarged). At that size the search
     looks for the highest quality between **60 and 85** that fits the
     budget, by integer bisection.
   - Only when quality 60 does not fit does the edge step down through
     2560 → 1920 → 1600 → 1280. A step whose pixel-scaled prediction cannot
     fit is skipped, and every step resizes from the full decode.
   - An image already under budget at 85 stays at 85 and is never encoded
     sharper to spend the budget.
   - An image over budget even at 1280px and quality 60 is kept there, the
     closest it can get.
   - History of the same day: the first cut was 2560px at a fixed quality 80
     and looked soft. The second was 3840px at a fixed 85, still softened by
     Next's display quality of 75. The owner then set the 80 KB target.
   - All metadata is dropped, GPS included.

   The row records the stored MIME type, size and real dimensions. The
   display file name takes the `.webp` extension, so a download's suggested
   name matches its bytes.
2. **The cap and the sniff still run on the bytes the uploader sent.**
   `media.maxBytes.image` means the same thing it meant before this ADR. The
   upload is refused or accepted first, and only then optimized.
3. **Only JPEG, PNG and WebP are re-encoded.** GIF is kept because libvips
   would keep one frame of an animation. An animated PNG (`acTL` before
   `IDAT`) and an animated WebP (more than one page) are kept for the same
   reason. ICO and SVG are not photographs.
4. **`brand` and `setting` uploads keep their bytes.** Those are logos, the
   favicon, `email.logo` and `seo.defaultOgImage`. Outlook desktop does not
   render WebP, a favicon's container is the point of it, and some
   link-preview crawlers do not render WebP. Article, content and avatar
   uploads are optimized. `replaceMedia` decides by the row's own `purpose`.
5. **Optimization never fails an upload.** `optimizeImage` returns `null`,
   and the original bytes are stored, in these cases:
   - the image cannot be decoded;
   - it exceeds 100 megapixels (the decompression-bomb ceiling handed to
     libvips);
   - it is animated;
   - a re-encode without a resize would come out larger.

   That is exactly the pre-ADR behaviour, so the worst case is what the site
   already did.
6. **The audit row says what was uploaded.** A converted upload's
   `media.upload` / `media.replace` entry carries `originalMimeType`,
   `originalSize` and the chosen `quality` beside the stored values.
7. **The news surfaces use the optimizer for their own uploads.**
   `canOptimizeImage(src)` (`app/(public)/[locale]/_lib/image-optimizer.ts`)
   is true for a non-SVG `/uploads/` path. An absolute URL and an SVG still
   render `unoptimized`, so `images.remotePatterns` stays closed. A source
   guard fails if a bare `unoptimized` returns to those three files.
8. **One display quality.** `images.qualities` is `[85]`, matching the
   stored quality's ceiling. With one entry, every `<Image>` resolves to it, so no
   call site passes `quality`, and the optimizer does not compress an upload
   a second time at a lower quality. An unlisted `q=` in a
   `/_next/image` URL now answers 400.
9. **No setting.** The budget, the quality range and the edge steps are
   constants. An
   admin-editable value that nobody tunes is a setting read by nothing in
   spirit (code-style.md #28), and changing either one is a deploy.

## Consequences

- Stored images land at or under about 80 KB. Measured on the eleven
  existing raster uploads in the development library, the total went from
  6.33 MB to **0.52 MB**:
  - every result is between 12 KB and 79 KB;
  - the five images of 1000px or less stayed at quality 85 and full size;
  - a 1920×1080 PNG went from 2.2 MB to 74 KB (quality 75, full size);
  - a 1920×1280 JPEG went from 431 KB to 79 KB (quality 63, full size);
  - a 1920×602 panorama went from 409 KB to 78 KB (quality 66, 1280px);
  - a synthetic, detailed 12 MP camera photograph went from 5 MB to 88 KB
    at 1280px and quality 60, which is the floor, so slightly over.

  A browser that fetches `/uploads/<key>` directly (rich-text images,
  `unoptimized` call sites) gets the small file too.
- **Detailed large photographs lose resolution.** An 80 KB WebP cannot
  carry a detailed 12 MP photo at full size, so such uploads are stored at
  1280–1920px. That still covers every in-page slot at 1.5x or better. A
  full-width 1920px banner on a large screen is upscaled slightly.
- **Encoding cost.** The search runs up to about ten encodes, all on the
  server inside the upload request. Measured in development: under 100ms for
  a 1000px image, 0.3–2.2s for 1920px images, and 3.7s for a 12 MP photo.
- **Existing uploads are unchanged.** This applies to new uploads and
  replacements only. A backfill would rewrite keys that published pages
  embed, and needs `invalidateMediaReferences` for each row. That is a
  separate job and a separate decision.
- **The uploaded original is not kept.** An image stored below its uploaded size cannot be
  recovered at full resolution from the library. The site does not display
  anything wider, and keeping originals would double storage for a use the
  site does not have. The S3 driver can revisit this.
- An article `ogImageUrl` uploaded with purpose `article` is stored as WebP.
  Facebook and X render WebP share images. A crawler that does not falls back
  to the site's default share image, which is `setting` and so is not
  converted.
- WebP is lossy, so a PNG screenshot with fine text is re-encoded at the budget's
  quality (75 for the 1920×1080 screenshot above). If that proves visible on chart screenshots, the lever is a lossless
  branch for PNG input, not turning the step off.
- `sharp` becomes a direct dependency of `@repo/core`, pinned exactly
  (`docs/memory/stack.md`). It is already in Next's `serverExternalPackages`,
  so it is not bundled.

## Alternatives considered

- **Variants (thumb / medium / large) per upload.** Rejected for now.
  `next/image` already produces width variants on request for every call site
  that allows it, and a second variant system would disagree with it. The
  `resolveThumbnailUrl` seam from ADR-067 is unchanged if one is needed.
- **AVIF.** Rejected. It is smaller again, but the encode is several times
  slower inside a request, and Next's optimizer is configured for WebP only.
- **Only remove `unoptimized` on the news pages.** Rejected as the whole
  answer. It fixes those pages but not rich-text images, storage, or the GPS
  block in a learner's avatar.

## Compliance

- `packages/core/src/image-optimize.test.ts` runs against real encoded bytes.
  It covers the JPEG → WebP conversion, the edge cap with aspect ratio, no
  enlargement, EXIF orientation applied and metadata (GPS) stripped, keeping
  the original when a re-encode is larger, re-encoding an oversized WebP,
  GIF/ICO/SVG untouched, an animated PNG untouched, undecodable bytes, and
  the file-name swap.
- `packages/core/src/media.integration.test.ts` (MariaDB) covers two cases:
  - an `article` JPEG (4800×2400) is stored as a 3840×1920 WebP whose row, stored bytes
    and audit entry agree;
  - a `brand` JPEG is stored byte-for-byte.
- `apps/web/app/(public)/[locale]/_lib/image-optimizer.test.ts` covers
  `canOptimizeImage` and adds the no-bare-`unoptimized` guard on the news
  files.
