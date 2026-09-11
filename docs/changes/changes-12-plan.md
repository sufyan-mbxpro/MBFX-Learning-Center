# changes-12 — plan: the media platform (object storage, queue, transcoding, CDN)

**Version 2** (2026-09-08) — owner reviewed v1 and returned ten refinements.
All ten are adopted; three change the design materially (M14 ownership model,
M4 pipeline shape, M2 resumable uploads) and one corrects v1 outright.
**Status:** plan only. No code, no migration, no ADR written yet.
**Relationship to changes-11:** supersedes its D19, D20, D22 and part of D23;
replaces its Phase 3 PR 3.5 and Phase 8. Everything else there stands.

> **The web application owns authorization and orchestration; object storage
> owns bytes; BullMQ owns delivery of work; the worker owns processing; MariaDB
> owns media state; and the CDN owns media delivery.**

That sentence is the whole architecture. Every decision below is a consequence
of it, and any proposal that blurs one of those boundaries is wrong by
construction.

---

## 0. One correction carried forward

The owner's original recommendation named **pg-boss**. It cannot run on this
stack: `packages/db/prisma/schema.prisma` declares `provider = "mysql"`,
`.env.example` carries `DATABASE_URL="mysql://…"`, and `docker-compose.yml` runs
`mariadb:11.4`. pg-boss is built on PostgreSQL internals (`SKIP LOCKED`,
`LISTEN/NOTIFY`) and would need a PostgreSQL instance purely as a job store.
There is no pg-boss anywhere in this repository.

**BullMQ is used instead** — Redis is already in `docker-compose.yml`
(`redis:7-alpine`) and `ioredis` is already a dependency of `@repo/auth`.
Owner concurred in review.

---

## 1. Why this is its own programme

It introduces a **second deployable process**, a **third-party storage
dependency**, a **native binary** (FFmpeg), a **CDN origin in the CSP**, and a
**cost model** — none of which the repository has today. Each is an
architecture-level change under `plan.md` Part F #10.

### 1.1 It must not become the critical path for the learning launch

The most valuable thing ADR-017 built is the `StorageDriver` seam. Use it:
**changes-11 Phases 1–5 proceed on the existing local-disk driver while this
programme runs in parallel.** The learning admin uploads a cover through
`storeMedia()` exactly as today; when M2 lands, the driver underneath changes
and no learning code moves. Making the learning area wait on FFmpeg would delay
a launchable product for a subsystem its Phase 1–5 content never exercises.

---

## 2. What already exists (verified 2026-09-08)

| Component                                              | State                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `StorageDriver` interface                              | **Exists** — `packages/core/src/media.ts:131`, `createLocalDiskStorage()`, `resolveStorageDriver()`          |
| Magic-byte validation                                  | **Exists** — `sniffImageType()`, `sniffMediaType()`, `validateMediaUpload()`; scriptable SVG rejected        |
| Object-key discipline                                  | **Exists** — random 24-hex keys, `OBJECT_KEY_PATTERN` enforced before any disk access                        |
| `MediaAsset.version`                                   | **Exists** — bumped by replace-in-place (ADR-034 §3). **Becomes the derivative path segment** (M8)           |
| Range/seek serving                                     | **Exists** — `app/uploads/[file]/route.ts`, single-range, immutable cache, SVG sandbox CSP                   |
| Usage tracking + safe delete                           | **Exists** — `ContentReference`; `deleteMedia()` throws `MediaAssetInUseError`                               |
| Media library + picker                                 | **Exists** — `listMediaAssets()`, `media-library.tsx`, `media-picker-dialog.tsx` (ADR-049)                   |
| Media permissions                                      | **Exists, seeded** — `media.view` / `upload` / `update` / `delete`                                           |
| Redis                                                  | **Exists** — docker-compose service; `ioredis` in `@repo/auth`                                               |
| Settings infrastructure                                | **Exists** — `@repo/settings` typed reader/writer, `settings:{group}` cache tag                              |
| Error tracking                                         | **Planned, Module 14** — Sentry + structured logging. M10's observability reports **into** it, not beside it |
| Queue / worker / FFmpeg / sharp / CDN / object storage | **None.** All new here.                                                                                      |

The pipeline is an **extension** of one existing path, not a second one — the
owner's §74 constraint, preserved.

---

## 3. Decisions

ADRs before code. **ADR-059** (storage + CDN), **ADR-060** (queue, worker,
state ownership), **ADR-061** (pipeline, model, settings, observability),
**ADR-062** (video, FFmpeg, HLS).

