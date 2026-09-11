# changes-16 — plan: the Videos section (video topics, categories, links)

**Status:** **accepted by the owner, 2026-09-09.** All six §9 questions are
answered (§9 records each), execution order confirmed as ADR-068 → PR 0 → PR 1.
**Date:** 2026-09-09
**Brief:** `docs/changes/changes-16-topics adds.md` (owner, 2026-09-09) plus
`docs/changes/image-26.png`, the reference page it points at.
**Modules:** 11 (content), 12 (public site), 09 (admin shell), 08 (navigation).
**Relationship to changes-11:** additive. It adds a FOURTH surface to the learn
area beside Courses, Quizzes and Glossary, on the machinery Phases 3–6 built.
Nothing there is revised.
**Relationship to changes-12:** none, and that is deliberate. This plan stores
uploaded video the way the repository already stores it — one object, one
`MediaAsset` row, served by `/uploads/[file]` with Range support. changes-12
replaces that transport later without touching a line written here (§4).
**Relationship to changes-13:** consumes it. The video picker is the paged media
picker, restricted to `kind: VIDEO`. This plan adds no second browse path.

> **A video topic is a page whose subject is a video. It is not a lesson, it
> does not belong to a course, and nothing about it is graded.**

That sentence decides most of what follows, including everything in §4.

---

## 0. The brief, read literally

The owner's four lines, each mapped to a decision below:

| Brief                                                                     | Becomes                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------- |
| "add topic … title, description with full editors, thumbnail, … seo"      | `VideoTopic` + `VideoTopicTranslation` (D2, D3)    |
| "can attach external videos, upload videos etc"                           | `VideoTopicVideo`, exactly-one-of source (D6)      |
| "attach link with text may be external or internal site link"             | `VideoTopicLink` (D7)                              |
| "a crud to add topic category & then attach many videos under that topic" | `VideoCategory` + its admin manager (D4, PR 4)     |
| "on the public site there should be display that topics like that"        | `/learn/[track]/videos` + detail page (D5, PR 7–8) |

**And what image-26 actually shows**, since "like that" is doing real work: a
title band, one embedded player, a view count, a share row, a paragraph of
description, and a promo panel beside it. The owner scoped this on 2026-09-09 to
**player + body + links + related**. View count, share row and the promo panel
are out (§4) — the first of those is not a label, it is a write on a cached page.

---

## 1. What already exists (verified against the repo, 2026-09-09)

Every path below was opened before this plan was written. This section is the
reason the plan is as short as it is: almost nothing here is new machinery.

| Need                            | Already in the repo                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video **upload**                | `storeMedia()` — magic-byte sniffing (`sniffIsoBmff`/`sniffWebm`), `MediaKind.VIDEO`, 100 MB cap from `media.maxBytes.video`, `packages/core/src/media.ts:391` |
| Video **serving**               | `apps/web/app/uploads/[file]/route.ts` — `Accept-Ranges: bytes` and 206 slices via `readStoredFileRange()`                                                     |
| **External** video              | `parseVideoUrl()` — YouTube/Vimeo/Dailymotion whitelist, iframe rebuilt at render, never stored (`packages/utils/src/video-embeds.ts:107`)                     |
| Provider **CSP**                | `frame-src` already names all three embed origins (`apps/web/proxy.ts:57`). Self-hosted video is same-origin. **No CSP change in this programme.**             |
| Play **facade**                 | `VideoFacade` — thumbnail + play button, iframe injected on click (`app/(public)/[locale]/news/_components/video-facade.tsx`)                                  |
| Rich body + **sanitize**        | `RichTextEditor`, `sanitizeRichText()` (`packages/core/src/content.ts:195`)                                                                                    |
| **SEO** panel                   | `_components/editor/seo-analysis.tsx`, shared since changes-11                                                                                                 |
| **Status** machine              | `CONTENT_TRANSITIONS` + `transitionContentStatus()` — one function, entity-keyed                                                                               |
| **Slug redirects**              | `createSlugRedirect()`, and `saveQuiz`'s track-change precedent (`packages/core/src/quizzes.ts:514`)                                                           |
| **Media picker**                | `media-picker-dialog.tsx`, paged, kind-filtered (changes-13)                                                                                                   |
| **Media in-use guard**          | `ContentReference` + `deleteMedia()`                                                                                                                           |
| **Category** CRUD shape         | `GlossaryTopic`/`GlossaryTopicTranslation` + `glossary/topics/topics-manager.tsx`                                                                              |
| Internal/external **link** rule | `menuItemLinkSchema`'s exactly-one-of refinement (`packages/contracts/src/navigation.ts`)                                                                      |
| Track **routing**               | `LEARN_TRACKS`, `ROUTE_PATHS`, `LEARN_TRACK_ROUTE_KEYS`, `learnSectionsFor()` (ADR-065)                                                                        |
| Card **stretched-link** rule    | `CourseCard` / `QuizCard` and their guard tests                                                                                                                |

