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
- **`/uploads/[file]` answers a Range without reading the object**
  (`StorageDriver.getRange`, optional, with a read-and-slice fallback), and a
  `DOCUMENT` is served `Content-Disposition: attachment` — nothing here embeds
  a PDF. `resolveThumbnailUrl(row)` is the derivative seam changes-12 M7 fills;
  grid tiles read it, never `url`.

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