### M1 — Object storage: S3-compatible, Cloudflare R2 recommended ⟶ ADR-059

The driver interface is already S3-shaped. What matters for this workload is
**egress** — a learning platform serving course video is read-heavy by an order
of magnitude.

| Option              | Shape of the model                                                              | Fit here                                                                       |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Cloudflare R2**   | S3-compatible API; egress not billed; CDN is the same product                   | **Recommended** — removes the dominant cost line and the separate CDN decision |
| DigitalOcean Spaces | S3-compatible; bundled transfer allowance then per-GB; CDN included             | Reasonable; simpler billing, less headroom at video scale                      |
| Backblaze B2        | S3-compatible; cheapest storage; free egress via the Cloudflare partnership     | Good if storage volume dominates and the CDN pairing is acceptable             |
| AWS S3 + CloudFront | The reference implementation; most operational surface; egress billed both hops | Hardest to justify unless AWS is already the platform                          |

**Verify current pricing before committing** — these are product-model shapes,
not quoted rates, and my knowledge has a cutoff. ADR-059 carries the numbers.

The driver interface does not change: add `createS3Storage()` beside
`createLocalDiskStorage()`; `resolveStorageDriver()` picks on
`MEDIA_STORAGE_DRIVER`. **Local disk stays the development default** so nobody
needs cloud credentials to run the app.

### M2 — Presigned upload, quarantine, and resumable transfer ⟶ ADR-059

`security.md` #9 is explicit: presigned direct-to-S3 "replaces the **transport**,
not the validation". The browser PUTs straight to a bucket, so the server never
sees the bytes at request time — validation happens **after** they land and
**before** the asset is usable.

**Four prefixes** (owner §5). The quarantine and originals prefixes are never
publicly readable:

```
incoming/<uploadId>                              private, quarantine, reaped (below)
originals/<assetId>                              private, EXIF intact, never served
media/<assetId>/v<version>/source.<ext>          sanitized served original
derivatives/<assetId>/v<version>/…               profiles, renditions, HLS
```

`<version>` is the existing `MediaAsset.version` column (M8).

**Flow:**

```
1. POST /admin/api/media/upload-intent
     requirePermission("media.upload")            ← boundary, first line
     validate declared name/size/kind against Media Settings (M9)
     create MediaAsset  status = UPLOADING, uploadExpiresAt = now + TTL
     size < threshold → presigned PUT to incoming/<uploadId>
     size >= threshold → initiate multipart, return upload id

2. Browser transfers bytes directly to storage

3. POST /admin/api/media/upload-complete   (completes multipart if applicable)
     status = VALIDATING; create stage rows; enqueue media.validate

4. Worker: media.validate   (M4)
     FAIL → status = FAILED, delete incoming object, record the reason
     PASS → copy to originals/ and media/, delete incoming,
            status = PROCESSING, enqueue the processing stages
```

**The client's declared MIME type and size are never trusted.** They gate the
intent cheaply; the sniffed bytes decide. A file that lies is deleted in stage 4
and never reaches a served prefix. This is strictly stronger than today's path,
where a validated upload writes straight to the served directory.

**Resumable uploads are a requirement, not a nicety** (owner §9). A 500 MB
course video failing at 95% on a single PUT is the common case, not the edge
case. S3 multipart above a threshold:

```
POST /admin/api/media/upload-intent      → { mode: "put" | "multipart", … }
POST /admin/api/media/multipart/sign-part
POST /admin/api/media/multipart/complete
POST /admin/api/media/multipart/abort
```

Threshold is `media.upload.multipartThresholdBytes` in Media Settings, clamped
in code (M9), defaulting around 50 MB. Parts are retried individually by the
client; an abandoned multipart is cleaned by the reaper below.

**Abandoned-upload reaper** (owner §3). Provider lifecycle rules are a backstop,
not the mechanism — they differ per provider and MinIO in local dev may have
none configured. `media:gc` therefore also sweeps, application-side:

```
MediaAsset.status = UPLOADING AND uploadExpiresAt < now
  → abort any multipart, delete the incoming object, delete the MediaAsset row
```

This covers the three real cases: intent requested and browser closed; upload
started and dropped; upload finished but `/upload-complete` never called.

### M3 — Worker topology: `apps/worker`, BullMQ on the existing Redis ⟶ ADR-060

A new deployable app (`architecture.md` #8's `apps → packages` direction holds —
it imports packages and nothing imports it).

```
apps/
  web/       existing Next.js app — enqueues, never processes
  worker/    NEW — BullMQ consumer; no HTTP surface except /healthz
```

