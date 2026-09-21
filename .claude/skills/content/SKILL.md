# SKILL — Module 11: Content system (courses, lessons, glossary, media)

plan.md Module 11 + A7 (new models). Services in `@repo/core`; admin CRUD in
`app/(admin)`. ADR-009 (Tiptap) pinned at this module's kickoff.

## Requirements

- Course/Module/Lesson/Glossary CRUD with the translation workflow:
  `ContentStatus` state machine; publish requires `*.publish`; OUTDATED
  queue screen (sourceHash flow from Module 06).
- **Tiptap** (open-source MIT core only — no paid cloud add-ons). Server-side
  sanitization on save is mandatory regardless of editor behavior.
- New models (A7): `MediaAsset` (+ usage tracking), `Article`/
  `ArticleTranslation` (one model + `kind` enum for analysis & news),
  `Comment`, `Page`/`PageTranslation` (admin-editable static pages).
- S3 uploads: presigned, MIME/size validated server-side, image variants.
- `ContentRelation` linking UI.
- **Slug change writes a `Redirect` row automatically** (per-locale slugs;
  old slug 301s — the SEO-preserving detail).
- Soft delete + restore round-trip.

## Required tests

Status-machine: illegal transitions rejected (DRAFT→PUBLISHED without
APPROVED; publish without permission); **XSS regression suite** (script-tag
payloads stripped server-side); slug change → old slug 301 (E2E);
translation OUTDATED flow E2E; upload rejects oversized/wrong-MIME;
soft-delete restore; **scheduling (ADR-071)** — a due row is public before any
sweep runs, the sweep stamps the promised time and is idempotent, and the
sweep is exercised against more than one entity (it loops five delegates, so a
glossary-only test passes with four missing).

## SCHEDULED became real (ADR-071, 2026-09-11)

