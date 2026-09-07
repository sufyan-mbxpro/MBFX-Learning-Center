# ADR-017: Media uploads — server-validated receipt into a storage driver (local disk now, S3 as the seam), served by a route handler

**Status:** Accepted
**Date:** 2026-09-03
**Module:** 11 (content system — media), consumed by 09 (theme/logos), 15 (article covers), 05 (IMAGE settings) — changes-02
**Supersedes:** —
**Superseded by:** —

## Context

plan.md Module 11 and security.md #9 describe uploads as "presigned S3 URLs
only". No S3 bucket exists for this project yet (`.env.example` carries the
names, every value is empty), and changes-02 asks — today — that logos,
favicons, article covers and share images be **uploaded through the
system** instead of typed in as path/URL fields. Shipping a presigned-S3
flow now would ship something nobody can run.

The security intent behind "presigned S3 only" is two-fold and worth
keeping verbatim: (a) the app process must never fetch an arbitrary URL on
an admin's behalf (SSRF), and (b) MIME and size are validated server-side,
never trusted from the client. Neither of those requires S3 specifically;
both require that bytes only enter storage through one validated path.

## Decision

- **One entry point:** `@repo/core`'s `storeImage()` (packages/core/src/
  media.ts). It receives bytes (from a Server Action `FormData`), enforces
  `MAX_UPLOAD_BYTES` (5 MB), **sniffs the real type from magic bytes**
  (PNG, JPEG, GIF, WebP, ICO, SVG) — the client's `File.type` and extension
  are ignored — assigns a random extension-bearing object key, writes
  through a `StorageDriver`, records a `MediaAsset` row, and audits.
- **Storage driver interface** `{ put(key, bytes, mime) → url; get(key) }`.
  The shipped driver is **local disk** under `UPLOADS_DIR` (default
  `<cwd>/storage/uploads`, git-ignored). An S3 driver is the named next
  step: same interface, `S3_*` env selects it — nothing above the driver
  changes. Presigned direct-to-S3 uploads, when they land, replace only
  the transport into `put`, not the validation or the model.
- **Serving:** `GET /uploads/[file]` (apps/web/app/uploads/[file]/route.ts)
  looks the key up in `MediaAsset`, refuses anything not in the table, and
  streams it with the stored MIME, `nosniff`, and a long immutable cache
  (keys are random, never reused). SVG is served with
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
sandbox` so an uploaded SVG cannot run script when opened directly.
- **No URL ingestion.** The upload widget replaces every image URL text
  field it touches (settings `IMAGE` type, article cover / OG image, theme
  logos & favicon). The contracts still accept a stored URL string because
  that is what the row holds — they do not fetch it.
- **Permission per purpose:** the upload action gates by declared
  purpose — `brand` → `theme.update`, `setting` → `settings.update`,
  `article`/`content` → `analysis.update | news.manage` — then the
  consuming action re-checks its own key when the URL is saved.

## Consequences

- Local disk is not shared across app instances; single-node only until
  the S3 driver lands. Mitigation: the driver seam is one file, and
  `UPLOADS_DIR` can point at a mounted volume meanwhile.
- Server Actions cap request bodies at 1 MB by default; `next.config.ts`
  raises `experimental.serverActions.bodySizeLimit` to 6 MB (5 MB file +
  multipart overhead, per the installed Next docs).
- Every image request costs one indexed `MediaAsset` lookup. Mitigation:
  `Cache-Control: public, max-age=31536000, immutable` — browsers and any
  CDN in front hold it after the first hit.
- No image resizing/variants yet (`sharp` stays pre-approved in
  `allowBuilds` for when they land); `width`/`height` are nullable.

## Alternatives considered

- **Write into `apps/web/public/uploads`.** Rejected: whether `next start`
  serves files added after build is an implementation detail, and the
  folder would be served with no MIME/CSP control (SVG script execution).
- **Route handler instead of a Server Action for the upload.** Rejected
  for now: the action gives CSRF protection and the `useServerAction`
  toast/refresh flow for free; the body-size config is one line. Revisit
  with presigned S3, where the browser talks to the bucket directly.
- **Accept the client's `File.type`.** Rejected — security.md #9 says
  server-side validation, and `File.type` is client-supplied.

## Compliance

- `packages/core/src/media.test.ts` — pure sniffer/size/name tests: every
  accepted format by magic bytes, a renamed script/HTML rejected, oversize
  rejected, generated keys match `^[a-z0-9]+\.(png|jpg|gif|webp|ico|svg)$`.
- security.md #9 reworded to point here; `pnpm check:phantom-deps` keeps
  `node:` usage inside `@repo/core` only.