- **Queues:** one per stage, each with its own concurrency, backoff and
  dead-letter policy. Video queues run concurrency 1–2 per worker; image queues
  higher.
- **Idempotency:** every job is keyed `<assetId>:<stage>:<version>`. Re-running a
  completed stage is a no-op. **This is what makes M14's reconciler safe** — a
  duplicate enqueue costs nothing.
- **Partial output is never promoted.** Stages write to a temp key and copy to
  the final key only on success, so a killed transcode leaves nothing servable.
- **Graceful shutdown:** `SIGTERM` finishes the in-flight job or releases its
  lease so the reconciler can pick it up. A killed transcode must never mark an
  asset `READY`.
- **Deployment:** a separate container/process from the web app, scaled
  independently. This is the operational change the owner is buying — the repo
  currently deploys one process.

### M4 — Pipeline: validate does all cheap inspection, then process ⟶ ADR-061

Adopting the owner's §4 restructure. v1 had `media.metadata` as a late stage,
which meant a four-hour video was transcoded before anyone checked its duration.
**Cheap inspection moves into validation so bad input is rejected before any
CPU is spent.**

```
VALIDATE   magic bytes · real size · checksum · dimensions · duration ·
           page count · codec/container · policy limits (M9)
              ↓  reject here, before FFmpeg or Sharp ever runs
OPTIMIZE   images: EXIF strip, dimension clamp, re-encode              (Sharp)
DERIVE     images: profile set   |   video: transcode ladder           (Sharp / FFmpeg)
PACKAGE    video only: HLS segmentation + master playlist              (FFmpeg)
POSTER     thumbnail / poster frame  — may run concurrently with DERIVE
FINALIZE   status = READY, revalidateTag("content")
```

Six stages, not seven. Derived facts that only exist _after_ processing
(rendition sizes, segment counts) are written by the stage that produces them,
onto `MediaDerivative` — there is no separate metadata pass to forget.

Each stage is a discrete function with its own queue, retry policy and row in
`MediaProcessingStage`. A failed `POSTER` retries the poster only. Stages are
declared as an ordered pipeline **per media kind**, so a PDF runs
`VALIDATE → FINALIZE` and never enters an image or video stage.

### M5 — Media statuses ⟶ ADR-061

```
UPLOADING → VALIDATING → PROCESSING → READY
      ↓            ↓           ↓
   (reaped)     FAILED      FAILED          (retryable, per stage)
                                DELETED     (soft, existing deletedAt)
```

**An asset that is not `READY` is never selectable in the picker and never
renders on the public site.** That single rule is what makes async processing
safe to introduce: a half-processed video cannot reach a lesson page.

### M6 — Data model ⟶ ADR-061

```prisma
enum MediaStatus     { UPLOADING VALIDATING PROCESSING READY FAILED }
enum MediaStageName  { VALIDATE OPTIMIZE DERIVE PACKAGE POSTER FINALIZE }
enum MediaStageState { PENDING RUNNING SUCCEEDED FAILED SKIPPED }

model MediaAsset {
  // + status          MediaStatus @default(READY)   // READY keeps existing rows valid
  // + checksum        String?  @db.VarChar(64)      // SHA-256, NON-unique index
  // + storageKey      String?  @db.VarChar(300)     // media/<id>/v<n>/source.<ext>
  // + originalKey     String?  @db.VarChar(300)     // originals/<id> — private
  // + uploadId        String?  @db.VarChar(120)     // intent / multipart correlation
  // + uploadExpiresAt DateTime?                     // reaper (M2)
  // + processedAt     DateTime?
  // + failureReason   String?  @db.VarChar(500)
  // version Int — ALREADY EXISTS; now also the derivative path segment (M8)
  // + @@index([status, createdAt])
  // + @@index([checksum])
  // + @@index([status, uploadExpiresAt])            // the reaper's query
}

model MediaDerivative {
  id          String   @id @default(cuid())
  assetId     String
  version     Int                              // matches MediaAsset.version at generation
  profile     String   @db.VarChar(40)         // thumb|card|content|large|480p|720p|1080p|hls
  format      String   @db.VarChar(20)         // avif|webp|jpeg|mp4|m3u8
  storageKey  String   @db.VarChar(300)
  width       Int?
  height      Int?
  bitrateKbps Int?
  size        Int
  createdAt   DateTime @default(now())

  asset MediaAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([assetId, version, profile, format])
  @@index([assetId, version])
  @@map("media_derivatives")
}

model MediaProcessingStage {
  id             String          @id @default(cuid())
  assetId        String
  version        Int
  stage          MediaStageName
  state          MediaStageState @default(PENDING)
  attempts       Int             @default(0)
  jobId          String?         @db.VarChar(120)  // BullMQ job id — reconciler checks existence
  leaseExpiresAt DateTime?                          // heartbeat lease (M14)
  error          String?         @db.Text
  startedAt      DateTime?
  finishedAt     DateTime?
  durationMs     Int?                               // observability (M10)

  asset MediaAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([assetId, version, stage])
  @@index([state, leaseExpiresAt])                  // the reconciler's query
  @@map("media_processing_stages")
}
```