`CONTENT_TRANSITIONS` had offered `APPROVED → SCHEDULED` since Module 11 with
no `scheduledFor` column on any of the five entities and nothing to publish a
due row, so the state parked content. All five carry the column now
(`@@index([status, scheduledFor])`), and the design is the article one
(ADR-015 #6) generalised, not a new mechanism.

- **Visibility is decided in the QUERY, not by a job.** `scheduledVisibilityOr(now)`
  (`content.ts`) is `PUBLISHED, or SCHEDULED and due`, and the five public
  where-helpers compose it. A sweep that is late, failed or never configured
  delays nothing. `POST /api/cron/publish-due` (bearer `CRON_SECRET`, digests
  compared with `timingSafeEqual`, unset secret ⇒ **503, never open**) is
  bookkeeping: it makes `status` true and stamps `publishedAt` from
  `scheduledFor`, so a late sweep records the PROMISED minute. Nothing is
  deployed calling it, and nothing has to be.
- **Never default `now`.** Every `public*Where` caller passes it explicitly —
  a `new Date()` inside a `"use cache"` function freezes that entry's creation
  time into the query. Punctuality is bounded by `cacheLife` (5 min), which is
  also why the presets are hours and days, not minutes.
- **A SCHEDULED move with no future date is REFUSED** (`ScheduleInPastError`),
  not defaulted to now, and SCHEDULED needs the entity's `*.publish` key
  exactly as PUBLISHED does — it puts content in front of readers on a timer.
- **A schedule survives only a move that is itself a schedule.** The article
  machine can say "clear on PUBLISHED and DRAFT" because those are its only
  two moves out of SCHEDULED; the seven-state machine also allows
  SCHEDULED → APPROVED, and enumerating destinations left that row displaying
  a date that would never fire. Do not re-enumerate.
- `ScheduleInPastError` and `effectivePublishedAt` live HERE and are
  re-exported by `articles.ts`; the `datetime-local` control is
  `_components/editor/schedule-field.tsx`, shared by both publishing panels.

## Tracks are part of the address (ADR-065, 2026-09-09)

`Course.track` was already a registry key; `Quiz.track` and
`GlossaryTerm.track` joined it, and they differ ON PURPOSE:

- **`Quiz.track` is required.** A quiz has one canonical URL,
  `/learn/<track>/quizzes/<slug>`, and that segment cannot come from a null.
  The "New quiz" dialog asks for it, like the course dialog does.
- **`GlossaryTerm.track` is nullable, and null means EVERY school** — not
  "unfiled", which is what a null `topicId` means one field over. "Leverage"
  is forex and crypto both; duplicating it per track would give one concept
  two pages competing in search.

`coursePath`, `lessonPath` and `quizPath` all take the track, and they are
the only places the URL shape lives. `saveCourse` and `saveQuiz` write a
redirect when the TRACK changes exactly as they do for a slug — for a course
that means a redirect per lesson too. `RESERVED_COURSE_SLUGS` is `quizzes`
and `glossary`: both are real static segments one level under the track.

## The media library never loads itself (ADR-066 + ADR-067, 2026-09-09)

Binding on every surface that shows or picks media, including ones not written
yet:

- **`listMediaAssets()` returns a page, not a list.** Keyset cursor on
  `(createdAt, id)`, `limit` default 48 and clamped at 100. There is no
  `limit: 0`, no `all: true`, and `media.test.ts` fails any exported reader
  that grows a bare `MediaAssetRow[]` return — the shape IS the enforcement.
  `getRecentlyUsedMedia` is the one array-returning reader and is bounded
  internally.
- **Browsing is `GET /admin/api/media`**, gated by
  `requirePermission("media.view")` and parsed through
  `listMediaAssetsQuerySchema`. Opening a picker is ONE request:
  `include=facets,recent` folds the chrome into the first page. Every later
  request (tab, search, Load More) carries rows only. `use-media-browser.ts`
  owns the abort, the debounce, the cursor and the 30-second client cache —
  do not fetch media anywhere else.
- **Search is the server's job.** Filtering an already-fetched array cannot
  find what the first page did not return; that was a correctness bug, not a
  preference.
- **A category is the first segment of `folder`**, from the `MEDIA_CATEGORIES`
  registry (`news | learn | brand | general`) — never `purpose`, which is the
  upload permission gate. Type lives in `kind`; there are no per-type folders.
  `MediaPickerDialog` and `ImageUploadField` take a **required** `category`,
  so a new call site has to say where its uploads belong.
- **`/uploads/[...key]` (a catch-all since ADR-144 §3; keys are `<category>/<random>.<ext>`, legacy flat keys still serve) answers a Range without reading the object**
  (`StorageDriver.getRange`, optional, with a read-and-slice fallback), and a
  `DOCUMENT` is served `Content-Disposition: attachment` — nothing here embeds
  a PDF. `resolveThumbnailUrl(row)` is the derivative seam changes-12 M7 fills;
  grid tiles read it, never `url`.

## Uploaded images are stored as WebP (ADR-130, 2026-09-17)

- `storeMedia` and `replaceMedia` run every IMAGE through `optimizeImage()`
  (`image-optimize.ts`) before the storage driver. It applies EXIF
  orientation, drops all metadata (GPS too) and encodes WebP with
  `smartSubsample` aimed at **80 KB** (`OPTIMIZE_TARGET_BYTES`). It uses the
  highest quality in 60–85 that fits. Only when 60 does not fit does the edge
  step down, 3840 → 2560 → 1920 → 1600 → 1280. `images.qualities` in
  `next.config.ts` is `[85]` to match; do not add a lower display quality, or
  uploads are compressed twice. The row stores the result's MIME type,
  size and dimensions, and the audit row adds `originalMimeType`,
  `originalSize` and the chosen `quality`.
- The size cap and the magic-byte sniff run on the bytes the uploader SENT.
- **`brand` and `setting` uploads are never converted.** These are logos, the
  favicon, the email logo and the default share image, and Outlook and some
  crawlers do not render WebP.
- GIF, ICO, SVG, an animated PNG or WebP, an undecodable file, and a
  re-encode that would come out larger are all stored as sent. A `null` from
  the optimizer is never an upload error.
- Existing uploads were not backfilled.
- A public `next/image` whose src may be an absolute URL decides `unoptimized`
  with `canOptimizeImage(src)` (`[locale]/_lib/image-optimizer.ts`), never a
  bare `unoptimized`.

## The glossary term has its own editor (ADR-069, 2026-09-09)

`/admin/glossary/[id]`, modelled on the **lesson** editor, not the article
one — ADR-063's reason applies unchanged: the glossary runs the seven-state
`CONTENT_TRANSITIONS` machine, so `ContentStatusPanel` fits and
`publish-panel.tsx`, which runs the article machine's four states, does not.
(The original reason given here was that the glossary "has no `scheduledFor`".
ADR-071 gave it one; the seven-versus-four-states reason is the one that
survives, and the two panels now share `schedule-field.tsx`.)

The inline `TranslationForm` on the list is **deleted, not hidden**. It seeded
`term`/`slug`/`body` from `useState("")` and `loadGlossaryAdminList` selected no
body column, so it could never edit — only overwrite. If you are looking for it,
that is why it is gone.

- **`saveGlossaryTerm` is the one write.** Term-level fields and one locale's
  translation, in ONE transaction. `saveGlossaryTranslation` still exists and
  delegates to it, so the OUTDATED flip and the slug redirect have exactly one
  implementation.
- **The source hash covers ALL FOUR prose fields** (`simpleExplanation`,
  `detailedExplanation`, `advancedExplanation`, `exampleScenario`). Before this
  it covered two, so rewriting a worked example marked nothing OUTDATED. Adding
  a fifth prose field means adding it to `glossarySourceMaterial` in the same
  PR, or translations will silently claim to be current.
- **Sanitize per field, never over a join.** `sanitize-html` balances tags
  across whatever string it is given, so one call over a concatenation lets an
  unclosed tag in one field swallow the next.
- **Two nulls, one field apart, opposite meanings.** `topicId: null` is
  UNFILED; `track: null` is EVERY SCHOOL (ADR-065 §3). The editor labels them
  differently on purpose and `undefined` means untouched in both — conflating
  `undefined` with `null` would mean saving a body silently unfiled the term.
- **`admin.glossary` is a STRING** (the nav label and the list title). Editor
  keys live under `admin.glossaryEditor`. Nesting under `admin.glossary` turns
  it into an object and next-intl throws `INSUFFICIENT_PATH` at runtime —
  nothing static catches it, because admin catalog gaps are silent by design
  (ADR-043 #2) and catalog keys are not type-checked.
- `faq` is the translation's only `Json?` column. It is parsed through
  `glossaryFaqSchema` on the way in and read defensively on the way out — a row
  written before ADR-069 holds `null`, and the editor must not throw on it.

## Videos — the fourth learn section (changes-16, ADR-068)

`VideoTopic` is a **page whose subject is a video**. It is not a Lesson, it
belongs to no Course, and nothing about it is graded — which is why it is its
own entity. Every Lesson column about ordering, completion and progress would
be dead on it, and `lessonsCompleted` would have to learn to ignore a kind of
Lesson.

Service: `packages/core/src/videos.ts`. Contracts:
`packages/contracts/src/videos.ts`. Admin: `app/(admin)/admin/learn/videos/**`.
Public: `app/(public)/[locale]/learn/[track]/videos/**` — the index, `categories/[category]` and `[topic]` (PRs 7–10). The `videos` flag is seeded ON.

- **A topic requires a track; a category does not.** The track is the URL's
  second segment (ADR-065 §3's rule, applied), so re-tracking a topic writes a
  redirect exactly as a rename does. A category is TAXONOMY — it spans schools,
  and its page under a track is a filtered view. The accepted consequence is
  that the same chip shows different counts under different tracks. That is
  correct; do not "fix" it into a global count.
- **A category rename writes one redirect PER TRACK it has topics in**, because
  its page exists under each of them. One redirect would leave the others dead.
- **Exactly one of, twice.** A video row has one source (`assetId` XOR
  `externalUrl`); a link has one href (`path` XOR `url`). Both are enforced in
  contracts only — MariaDB CHECK constraints are not in this repo's vocabulary,
  and a second enforcement point that can disagree is worse than one that
  cannot. The admin panels mirror the rule by CLEARING the other branch, so the
  UI never offers a state the save will refuse.
- **There is no stored `isExternal`.** Which branch is set already says it, and
  a copy goes stale the first time a link is edited. `internalPathSchema`
  demands one leading slash and refuses a second — `//evil.example` is a
  protocol-relative URL that navigates off-site and satisfies every naive
  `startsWith("/")` check.
- **A raw URL never reaches a `src`.** `loadVideoTopicBySlug` resolves every
  row into a `VideoSourceView` and DROPS one whose URL no provider recognises,
  or whose asset has been deleted. A player with no source beats handing an
  attacker-controlled string to an iframe.
- **Videos publish on `lessons.*`** — the third refusal to add keys for a new
  content type, after quizzes (ADR-058 #8) and glossary topics (D27). Cost:
  video authorship cannot be granted apart from lesson authorship.
  `ENTITY_PUBLISH_PERMISSION` is the one line that changes it.
- **Videos and links are NOT translatable.** They live on the topic, not the
  translation: a recording is the same recording in every language, and a
  link's destination does not change with the reader (`@repo/i18n`'s `Link`
  adds the locale prefix at render, so no prefix is stored).
- **`admin.videos` and `admin.videoCategories` are STRINGS** (nav labels). The
  key blocks are `admin.videoEditor` and `admin.videoCategoryManager` — the
  same collision `admin.glossary`/`admin.glossaryEditor` records, and nothing
  static catches it.
- Demo seed rows carry a body and no video, except one per track. A video URL
  is a factual claim (`_content/home-videos.ts`); the seed does not invent one.

## Reading language (ADR-127 applied beyond articles, 2026-09-17)

Courses, lessons, video topics, glossary terms and quizzes take `?lang=` exactly as an
article does. Adding it to a sixth detail page is four steps, and
`apps/web/app/(public)/[locale]/_lib/reading-language.test.ts` names the one
you forget (add the page to its `PAGES` map):

1. **Loader.** Select `translationStatus`, take an optional `readingLocale`
   (part of the `"use cache"` key), and run the ordinary fallback pick through
   `applyReadingLocale` (`@repo/core` `reading-languages.ts`). Take WORDS from
   its `picked`, and keep the fallback pick for everything that is ADDRESS —
   the slug, and so the canonical and every link — so a reading view never
   moves URL. The view `extends ReadingView`. Locale names come from
   `loadLocaleMeta()`, which reads inactive locales too.
2. **Page and metadata.** Both call `readingLocaleFrom(await searchParams)`
   (`[locale]/_lib/reading-language.ts`), and the metadata spreads
   `robots: { index: false }` when `view.readingLocale` is set.
3. **Menu.** `readingLanguageOptions({ …, pathFor })` builds the hrefs; `pathFor`
   returns null when a language has no address of its own. A lesson is the
   example: a served locale needs that locale's COURSE slug too
   (`LessonView.courseAlternates`), and without one the option stays a
   `?lang=` view.
4. **Markup.** `lang={view.contentLocale} dir={view.contentDirection}` goes on
   the item's own words ONLY — never on a wrapper that also holds interface
   headings. The glossary heading is the worked example: `termHeading` is
   `<word>{term}</word> definition`, so only the term carries the translation's
   `lang`.

**Where a translation comes from.** The four editors have B3's "Translate from
English" beside the locale switcher (`TranslationControls`, rule in
`_lib/machine-translation.ts`). Untouched AI output saves as
`MACHINE_TRANSLATED` and is NOT offered to readers; any edit, or a Save after a
reload, writes `TRANSLATED`. A fifth editor wires the same three pieces:
`machineTranslated` on its translation schema and service, `mergeTranslationPatch`
in its `setDraft`, and `<TranslationControls>`.

**An editor offers every AUTHORING locale, never the active list.** Read
`getAuthoringLocales()` (`@repo/i18n`) or `routing.locales`. Only `en` is
active, so `getActiveLocales()` gave the video topic, glossary term, glossary
topic and article taxonomy screens a list of one, and their switchers
(`locales.length > 1`) never rendered. "View live" goes through
`_lib/live-href.ts`: the default locale's page plus `?lang=`, because `/es/…`
404s until `es` is activated. `_lib/live-href.test.ts` guards both.

**Quizzes translate; only the default locale SHAPES them (2026-09-17).** The
quiz editor's language is `?locale=` in the admin URL, because another
language's words are a second server read. `correctAnswer` is an option INDEX
on the question row (ADR-058 #2), so a non-default save may not add, remove or
reorder questions or change an option count: `saveQuiz` throws
`QuizTranslationStructureError`, writes no question rows, and the editor hides
or disables those controls (and the AI generators, which append questions). A
quiz is readable in a language only when EVERY question has its words there, so
a question added in English later withdraws that language instead of mixing
languages mid-quiz. The runner takes the words' locale, which also picks the
explanations at submit. No machine translation for quizzes yet.

What stays in the interface locale on purpose: the curriculum, the lesson
rail and pager, the breadcrumb trail's parents, section titles. They are
navigation, and a `?lang=` choice does not follow the reader onto the next
page — that would be a sticky reading preference, which is its own decision.


## Featured / Active / Premium on learning content (ADR-139, 2026-09-18)

`Course`, `Lesson`, `Quiz`, `VideoTopic` and `GlossaryTerm` carry the
article's three flags; `GlossaryTopic` gained `isFeatured` + `isPremium` beside
its existing `isActive`. Read ADR-139 before extending them.

- **`isActive: true` lives inside the public predicates** (`publicCourseWhere`,
  `publicLessonWhere`, `publicQuizWhere`, `publicVideoWhere`,
  `publicGlossaryTermWhere`), so it hides a row from pages, search, sitemap,
  counts and completion at once. Never write a fresh visibility rule: site
  search had an inline copy of the video rule and missed the flag.
  `content-flags.test.ts` fails if a predicate loses it.
- **Saves write them through `contentFlagsData(meta)`** (`content.ts`), which
  only sets the flags a request sent. The schemas share `contentFlagsSchema`
  (`@repo/contracts` `learn.ts`).
- **Editors** draw the flags with `ContentFlagsFields` as the footer of a
  right-hand "Display" card that also holds the cover. `featuredEffect` /
  `premiumEffect` pick a hint that says what the flag actually does for that
  type. A lesson has no public card, so its hints say "not shown yet".
- **Public:** the course, quiz and video shelves have an All · Featured ·
  Popular · Newest row (`_lib/shelf-view.ts`, `ShelfViewChips`). Cards take
  `markers` (`@repo/ui/components/card-markers`). Popular means enrollments
  for courses and finished attempts for quizzes; the video shelf has no count,
  so it has no Popular view.