**Two things do not exist and are assumed nowhere:** a view counter (`viewCount`
is a column on `Lesson` and `GlossaryTerm` that nothing reads or writes), and a
share component.

---

## 2. Three corrections to the brief

### 2.1 — "Topic" was already taken twice. The reader-facing word is **Videos**.

`GlossaryTopic` is a topic. The learn shelf's track chips say "All topics /
Forex / Crypto". A third meaning in the same product is a cost paid on every
future conversation about it. **Owner decided 2026-09-09:** the section is
**Videos**, the entity is `VideoTopic`, the grouping is `VideoCategory`, and the
routes are `/learn/[track]/videos/…`.

### 2.2 — Upload already works. There is nothing to build for it here.

The brief reads as though "upload videos" is new capability. It is not:
`storeMedia()` accepts MP4/WebM up to 100 MB today, decided by magic bytes, and
`/uploads/[file]` already streams with byte ranges. This plan **attaches** a
`MediaAsset` to a topic. It adds no upload path, no queue, no transcode — doing
any of that here would collide head-on with changes-12 (§4).

### 2.3 — A topic needs a track, because it needs a URL.

ADR-065 §3 settled this for quizzes: a canonical URL cannot be built from a
null. `VideoTopic.track` is **required** for exactly the same reason, and moving
a topic between schools writes a redirect exactly as a slug rename does. The
_category_, by contrast, is taxonomy and spans tracks — `/learn/forex/videos/
categories/metatrader` is a filtered view onto it, the same relationship
`/learn/[track]/glossary` has with `/glossary`.

---

## 3. Decisions

### D1 — Videos are a fourth learn section, per track ⟶ ADR-068

`/learn/[track]/videos`, sitting between Courses and Quizzes in the section bar.
Not a top-level `/videos`: the header already offers "Learn Forex" and "Learn
Crypto" as schools (ADR-065), and a video library outside that split would be the
one learning surface that ignores the split.

**Consequences, all mechanical:** two `ROUTE_PATHS` keys
(`learn-forex-videos`, `learn-crypto-videos`), a `videos` entry in both halves of
`LEARN_TRACK_ROUTE_KEYS`, one line in `learnSectionsFor()`, two
`MEGA_MENU_ICONS` entries, the two mega panels' `routeKeys` arrays, the seeded
menu trees, and `footer_learn`. `packages/contracts/src/learn.test.ts` already
fails on any half of that left undone — that is the guard CLAUDE.md advertises,
and this plan deliberately does not add a second one.

### D2 — `VideoTopic` is a new content entity, not a Lesson variant ⟶ ADR-068

A lesson lives in a section, inside a course, carries a completion rule, feeds
`LessonProgress`, and can gate a course's completion on a quiz. A video topic has
none of that. Modelling one as the other means every video needs a synthetic
course and a synthetic section, and every course-completion and analytics query
grows a clause to exclude them.

**What it DOES reuse, rather than redefine:** `ContentStatus` and the seven-state
machine, `FeatureVisibility`, the translation + `sourceHash` + `translationStatus`
shape, `Redirect` on slug change, `ContentReference` for media, and the
`content` cache tag. `ContentEntity` in `packages/core/src/content.ts:59` gains
`"videos"`, and `ENTITY_DELEGATE`/`ENTITY_PUBLISH_PERMISSION` gain one row each.
That is the whole cost of joining the machine.

### D3 — Videos reuse the `lessons.*` permission keys ⟶ ADR-068