**Not created:** `media_folders` (ADR-034 §2 settled folder-as-path) and
`media_usages` (`ContentReference` already does this with field-level
precision). The owner's §11 asked for both — the first is superseded by an
existing ADR, the second exists under another name.

**Migration:** pre-launch policy is reset, not backfill.

### M7 — Image profiles ⟶ ADR-061

The owner's §13 set, and **no upscaling**:

| Profile   | Long edge | Formats    |
| --------- | --------- | ---------- |
| `thumb`   | 320       | AVIF, WebP |
| `card`    | 640       | AVIF, WebP |
| `content` | 1280      | AVIF, WebP |
| `large`   | 1920      | AVIF, WebP |

A 500×500 upload produces `thumb` and `card` only. With AVIF and WebP both
emitted, `<picture>` falls back to the sanitized served original — a third
encode per profile is not generated.

**EXIF is stripped from the served original and every derivative.** The
`originals/` copy keeps its metadata and is never publicly readable — that is
the point of retaining it (owner §3, §5) and the reason it cannot be the served
object.

**`next/image` switches to a custom loader** pointing at the CDN, so image
optimization leaves the application server entirely (owner §5).
`images.loader: "custom"` + `loaderFile`; the loader maps a requested width to
the nearest profile at or above it. **Consequence to accept:** arbitrary widths
are gone, so `sizes` values must map onto the five outputs. Anything else rounds
up. Audit existing `sizes` usage before M2.3.

### M8 — Video: ladder, HLS, immutable versioned paths ⟶ ADR-062

```
source
  ↓ VALIDATE   probe: duration, resolution, codec, container
               reject over media.video.maxDurationSeconds BEFORE any transcode
  ↓ DERIVE     H.264/AAC ladder, faststart:  480p ~1.0M · 720p ~2.5M · 1080p ~5.0M
  ↓ PACKAGE    HLS ~6s segments per rendition + master playlist
  ↓ POSTER     frame at 10% duration → MediaAsset IMAGE, linked via posterAssetId
  ↓ FINALIZE   status = READY
```

**Immutable versioned output paths** (owner §6) — adopted, and extended beyond
HLS to _every_ derivative, because the same CDN-caching argument applies to an
image profile after a replace-in-place:

```
derivatives/<assetId>/v3/hls/master.m3u8
derivatives/<assetId>/v3/hls/720p/segment-0001.ts
derivatives/<assetId>/v3/card.avif
```

Never overwrite a versioned path. A replace-in-place bumps
`MediaAsset.version` — **which already exists for exactly this purpose**
(ADR-034 §3) — and writes a fresh tree, so a CDN edge holding v2 can keep
serving it until references move. `media:gc` removes orphaned version trees once
nothing references them.

- **H.264/AAC, not HEVC**: universal playback matters more than bitrate; HEVC in
  HLS narrows the device set.
- **Never upscale.** A 720p source yields 480p + 720p and no 1080p rung.
- **Playback:** Safari plays HLS natively; Chrome and Firefox need `hls.js`.
  That is a client dependency **and a CSP consequence** (M11) — hls.js fetches
  segments over XHR, so the CDN origin needs `connect-src`, not just
  `media-src`.

### M9 — Media settings via `@repo/settings`, clamped in code ⟶ ADR-061

A `media` setting group behind the existing typed reader and `settings:media`
cache tag:

```
media.image.maxUploadBytes        media.video.maxUploadBytes
media.image.maxDimension          media.video.maxDurationSeconds
media.image.avifQuality           media.video.ladder          (minimal|standard|full)
media.image.webpQuality           media.video.hlsEnabled
media.document.maxUploadBytes     media.video.allowedFormats
media.upload.multipartThresholdBytes
```

**Every value is clamped to a code-defined range on write.** An admin who can
set `maxUploadBytes` to 5 GB has a denial-of-service lever and an unbounded
storage bill; the setting chooses _within_ a range the code permits — the same
discipline `@repo/theme` uses for derived colours. The clamp is a Zod
`.min().max()` in `@repo/contracts`, tested.

### M10 — Observability is a deliverable, not a follow-up ⟶ ADR-061

Adopting the owner's §10. The model already carries what is needed:
`MediaProcessingStage.durationMs` per stage, per asset, per version.

**Per asset**, in the admin detail view — the owner's breakdown, rendered from
stage rows:

```
Upload         48.2s
Validation      2.1s
Optimization    1.4s
Transcode      93.4s
HLS             7.2s
Poster          0.8s
────────────────────
Total         103.1s
```

**Fleet-wide**, on `/admin/media/processing` (gated `media.view`): queue depth
per stage, assets by status, failure count and rate over a window, p50/p95 stage
duration, total storage and derivative storage. Storage totals are a periodic
rollup, not a `SUM()` over `media_derivatives` on every page load.

**Failures report into Sentry** (`plan.md` Module 14) rather than into a second
error channel — one place to look. Structured logs carry `assetId`, `stage`,
`version` and `attempt` so a failure is greppable to one asset.

### M11 — CDN, and the CSP change this programme makes ⟶ ADR-059

The constraint changes-11 was written to avoid, now in scope deliberately.
`apps/web/proxy.ts` `baseCsp()`:

```diff
- `img-src 'self' data: https:`
+ `img-src 'self' data: https://<cdn-host>`      ← tightened AND extended
+ `media-src 'self' https://<cdn-host>`          ← new
+ `connect-src 'self' https://<cdn-host>`        ← hls.js segment fetches
```

Two notes:

1. **`img-src` currently allows `https:` wholesale.** Naming the CDN host is the
   opportunity to tighten it, so this change makes the policy stricter overall.
   Do both in one PR.
2. The CSP is still **report-only**. These origins must be right before Module 14
   enforces, or enforcement breaks every image and video on the site. This
   programme hands Module 14 a policy that already names its origins.

`/uploads/[file]` stays for the local driver and local development; in
production the driver returns CDN URLs and that route serves nothing.

### M12 — Deduplication ⟶ ADR-061

SHA-256 computed in `VALIDATE`, **streamed** from storage — never buffered whole
for a 500 MB video. `checksum` is indexed but **not unique**: the picker offers
"Use the existing file / Upload anyway", and the second must stay possible for
independently-deletable copies.

### M13 — Antivirus becomes feasible; still sequenced after HLS ⟶ ADR-061

changes-11 D21 called scanning out of scope because it was an infrastructure
dependency. A worker container changes that: ClamAV can run as a sidecar and a
`SCAN` stage can sit between `VALIDATE` and the processing stages — the right
place, since nothing unscanned would ever be promoted out of quarantine.

**Design the stage boundary now, add the scan after HLS works.** M4's pipeline
is per-kind and ordered, so inserting a stage is additive. Introducing a second
new daemon while also introducing the queue, storage, FFmpeg and CDN is how
programmes stall.

### M14 — MariaDB owns job state; Redis delivers work ⟶ ADR-060

**This corrects v1.** v1 said "Redis becomes load-bearing — losing it loses
in-flight jobs" and treated Redis persistence as the mitigation. The owner is
right that this inverts the ownership model. Redis is the **delivery mechanism**;
`MediaProcessingStage` is the **source of truth**.

```
MariaDB  ── source of truth ──  MediaAsset · MediaProcessingStage
Redis    ── execution/delivery ──  BullMQ queues
```

Losing Redis must be **recoverable, not catastrophic**. Two mechanisms make
that true, and the second is what makes the first correct:

**1. `media:reconcile`** — a periodic job (and a manual `pnpm media:reconcile`):

```
for each MediaProcessingStage where state = PENDING:
      no live BullMQ job for stage.jobId  → re-enqueue (idempotent, M3)

for each MediaProcessingStage where state = RUNNING:
      leaseExpiresAt < now                → orphaned: state = PENDING, re-enqueue
      leaseExpiresAt >= now               → genuinely running: leave alone