Precedent, twice: quizzes (ADR-058 #8) and glossary topics (D27) both reuse an
existing group rather than adding keys no role holds. Adding `videos.view/create/
update/delete/publish` means five seed rows, three role grants, and a migration
of the seeded roles — for an authorship boundary nobody has asked for.

**The cost, named:** video authorship cannot be granted independently of lesson
authorship. A `videos.*` group is the additive fix the day that matters, and
`ENTITY_PUBLISH_PERMISSION` is already the indirection that makes it a one-line
change.

`check:permission-keys` stays green because no new key is introduced.

### D4 — A category is a row with translations; it mirrors `GlossaryTopic` exactly

`VideoCategory` + `VideoCategoryTranslation`, field for field the shape
`GlossaryTopic` uses (which itself mirrors `ArticleCategory`). Same `isActive` +
`sortOrder`, same `@@unique([locale, slug])`, same keyboard-only reorder, and the
admin screen is `topics-manager.tsx` with the nouns changed.

**Not free text.** `Quiz.category` is a string and `categoryTone()` has to hash
it because there is no registry to enumerate. A video category needs a slug, a
description and SEO fields — it is a page — so it is a row.

### D5 — Two public routes, plus a category view

| Route                                         | Renders                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| `/learn/[track]/videos`                       | masthead + counted strip, category chips, grid of topic cards  |
| `/learn/[track]/videos/[topic]`               | the image-26 page: player, body, links, related rail           |
| `/learn/[track]/videos/categories/[category]` | the same grid, narrowed, with the category's own title and SEO |

`categories` is a static segment ahead of `[topic]`, so it becomes a reserved
video slug (D8). The detail page keeps the short URL — it is the page that gets
linked to.

### D6 — A video row carries exactly one source ⟶ ADR-068

`VideoTopicVideo` holds `assetId` (a `MediaAsset` of `kind: VIDEO`) **or**
`externalUrl`, never both and never neither — a `.refine()` in contracts, the way
`menuItemLinkSchema` already does it, so the admin form, the action and the
service fail identically.

Render follows the source and nothing else: `assetId` → a `<video controls>`
pointed at `/uploads/…` with a poster; `externalUrl` → `parseVideoUrl()` then
`VideoFacade`. A URL that fails the parse renders **nothing** and is rejected at
save, never echoed into markup (security.md #9).

The per-row `title` is display-only and **not translatable**, following
`LessonAttachment.label`'s recorded reasoning — a translatable label is deferred
until an editor asks for one.

### D7 — A link is a label plus one href, internal or external ⟶ ADR-068

The brief's "may be external or internal site link" is the exactly-one-of rule
`menuItemLinkSchema` already encodes, with one widening: an editor linking to a
specific course cannot use a `routeKey`, because `ROUTE_PATHS` holds static
routes only. So:

```ts
export const videoTopicLinkSchema = z.object({
  label: z.string().trim().min(1).max(200),
  // Exactly one, enforced by refine — never both, never neither.
  path: internalPathSchema.nullish(), // "/learn/forex/price-action"
  url: externalUrlSchema.nullish(), // https only, already in learn.ts
});
```

`internalPathSchema` rejects anything not starting with a single `/`, which is
what keeps `//evil.example` (a protocol-relative URL) out of an "internal" field.
Internal links render through `@repo/i18n`'s `Link` so they carry the locale
prefix; external ones get `target="_blank" rel="noopener noreferrer"` and the
existing "opens in new tab" screen-reader string. **Whether a link is external is
derived at render, never stored.**

### D8 — Reserved slugs, both directions

- `videos` joins `RESERVED_COURSE_SLUGS` — otherwise a course slugged `videos`
  is unreachable behind the static segment, discovered at read time.
- `categories` becomes `RESERVED_VIDEO_SLUGS`, for the same reason one level down.

Both are write-time rejections in contracts, matching ADR-055 #3.

### D9 — A topic must carry a capability

At least one video **or** a non-empty body. This is `lessonInputSchema`'s rule
with the same justification: without it, an empty page can be published. A topic
with a body and no video is legitimate (a written guide filed under a category);
a topic with neither is a bug someone will find on the public site.

### D10 — A new `videos` feature flag, seeded OFF until the routes exist

`["content", "videos", "Videos", …]` in `FEATURE_FLAGS`. The section bar's
contract is that **a flag-off section is ABSENT, not disabled** (D25), so seeding
it off lets D1's registry wiring land in PR 1 without a tab that 404s until PR 7
flips it on.

changes-11 rule #3 forbade new flags **within that programme**, whose registries
were already sufficient. A new public section is exactly the case a flag exists
for; this is a deliberate registry addition, not a drift.

Note for whoever runs it: a new seed row needs `pnpm db:reset` to appear, as
recorded for the homepage stub sections.

### D11 — Cached reads, session-free, `content` tag

`getVideoTopics()` / `getVideoTopicBySlug()` carry `"use cache"` +
`cacheTag("content")` + `cacheLife({ revalidate: 300 })`, copied from
`getStandaloneQuizzes`. **No new cache tag** — architecture.md #12 freezes the
list and a video topic is content. No session read on any public video page
(ADR-056 #1); there is nothing per-learner on them, which is one benefit of §4's
scope.

### D12 — Media placements are mirrored into `ContentReference`

`ReferenceSourceType` gains `VIDEO_TOPIC`. Every `assetId` (cover, uploaded
video, poster) writes a `MEDIA` reference inside the same transaction as the
save, so `deleteMedia()`'s in-use guard refuses to delete a video that a
published page is playing. This is ADR-035's wiring, not a new mechanism —
omitting it is how a published page loses its video silently.

---

## 4. What this plan does **not** build

Each of these is a deliberate exclusion with a reason, not an oversight.

1. **View counts.** image-26 shows "372 views". A counter is a write on a page
   that ADR-056 #1 requires to stay cached, so it is an island plus a POST
   endpoint plus rate limiting plus abuse handling — the exact shape progress
   was forced into. Owner scoped it out on 2026-09-09. The dead `viewCount`
   columns are left dead.
2. **Share row.** Scoped out. No component exists; it is genuinely small and can
   be its own change later, shared with `/news`.
3. **Sidebar promo panel.** Scoped out. `_content/practice-cta.ts` already holds
   this content if it is wanted later.
4. **Progress, completion, enrollment.** A video topic is not a lesson (D2).
   Nothing here touches `LessonProgress`, `CourseEnrollment` or
   `recomputeCourseCompletion`.
5. **Transcoding, derivatives, poster generation, CDN, adaptive bitrate,
   captions.** All changes-12. One object, one row, one `<video>` element.
6. **A second upload path or a second media browser.** The picker is
   changes-13's, kind-filtered. `listMediaAssets`' bounded-page invariant
   (ADR-067) is not widened.
7. **Playlists, autoplay-next, chapters, comments.**
8. **Drag-and-drop reorder.** Keyboard-only, plan 8.2, no new dependency.
9. **Locale activation.** Only `en` is active (ADR-043 #3). Catalog keys land in
   `en.json`; the `learn` namespace is public, so the moment another locale is
   activated its keys are required, and `check:catalog-completeness` enforces it
   then.

---

## 5. Schema

One migration, `add_video_topics_adr068`. Pre-launch policy: `pnpm db:reset`,
no backfill script.

```prisma
model VideoCategory {
  id        String   @id @default(cuid())
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  translations VideoCategoryTranslation[]
  topics       VideoTopic[]

  @@index([isActive, sortOrder])
  @@map("video_categories")
}

model VideoCategoryTranslation {
  id         String  @id @default(cuid())
  categoryId String
  locale     String  @db.VarChar(10)
  name       String  @db.VarChar(100)
  slug       String  @db.VarChar(150)
  description    String? @db.VarChar(500)
  seoTitle       String? @db.VarChar(70)
  seoDescription String? @db.VarChar(180)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category VideoCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([categoryId, locale])
  @@unique([locale, slug])
  @@map("video_category_translations")
}

model VideoTopic {
  // SetNull, not Cascade: deleting a category must never delete the pages
  // filed under it — the same call Lesson.quizId makes.
  categoryId   String?
  // Required (D3 / ADR-065 §3): the URL's second segment, not a filter.
  track        String            @db.VarChar(20)
  coverAssetId String?           // MediaAsset id as a plain String (ADR-035)
  id           String            @id @default(cuid())
  status       ContentStatus     @default(DRAFT)
  visibility   FeatureVisibility @default(PUBLIC)
  authorId     String?
  publishedAt  DateTime?
  sortOrder    Int               @default(0)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  deletedAt    DateTime?

  category     VideoCategory?          @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  translations VideoTopicTranslation[]
  videos       VideoTopicVideo[]
  links        VideoTopicLink[]

  @@index([status, publishedAt])
  @@index([track, status])
  @@index([categoryId, sortOrder])
  @@map("video_topics")
}

model VideoTopicTranslation {
  id      String @id @default(cuid())
  topicId String
  locale  String @db.VarChar(10)

  title   String  @db.VarChar(255)
  slug    String  @db.VarChar(255)
  summary String? @db.Text
  content String? @db.LongText // sanitized on save (security.md #8)

  seoTitle        String? @db.VarChar(70)
  seoDescription  String? @db.VarChar(180)
  seoFocusKeyword String? @db.VarChar(100)

  translationStatus TranslationStatus @default(DRAFT)
  sourceHash        String?           @db.VarChar(64)
  translatedBy      String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  topic VideoTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([topicId, locale])
  @@unique([locale, slug])
  @@index([translationStatus])
  @@map("video_topic_translations")
}

// Exactly one of assetId / externalUrl is set (D6) — enforced in contracts,
// because MariaDB CHECK constraints are not in this repo's vocabulary and a
// second enforcement point that can disagree is worse than one that cannot.
model VideoTopicVideo {
  id            String  @id @default(cuid())
  topicId       String
  sortOrder     Int     @default(0)
  assetId       String? // MediaAsset, kind VIDEO
  externalUrl   String? @db.VarChar(500)
  posterAssetId String? // MediaAsset, kind IMAGE — the uploaded video's poster
  title         String? @db.VarChar(200) // display-only, not translatable (D6)
  createdAt     DateTime @default(now())

  topic VideoTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@index([topicId, sortOrder])
  @@map("video_topic_videos")
}

model VideoTopicLink {
  id        String   @id @default(cuid())
  topicId   String
  sortOrder Int      @default(0)
  label     String   @db.VarChar(200)
  path      String?  @db.VarChar(500) // site-relative, leading "/" (D7)
  url       String?  @db.VarChar(500) // https only
  createdAt DateTime @default(now())

  topic VideoTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@index([topicId, sortOrder])
  @@map("video_topic_links")
}
```

Plus: `enum ReferenceSourceType` gains `VIDEO_TOPIC` (D12).

**`track` is a `String`, not an enum** — matching `Course.track` and `Quiz.track`.
The registry is code (ADR-042/ADR-055 #2); a database enum would be a second
source of truth for the track list.

---

## 6. PRs

Sequential. Do not start PR _n+1_ until PR _n_'s tests are green.

### PR 0 — Move `VideoFacade` out of `news/`

`app/(public)/[locale]/learn/[track]/[course]/[lesson]/page.tsx:26` imports
`../../../../news/_components/video-facade.tsx`. That is a learn page reaching
four levels up into another section's private folder, and this plan would make it
three consumers. Move it to `app/(public)/[locale]/_components/video-facade.tsx`,
update both importers, and fold in the near-duplicate `video-tile.tsx` **only if
it is a pure superset** — if it is not, leave it and say so in the DEVLOG.

_Files:_ the moved component, `news/[slug]/page.tsx`, the lesson page.
_Tests:_ existing suites must stay green; no new behaviour.

### PR 1 — Contracts: registries, schemas, paths

_Files:_ `packages/contracts/src/navigation.ts`, `learn.ts`, `videos.ts` (new),
`index.ts`, `learn.test.ts`, `videos.test.ts` (new).

- `ROUTE_PATHS`: `"learn-forex-videos": "/learn/forex/videos"`,
  `"learn-crypto-videos": "/learn/crypto/videos"`.
- `LEARN_TRACK_ROUTE_KEYS`: `videos` on both tracks; widen the
  `satisfies Record<…>` type.
- `RESERVED_COURSE_SLUGS` gains `"videos"`; new `RESERVED_VIDEO_SLUGS =
["categories"]` with `isReservedVideoSlug()`.
- Path helpers, split the way this repo already splits them — do not put all
  three in one place:
  - `learnTrackVideosPath(track)` in **contracts**, beside
    `learnTrackQuizzesPath` — a static section path with no locale logic.
  - `videoTopicPath(locale, defaultLocale, track, slug)` and
    `videoCategoryPath(…)` in **`@repo/core/content.ts`**, beside `coursePath`
    and `lessonPath`, which is where a path that carries the locale prefix and
    feeds `createSlugRedirect` belongs. (`quizPath` is module-private in
    `quizzes.ts:201`; these two are used by more than one module, so they are
    exported from `content.ts` like their neighbours.)
- Schemas: `internalPathSchema`, `videoTopicLinkSchema`, `videoSourceSchema`
  (the exactly-one-of refine), `videoTopicVideoSchema`, `videoTopicMetaSchema`,
  `videoTopicTranslationSchema`, `createVideoTopicSchema`,
  `videoTopicInputSchema` (with D9's capability refine),
  `videoCategoryInputSchema`, and the `VideoTopicView` / `VideoTopicCardView` /
  `VideoCategoryView` interfaces the public pages read.

_Tests:_ `learn.test.ts` **must be edited, not merely re-run** — its drift check
is not generic. Three places hardcode the current three surfaces:

- `["index", "quizzes", "glossary"] as const` in "gives every registered track
  its three route keys" — add `"videos"`.
- the regex `/^learn-([a-z0-9-]+?)(?:-quizzes|-glossary)?$/` in "registers no
  learn-\* route key for an unregistered track" — without `|-videos` it captures
  the track as `forex-videos` and the test fails with a misleading message.
- "builds the same paths the registry stores" — add the
  `learnTrackVideosPath` assertion.

Then: reserved slugs rejected (`videos` as a course slug, `categories` as a
topic slug); exactly-one-of source accepted/rejected in all four combinations;
`internalPathSchema` rejects `//evil.example`, `https://…`, `javascript:` and
the empty string; capability rule.

### PR 2 — Schema, migration, seed

_Files:_ `packages/db/prisma/schema.prisma`, the new migration,
`packages/db/prisma/seed.ts`.

- §5's models and the `ReferenceSourceType` value.
- `FEATURE_FLAGS`: `["content", "videos", "Videos", false, "PUBLIC"]` — **off**
  until PR 7 (D10).
- Demo content: two categories and three topics per track, one external and one
  uploaded-source topic among them, so PR 7–10 have something real to render.
  Uploaded-source demo rows reference no bytes; they seed with `externalUrl`.
- **No permission rows.** D3.

_Tests:_ `pnpm db:reset && pnpm db:seed` clean; `@repo/db` suite green.

### PR 3 — Core: the service

_Files:_ `packages/core/src/videos.ts` (new), `content.ts` (three one-line
additions), `index.ts`, `videos.integration.test.ts` (new, Testcontainers).

```ts
// admin
listVideoTopicsAdmin(filter?: { track?; categoryId?; status?; search? }): Promise<VideoTopicAdminRow[]>
getVideoTopicAdmin(id: string, locale: string): Promise<VideoTopicAdminDetail | null>
createVideoTopic(actor: Subject, input: CreateVideoTopicInput): Promise<string>
saveVideoTopic(actor: Subject, input: VideoTopicInput): Promise<void>
setVideoTopicDeleted(actor: Subject, id: string, deleted: boolean): Promise<void>
listVideoCategoriesAdmin(): Promise<VideoCategoryAdminRow[]>
saveVideoCategory(actor: Subject, input: VideoCategoryInput): Promise<string>
setVideoCategoryActive(actor: Subject, id: string, active: boolean): Promise<void>
deleteVideoCategory(actor: Subject, id: string): Promise<void>
reorderVideoCategories(actor: Subject, ids: string[]): Promise<void>
// public
publicVideoWhere(): Prisma.VideoTopicWhereInput
loadVideoTopics(locale, track, categorySlug?): Promise<VideoTopicCardView[]>
getVideoTopics(locale, track, categorySlug?): Promise<VideoTopicCardView[]>   // "use cache"
loadVideoTopicBySlug(locale, track, slug): Promise<VideoTopicView | null>
getVideoTopicBySlug(locale, track, slug): Promise<VideoTopicView | null>       // "use cache"
loadVideoCategories(locale, track): Promise<VideoCategoryView[]>
getVideoCategories(locale, track): Promise<VideoCategoryView[]>                // "use cache"
loadVideoSitemapEntries(): Promise<VideoSitemapEntry[]>
```

`saveVideoTopic` is **one transaction** — meta, translation, the whole video
list, the whole link list, and the `ContentReference` rows — with the redirect
written **outside** it on a slug or track change, exactly as `saveQuiz` does and
for the recorded reason (a failed redirect write has never rolled back a saved
translation). Body through `sanitizeRichText()`. `revalidateTag("content", {
expire: 0 })` at the end. `recordAudit` on every mutation.

Status changes go through `transitionContentStatus(actor, "videos", id, to)` —
no bespoke transition code.

`loadVideoTopicBySlug` takes the **track** and returns null when the row's track
differs, so a topic loaded under the wrong school 404s rather than answering
twice — the rule ADR-065 set for courses.

_Tests (integration, real MariaDB):_ save writes meta+translation+videos+links
atomically; a mid-save failure leaves nothing behind; slug change writes a
redirect; track change writes a redirect; wrong-track read returns null; drafts
and soft-deleted rows are absent from every public read; publish without
`lessons.publish` throws `PublishPermissionError`; `ContentReference` rows appear
and disappear with placements; deleting a category nulls `categoryId` and deletes
no topic.

### PR 4 — Admin: categories

_Files:_ `app/(admin)/admin/learn/videos/categories/page.tsx` +
`categories-manager.tsx`, `_actions/video-actions.ts` (new).

`glossary/topics/topics-manager.tsx` with the nouns changed. Keyboard-only
reorder. `ConfirmDialog` on delete (code-style #7). Every action opens with
`requirePermission("lessons.update")` / `"lessons.view"` (D3).

### PR 5 — Admin: the list screen

_Files:_ `app/(admin)/admin/learn/videos/page.tsx`, `videos-table.tsx`,
`videos-controls.tsx`, `loading.tsx`; sidebar entry in `admin-shell.tsx`
(`labelKey: "learnVideos"`, `permission: "lessons.view"`), icon registration,
`admin` catalog keys.

`DataTable` with filters in the **toolbar** `filters` prop (code-style #9), each
an `AdminCombobox` with an explicit `w-*` (ADR-057). Columns: title, track,
category, videos count, status badge, updated.

### PR 6 — Admin: the editor

_Files:_ `app/(admin)/admin/learn/videos/[id]/page.tsx`, `video-editor.tsx`,
`editor-types.ts`, `_panels/videos-panel.tsx`, `_panels/links-panel.tsx`;
additions to `_actions/video-actions.ts`.

Sectioned layout via `EditorSection` (ADR-046), one Save for the screen. Panels:

- **Placement** — track (`AdminCombobox`, full width), category, cover image
  through the media picker.
- **Videos** — ordered rows; each row is _either_ "Choose from library"
  (picker restricted to `kind: VIDEO`) _or_ a pasted URL validated live by
  `parseVideoUrl`, plus an optional title and, for uploads, a poster. Keyboard
  reorder. Add / remove with `ConfirmDialog` on remove.
- **Links** — label + href rows, with the internal/external radio deciding which
  field is enabled.
- **Body** — `RichTextEditor`.
- **SEO** — `SeoAnalysis`, unchanged.
- **Status** — `ContentStatusPanel` (ADR-063), never `publish-panel.tsx`.

Every dialog renders `DialogTitle` **and** `DialogDescription` (ADR-057 #5);
`admin-dialog-conventions.test.ts` will fail otherwise.

### PR 7 — Public: index + category views

_Files:_ `app/(public)/[locale]/learn/[track]/videos/page.tsx`, `loading.tsx`,
`categories/[category]/page.tsx`, `_components/video-shelf.tsx`,
`_components/video-masthead.tsx`; `learnSectionsFor()` gains the tab; seed flips
the flag **on**; `learn` catalog keys.

Both flags checked (`courses` and `videos`), matching the quiz index's reasoning:
a video index inside a switched-off learning area is a page with no way back.
`generateMetadata` with `alternates.canonical`. Category chips are **links**, not
client state — these are pages people bookmark (D26).

### PR 8 — Public: the detail page

_Files:_ `.../videos/[topic]/page.tsx`, `loading.tsx`,
`_components/video-player.tsx` (source switch per D6),
`_components/video-links.tsx`, `_components/video-json-ld.tsx`.

Breadcrumb → title → player → body (`RichText`) → links → related rail (same
category, same track, current topic excluded). `VideoObject` JSON-LD from the
data already present; no new fields to store it.

### PR 9 — Navigation, sitemap, footer

_Files:_ `_nav/mega-menu.ts` (+ its test), `seed.ts` menu trees and
`footer_learn`, `sitemap.ts`.

`check-reserved-paths.mjs` needs **no** change: it scans top-level route
directories under `[locale]` against the CMS `RESERVED_PATHS`, and `videos` is
nested under `learn/[track]`. `learn` is already reserved.

### PR 10 — Design pass

Masthead with counted stat strip (topics / videos / categories — counted, never
typed into a catalog, absent when nothing is published), generated backdrop
following the ADR-047 §3 media pattern (`_content/learn-media.ts` is the fourth
instance; a fifth goes beside it), a `VideoCard` in `@repo/ui`, per-route
skeletons.

**`VideoCard` is deliberately NOT a stretched link** (owner, 2026-09-09; §9).
`QuizCard` covers the whole card and `CourseCard` covers its header row, but both
work because nothing inside the overlay needs a click target of its own. A video
card has a **play affordance over the thumbnail**, which is a second target with
a different destination — playing is not navigating. So the title is an ordinary
anchor, the play control is a real button, and `video-card.test.tsx` guards the
inverse of `quiz-card.test.tsx`: no overlay `::after` anywhere in the card, both
controls in the tab order, each with its own accessible name.

---

## 7. Criterion → test

| Criterion                                                    | Test                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| A track's registries cannot drift                            | `packages/contracts/src/learn.test.ts`, extended in three places (PR 1) |
| A course cannot be slugged `videos`                          | `videos.test.ts` — reserved slug rejected                               |
| A topic cannot be slugged `categories`                       | `videos.test.ts`                                                        |
| A video row has exactly one source                           | `videos.test.ts` — all four combinations                                |
| An "internal" link cannot be protocol-relative or absolute   | `videos.test.ts` — `//evil.example`, `https://…`, `javascript:`         |
| An empty topic cannot be saved                               | `videos.test.ts` — capability rule                                      |
| Save is atomic                                               | `videos.integration.test.ts` — forced mid-save failure leaves nothing   |
| Renaming or re-tracking writes a redirect                    | `videos.integration.test.ts`                                            |
| A topic read under the wrong track 404s                      | `videos.integration.test.ts` — returns null                             |
| Drafts and deleted topics never reach a public read          | `videos.integration.test.ts`                                            |
| Publishing needs `lessons.publish`                           | `videos.integration.test.ts` — `PublishPermissionError`                 |
| An in-use video cannot be deleted from the library           | `media.integration.test.ts` — extended with a `VIDEO_TOPIC` reference   |
| Every mutation checks a permission first                     | existing permission-key cross-check script + review                     |
| No hardcoded strings, no hex, logical properties             | `pnpm lint`                                                             |
| `en` catalog complete for the `learn` namespace              | `check:catalog-completeness`                                            |
| Public video pages read no session                           | grep-style guard in the page test, matching the course/lesson precedent |
| The card has NO overlay, and both its controls are reachable | `video-card.test.tsx` (inverse of `quiz-card.test.tsx`)                 |
| Uploaded video streams with ranges                           | `app/uploads/[file]/route.test.ts` (existing, unchanged)                |

**Deferred to Module 14, consistent with the rest of the learn area:** axe on
both new templates, RTL smoke, a Lighthouse budget for `/learn/[track]/videos`,
and admin happy-path + permission-denied E2E.

---

## 8. ADRs to write before any code

**ADR-068 — Videos are a first-class learn section.** Covers D1, D2, D3, D6, D7,
D12: why a new entity rather than a Lesson variant, why it reuses the `lessons.*`
keys and what that costs, the exactly-one-of source rule, the link shape, and the
`ContentReference` obligation. One ADR, because these are one decision's
consequences — splitting them would leave five documents that only make sense
read together.

Nothing else in this plan deviates from an existing decision, so nothing else
needs one. D5's routes follow ADR-065; D11's caching follows ADR-004; D4 follows
D27; D9 follows ADR-055 #4.

---

## 9. Risks and open questions — **all answered, 2026-09-09**

> **Owner, 2026-09-09 — binding:**
>
> 1. Keep the 100 MB ceiling for now and say so in the editor help text.
> 2. `VideoCard` uses a **play affordance over the thumbnail**, so the whole
>    card is NOT a stretched link.
> 3. Defer the nullable Lesson → video topic pointer.
> 4. `VideoTopic` stays separate from `GlossaryTopic`; every topic requires a
>    track.
> 5. Reuse the `lessons.*` permissions.
> 6. Proceed: ADR-068 → PR 0 → PR 1. **The two test-impact findings (the
>    `VideoFacade` relocation and the `learn.test.ts` drift checks) are handled
>    in the initial PRs, not discovered later.**
>
> #2 is the one answer that changes a design: **§6 PR 10 is amended.** The card
> is not a stretched link in either `CourseCard`'s or `QuizCard`'s sense. The
> title is an ordinary anchor and the thumbnail carries a real play control, so
> `video-card.test.tsx` guards the inverse property from `quiz-card.test.tsx`:
> **no `::after` overlay anywhere in the card**, and the two interactive
> elements are separately reachable and separately labelled. A card with one
> stretched link and a play button inside it is the failure mode being avoided —
> the button would sit under the overlay or punch a hole in it.

1. **100 MB is a real ceiling.** `media.maxBytes.video` defaults to 100 MB and
   the upload is a single request through a Next route handler. A 40-minute
   screen recording will not fit. That is changes-12's problem to solve properly;
   until then the honest answer to an editor is "host long videos on YouTube and
   paste the link". **Answered: keep the ceiling, and say exactly that in the
   Videos panel's help text (PR 6) — from a catalog key, not a literal.**
2. **A category spans tracks, a topic does not.** So a category chip on
   `/learn/forex/videos` shows a count of that category's _forex_ topics, and the
   same chip on `/learn/crypto/videos` shows a different number. This is correct
   and is the same relationship the track glossary has with `/glossary`, but it
   is worth confirming you read it the same way.
3. **Should a video topic be linkable from a lesson?** A "watch this" pointer
   from a lesson to a topic is one nullable column and would make the two
   surfaces feel like one product. **Answered: deferred.** Not in this plan, and
   not owed by it.
4. **`video-tile.tsx` vs `video-facade.tsx`.** PR 0 folds them together only if
   one is a superset. If they have genuinely diverged, the repo keeps two facades
   and that should be a line in the DEVLOG rather than a silent duplication.
5. **The flag starts OFF.** After PR 7 flips it, a database seeded before PR 2
   will not have the row at all — `pnpm db:reset` is required, per the pre-launch
   policy.

---

## 10. Execution brief

**Before writing any code**, in this order: `CLAUDE.md`; `.claude/rules/*`;
`.claude/skills/content/SKILL.md` plus the skill for whichever surface the PR
touches; ADR-004, 006, 035, 042, 043, 044, 046, 049, 053, 055, 056, 057, 058,
063, 065, 066, 067; the last 5 DEVLOG entries.

**Verify before you trust.** Every path, model, permission key, flag and function
named here was checked on 2026-09-09, but this document is not the repository. If
something has moved, fix the plan in the same PR rather than working around it.

**Rules that override convenience:**

1. Never import `@repo/db` from `apps/web`. Handlers and actions call
   `@repo/core`.
2. `requirePermission()` is the first line of every mutation. No exceptions.
3. No new permission keys, no new cache tags, no CSP change. One new feature
   flag, and only the one named in D10.
4. No second media pipeline, no second upload path, no queue, no transcode.
5. Sanitize on save, server-side, always.
6. No hardcoded user-facing strings; no hex literals; logical properties only.
   Admin strings are `en`-only by design (ADR-043 #2) but still go through keys.
7. An ADR precedes the code that deviates from this plan; a DEVLOG entry follows
   the code that lands.

**Verification gate on this machine:** root `pnpm test` and `pnpm build` die on
resources — run `pnpm lint`, then per-package `typecheck`, then per-package
`vitest run`, then the dev server for the routes touched.

**Stop and ask** if: a decision in §3 conflicts with code written after
2026-09-09; a PR needs a dependency not already in the tree (none should); or a
test in §7 cannot be written as specified — that usually means the design is
wrong, not the test.