```

**2. The lease, with a heartbeat.** Without it the reconciler cannot distinguish
a stage running on a live worker from one orphaned by a crashed worker — it
would either duplicate live transcodes or never recover crashed ones. So a
worker claiming a stage sets `leaseExpiresAt = now + 2 × heartbeatInterval` and
refreshes it on a timer for the duration of the job. A crashed worker stops
refreshing; the lease expires; the reconciler reclaims it. `SIGTERM` releases the
lease immediately so a rolling deploy recovers in seconds rather than waiting out
a timeout.

Redis persistence (`appendonly`) is still worth enabling — it makes recovery
rarer. It is no longer the thing standing between the system and data loss.

**Consequence for the queue-depth metric (M10):** queue depth read from Redis is
a _liveness_ signal; the authoritative backlog is
`count(MediaProcessingStage where state IN (PENDING, RUNNING))`. Show both — a
large divergence is precisely the symptom that says "run the reconciler".

---

## 4. Package and app architecture

Adopting the owner's §6 and §8 — explicit interfaces, so processing is testable
without Redis, FFmpeg or a network.

```
packages/
  storage/   NEW  StorageDriver (+ local, S3), presigned PUT/GET, multipart, key discipline
  media/     NEW  the processors and the stage functions — pure, no queue knowledge
  jobs/      NEW  BullMQ queue definitions, enqueue helpers, dispatcher, reconciler
  core/      media services orchestrate: create record → enqueue → read state
apps/
  web/       enqueues; never processes
  worker/    NEW  BullMQ consumer; imports @repo/jobs + @repo/media
```

**Interfaces (owner §8).** Every stage takes injected dependencies; no stage
reaches for a binary or a bucket itself:

```ts
interface StorageDriver {
  put;
  get;
  getStream;
  delete;
  copy;
  presignPut;
  presignGet;
  createMultipart;
  signPart;
  completeMultipart;
  abortMultipart;
}
interface ImageProcessor {
  probe;
  sanitize;
  derive;
} // Sharp impl
interface VideoProcessor {
  probe;
  transcode;
  package;
  poster;
} // FFmpeg impl
interface MetadataExtractor {
  probe;
} // delegates by kind
interface ChecksumComputer {
  sha256FromStream;
}
```

Two boundaries that must hold:

- **`@repo/media` must not import `@repo/jobs`.** Stages are plain async
  functions over `(assetId, version, deps)`; the queue calls them. That keeps
  every stage unit-testable without Redis and makes M13's later insertion
  trivial.
- **`@repo/storage` and `@repo/media` must not import Next.js**
  (`architecture.md` #10). The worker is not a Next app and must not need one.
  This is also what would let a future `apps/mobile` upload through the same
  validation.

**The FFmpeg provider is swappable behind `VideoProcessor`** (owner §7). If
`ffmpeg-static` proves bad on Windows, the fallback is a different provider —
system FFmpeg on `PATH`, `@ffmpeg-installer/ffmpeg`, or a container-based
processor for local dev — and **the architecture does not change**. Only the
implementation behind the interface does.

---

## 5. Admin UI

Extends the existing library and picker; no second surface.

- **Upload** — progress from the direct transfer (per-part for multipart), then
  a status chip polling `GET /admin/api/media/[id]/status` while not `READY`.
- **Library** — status column; non-`READY` rows visible but not selectable.
- **Detail** — per-stage list from `MediaProcessingStage` with duration, attempt
  count and error text, a **Retry** action per stage (`media.update`), and the
  derivative list with sizes and version.
- **Processing dashboard** — `/admin/media/processing`, the M10 fleet metrics.
- **Settings** — `/admin/settings/media`, the M9 group, with the code-defined
  ranges shown as helper text so the clamp is visible rather than mysterious.

ADR-044 applies: no raw identifiers (stage and status enums via catalog strings
or `humanizeKey()`), `ConfirmDialog` on delete, **retry is not confirmed** — it
is the recovery path, and gating recovery is exactly the ADR-044 #7 error.

---

## 6. Phases

Run in parallel with changes-11 Phases 1–5, which stay on the local driver (§1.1).

### Phase M0 — Decisions and a spike

ADR-059 (provider with real pricing, CDN, CSP), ADR-060 (worker topology, state
ownership, reconciler, dev/CI), ADR-061 (pipeline, model, settings,
observability), ADR-062 (ladder, HLS, FFmpeg provider).

**Spike, on the actual Windows dev machine, before ADR-062 is accepted**
(owner §7): `ffmpeg-static` installs · `ffmpeg -version` runs · MP4 → MP4
transcode · MP4 → HLS. A failure here changes the **provider**, not the plan —
ADR-062 records which provider won and why.

### Phase M1 — Extract the seams

- **M1.1** `@repo/storage`: move `StorageDriver`, `createLocalDiskStorage`, key
  discipline out of `@repo/core/media.ts`. No behaviour change; existing tests
  pass untouched. This refactor de-risks everything after it.
- **M1.2** `@repo/media`: validation and sniffing move across behind
  `ImageProcessor` / `MetadataExtractor` / `ChecksumComputer`; add Sharp (EXIF
  strip, clamp, dimension extraction) and checksum. Still synchronous, still
  called by `storeMedia()`. **Ships real value even if the programme stops
  here** — EXIF stripping closes a live privacy leak.

### Phase M2 — Object storage and upload

- **M2.1** `createS3Storage()`; `MEDIA_STORAGE_DRIVER`; MinIO in
  docker-compose; a conformance suite run against **both** drivers.
- **M2.2** Presigned intent/complete, four prefixes, `MediaStatus`,
  `storageKey`/`originalKey`, `uploadExpiresAt` + reaper. Validation still runs
  inline — **no queue yet**, so the security model is proven before async is
  added.
- **M2.3** Multipart/resumable upload above the configurable threshold.
- **M2.4** CDN origin, `next/image` custom loader, CSP change (M11, including
  the `img-src` tightening).

### Phase M3 — Queue, worker, and recovery

- **M3.1** `@repo/jobs` + `apps/worker`: queues, dispatcher, retry/backoff/DLQ,
  lease + heartbeat, graceful shutdown.
- **M3.2** Move validation into `media.validate`; add `MediaProcessingStage`
  and `media.finalize`. The pipeline runs asynchronously for existing kinds
  **before** any new media type is added.
- **M3.3** `media:reconcile` (M14) + the Redis-loss drill in §7.
- **M3.4** Admin status chips, per-stage retry, polling endpoint.

### Phase M4 — Image derivatives and settings

- **M4.1** `OPTIMIZE` + `DERIVE` producing the M7 profiles; `MediaDerivative`
  with versioned keys.
- **M4.2** Loader maps widths to profiles; `<picture>` AVIF/WebP/original.
- **M4.3** Media Settings group (M9) with clamps.
- **M4.4** Observability (M10): per-asset timings, processing dashboard.

### Phase M5 — Video

- **M5.1** Video validation in `VALIDATE`: duration, resolution, codec,
  container, format allowlist — all before any transcode.
- **M5.2** `DERIVE` ladder + `POSTER`.
- **M5.3** `PACKAGE` HLS + master playlist, immutable versioned paths.
- **M5.4** Player: `hls.js` with native-HLS detection, poster, captions track
  slot. Wire into the changes-11 lesson template as a **third** video source
  beside embed and external — embeds are not removed.

### Phase M6 — Hardening

`media:gc` extended to derivatives, orphaned version trees and abandoned
multiparts; concurrent-transcode load test; the failure drills in §7; Module 14
handoff for CSP enforcement and the Redis/storage runbook; `media.scan` (M13)
if the owner wants it now.

---

## 7. Criterion → test

| Criterion                                                               | Test                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Driver extraction changes no behaviour                                  | Existing media suite passes unmodified after M1.1                                          |
| Both drivers satisfy one contract                                       | Conformance suite against local disk and MinIO                                             |
| **A lying upload never reaches a served prefix**                        | Integration: PUT an `.exe` renamed `.jpg` → FAILED, object deleted, nothing under `media/` |
| **Quarantine and originals are not publicly readable**                  | Integration against MinIO ACLs, both prefixes                                              |
| Presigned URL expires                                                   | Integration: PUT after TTL → rejected                                                      |
| Intent requires `media.upload`                                          | Integration: subject without it → 403 **before** any URL is minted                         |
| **Abandoned upload is reaped**                                          | Integration: intent, no PUT, advance clock → object and row gone (M2)                      |
| **Interrupted multipart resumes**                                       | Integration: upload parts, drop, resume, complete → checksum matches source (M2)           |
| **Oversize/over-length video rejected before FFmpeg runs**              | Integration: assert `VideoProcessor.transcode` never invoked (M4)                          |
| **EXIF stripped from served original and every derivative**             | Unit: GPS-tagged JPEG in, no EXIF out; `originals/` copy still has it                      |
| Oversized image clamped; small image not upscaled                       | Unit on the profile generator                                                              |
| Checksum dedup detected, duplicate still permitted                      | Integration                                                                                |
| **A killed worker never leaves an asset READY**                         | Integration: SIGKILL mid-derive → PROCESSING, no partial served key                        |
| **A crashed worker's stage is reclaimed**                               | Integration: expire the lease, run reconcile → stage re-enqueued (M14)                     |
| **A live worker's stage is NOT reclaimed**                              | Integration: heartbeat current, run reconcile → no duplicate enqueue (M14)                 |
| **Losing Redis loses no work**                                          | Integration: enqueue, FLUSHALL, reconcile → every stage completes (M14)                    |
| Stage retry is isolated                                                 | Integration: fail `POSTER` → poster retries, derive does not rerun                         |
| Job idempotency                                                         | Integration: enqueue the same stage twice → one effect                                     |
| DLQ captures a permanently failing job with its error                   | Integration; the error surfaces in the admin stage row                                     |
| **Settings clamp holds**                                                | Unit: write above the code ceiling → rejected                                              |
| Video ladder never upscales                                             | Unit: 720p fixture → 480p + 720p only                                                      |
| **Replace-in-place writes a new version tree, overwrites nothing**      | Integration: v1 keys still readable after a v2 replace (M8)                                |
| HLS master lists every rendition and plays                              | Integration on the playlist; E2E in Chrome (hls.js) and Safari (native)                    |
| **CSP names every origin the page loads**                               | E2E: zero report-only violations on a lesson page with an image and a video                |
| `media:gc` spares referenced assets, live derivatives, current versions | Unit + integration, dry-run and commit                                                     |
| Per-stage durations recorded                                            | Integration: `durationMs` populated for every succeeded stage (M10)                        |
| Transcode fixtures keep CI fast                                         | 2-second 320×240 clip; CI wall-clock budget on the media job                               |

Coverage floors: `@repo/storage` and `@repo/media` are pure-logic packages —
**90%** (`testing.md` #1). `@repo/jobs` 80%.

---

## 8. Local development and CI

- `docker-compose.yml` gains **MinIO** so presigned and multipart uploads work
  offline without cloud credentials. Redis is already there.
- `pnpm dev` starts web **and** worker (Turborepo); the worker needs a watch
  entrypoint.
- FFmpeg comes from the M0 spike's chosen provider, behind `VideoProcessor`.
- CI gains Redis and MinIO services. Transcode tests use a **2-second, 320×240
  fixture**, never a real course video.
- `pnpm-workspace.yaml` `onlyBuiltDependencies` needs entries for `sharp` and
  the FFmpeg provider. `security.md` #15 says do not add casually — named here
  so it is a reviewed change, not a review surprise.

---

## 9. Risks

1. **This is now the largest subsystem in the project**, larger than the
   learning area it serves. §1.1's parallel sequencing is the mitigation.
2. **FFmpeg on Windows is unproven here.** M0 spikes it; a failure changes the
   provider, not the architecture (M4 §4).
3. **CSP enforcement is downstream.** Module 14 enforces the policy this
   programme writes; wrong origins break at enforcement, not at merge. The
   report-only soak is the safety net — read it.
4. **Cost is unbounded until M9's clamps land.** Ship clamps with the settings,
   not after.
5. **`next/image` custom loader is a one-way door for arbitrary widths** (M7).
   Audit `sizes` usage in `@repo/ui` and the public routes before M2.4.
6. **Storage is a vendor commitment.** The driver seam makes migration possible,
   not free — moving terabytes later is a project.
7. **The reconciler is only as good as the lease.** If heartbeat refresh is
   buggy, it either duplicates live transcodes or never recovers crashed ones.
   The two paired tests in §7 (live stage untouched / expired stage reclaimed)
   are the ones to keep green.

## 10. What this programme still does not build

Per-tenant storage isolation · signed/expiring URLs for premium content (needs
the entitlement model ADR-012 defers) · live streaming · DRM · subtitle
generation or transcription · image AI (alt text, smart cropping) · a second CDN
for failover · multi-region replication.

## 11. Impact on changes-11

| changes-11 item        | Now                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------ |
| D19 (no variants)      | **Superseded** by M7 — variants generated and CDN-served                             |
| D20 (route handler)    | **Superseded** by M2 — presigned + multipart replaces both transports                |
| D22 (embed-only video) | **Superseded** by M8 — self-hosted HLS added; embeds retained beside it              |
| D23 (dedup, folders)   | Dedup **superseded** by M12; folder-as-path **stands**                               |
| Phase 3 PR 3.5         | **Replaced** by Phases M1–M4                                                         |
| Phase 8                | **Replaced** by this document                                                        |
| §12 "no CSP change"    | **No longer true** — M11 makes it deliberately and tightens `img-src` in the same PR |
| D9 (no video resume)   | Its rationale expires at M5.4 — see changes-11 §17                                   |
| Everything else        | Stands unchanged                                                                     |
