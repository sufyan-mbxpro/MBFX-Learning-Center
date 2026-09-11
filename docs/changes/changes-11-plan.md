# changes-11 — plan: the Learn area (Module 11 courses/lessons + progress)

**Version 2.2** (2026-09-08) — owner supplied six public-presentation
references (Babypips Forexpedia / Crypto Guides / Crypto Quizzes / Decryptopedia,
FOREX.com Academy course index and lesson page). Adopted as D25–D31 and §9.5.
**Version 2.1** (2026-09-08) — media decisions D19/D20/D22 and part of D23 are
superseded by `docs/changes/changes-12-plan.md`; see §14 and §17.
**Version 2** (2026-09-08) — owner reviewed v1, settled its four open questions,
and added requirements for external resources, reusable quizzes,
recommendations and a media pipeline. This revision integrates all of them.
**Status:** plan only. No code, no migration, no ADR written yet.
**Modules:** 11 (content system) primarily; 12 (public site), 09 (admin shell),
15 (editor reuse), 05 (flags), 03 (permissions) at the edges.
**Reference:** babypips.com School of Crypto / School of Pipsology, as a UX and
information-architecture reference only — no assets, copy, or content copied.

## Owner decisions, settled (2026-09-08)

| Question             | Settled                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| Launch tracks        | **Forex + Crypto**, conditional on both course sets actually being prepared |
| Learner-facing word  | **Section** (not Chapter)                                                   |
| Quizzes              | **Phase 6** — do not delay the core learning launch                         |
| Learner account page | **Not required for Phase 1**                                                |

Because "Forex + Crypto" is conditional, `LEARN_TRACKS` registers **both** (a
registry entry is code and costs nothing) and the seed ships a demo course in
each. A track with no published courses **must not render an empty band** —
§9.1 makes that a test, not a convention.

---

## 0. Read this first: the request is narrower than it looks

The brief asks for a "complete dynamic LMS" designed from scratch. **Most of it
already exists in this repo, unbuilt but specified.** Verified against the tree:

| Asked for                           | Already in the repo                                                                                                                       | Gap                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Course / Section / Lesson hierarchy | `Course`, `CourseTranslation`, `Module`, `ModuleTranslation`, `Lesson`, `LessonTranslation` — `packages/db/prisma/schema.prisma:680-814`  | **zero service code touches them**     |
| Admin permissions                   | `courses.{view,create,update,delete,publish}`, `lessons.{…}`, `media.{view,upload,update,delete}` seeded — `seed.ts:34-58`                | none — do not invent new keys          |
| Feature flags                       | `courses` (on, PUBLIC), `quizzes` (off, AUTHENTICATED), `progress_tracking` (on, AUTHENTICATED) — `seed.ts:586-599`                       | none — the flags were seeded far ahead |
| Navigation entry                    | `learn` → `/learn` in `ROUTE_PATHS`; main-menu row gated on `requiresFeature: "courses"`; `footer_learn` menu with a "Courses" row        | **the route does not exist**           |
| Draft→published workflow            | `ContentStatus` 7-state machine + `transitionContentStatus()` + `assertTransition()` — `packages/core/src/content.ts:21-160`              | reuse verbatim                         |
| Rich text + sanitization            | Tiptap editor (`_components/rich-text-editor.tsx`) + `sanitizeRichText()` server-side, 3-host iframe allowlist                            | reuse verbatim                         |
| External video normalization        | `parseVideoUrl` / `parseVideoEmbedUrl` (`@repo/utils`), CSP `frame-src` already names the 3 emitted hosts                                 | reuse verbatim                         |
| Slug stability / SEO                | per-locale unique slugs, `createSlugRedirect()` writing `Redirect` rows on change                                                         | reuse verbatim                         |
| Translation workflow                | `TranslationStatus` + `sourceHash` OUTDATED detection, already on `LessonTranslation`                                                     | reuse verbatim                         |
| Media library                       | `MediaAsset` (kind/folder/tags/poster/duration/width/height), `storeMedia()` accepts pdf/mp4/webm/mp3, picker dialog, ADR-034/049         | see §3 D12 and D19–D23                 |
| **Recommendations**                 | `ContentRelation` + `replaceRelations()` / `loadRelationTargets()` — generic, ordered, already used for article related-posts             | **no new table needed** (D17)          |
| **Media usage + safe delete**       | `ContentReference` with `ReferenceSourceType.COURSE` and `ReferenceType.MEDIA` already in the enum; `deleteMedia()` refuses in-use assets | **already built** (D21)                |
| Premium / restricted                | `Course.visibility` / `Lesson.visibility` are `FeatureVisibility`, semantics fixed by ADR-012                                             | enforce it in the loader               |
| Learner accounts                    | `UserType.LEARNER`, `/sign-in`, `/sign-up` (ADR-052)                                                                                      | no account area (deferred by owner)    |

**So the actual work is:** (a) build the services and admin CRUD Module 11
specified and never got, (b) build the public `/learn` area Module 12 deferred,
(c) add progress, quizzes and external resources, and (d) resolve the shape
decisions in §3 before any migration. Much of the rest is wiring, not design.

**Today the header's "Learn" link 404s.** The `courses` flag is enabled, so the
menu row renders; `/learn` falls through to `[locale]/[...slug]`,
`resolvePublicPage("/learn")` finds no CMS page, and the route calls
`notFound()`. That is the live bug this programme closes first.

### 0.1 What §74's infrastructure audit found

The owner's §74 required inspecting for existing infrastructure before adding
any. Results, all verified by grep across `package.json`, every
`packages/*/package.json` and `apps/*/package.json`:

| Looked for                | Found                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Background job / queue    | **Nothing.** No BullMQ, pg-boss, Graphile, Inngest, Trigger.dev, cron, or worker process anywhere. |
| Image processing library  | **Nothing.** No `sharp`, jimp, or squoosh.                                                         |
| FFmpeg / transcoding      | **Nothing.**                                                                                       |
| CDN configuration         | **Nothing.** Assets are served by `app/uploads/[file]/route.ts` off local disk.                    |
| Quiz models               | **Nothing.** No quiz table, enum, or service exists.                                               |
| Redis                     | **Present** — `redis:7-alpine` in `docker-compose.yml`, `ioredis` in `@repo/auth` (sessions).      |
| Image optimizer           | **Present** — `next.config.ts` `images` is configured and `next/image` is in use.                  |
| Range/seek media serving  | **Present** — `/uploads/[file]` already honours single `Range:` requests (ADR-034 §1).             |
| Media usage tracking      | **Present** — `ContentReference`; `deleteMedia()` throws `MediaAssetInUseError` on a live asset.   |
| Generic ordered relations | **Present** — `ContentRelation`, wired in `content-relations.ts`.                                  |

Four consequences drive §3's new decisions: there is **no queue to reuse and
none to extend** (D22); `next/image` **already generates responsive variants**,
so a `MediaVariant` pipeline would duplicate it (D19); recommendations and media
lifecycle are **already modelled** (D17, D21); and a 25 MB PDF **cannot** go
through a Server Action at the current `bodySizeLimit` (D20).

### 0.2 What I could not verify

`babypips.com` returns **HTTP 403** to automated fetches (Cloudflare). The UX
findings in §2 come from the supplied screenshot, the brief's own description,
and prior knowledge of the site — **not** from a live read. Every one of them is
a design input we are choosing on its merits, not a spec to match, so this does
not block the plan; but nothing in §2 should be quoted as "verified Babypips
behaviour". If exact parity on any point matters, it needs a manual look.

---

## 1. The constraint that shapes everything: ADR-042

Site design is **static and code-owned**; only content _data_ is dynamic
(`CLAUDE.md`, Part F #12). Applied here:

- **Static (code):** the `/learn` route tree, the school/track grouping, the
  course-page layout, the lesson-page layout, the sidebar, header/footer
  entries, section ordering _rules_, quiz presentation.
- **Dynamic (admin, DB):** courses, sections, lessons, their text, media,
  ordering _values_, external URLs, quizzes, recommendations, status,
  visibility.

This kills two things the brief originally asked for, and the owner has since
agreed with both:

1. **No block-based lesson canvas.** ADR-036 already rejected Puck; ADR-042
   cancelled the whole composer programme. A lesson body is rich text.
2. **No admin-editable learning navigation.** "Static navigation + dynamic
   content" _is_ ADR-042. Adding a course must not require touching a menu, and
   it will not.

The principle, in the owner's words, extended for v2:

> **Content is dynamic, presentation is code-owned, and media processing is an
> independent pipeline.**

With one repo-specific correction: that pipeline is **synchronous and small**
until something genuinely needs otherwise (D22).

---

## 2. Reference research — what the model gets right

The Babypips learning UX is worth copying at the _behaviour_ level for four
reasons, each of which becomes a requirement below:

1. **The school is a place, the course is the unit.** A learner lands on a
   school index that is a shelf of courses with artwork, a one-line promise and
   a single CTA. There is no "browse all 400 lessons" surface. → §4.
2. **Lesson URLs do not encode the hierarchy.** Sections group lessons _on the
   page_; the URL is school/course/lesson. Reordering a curriculum therefore
   never breaks a link or a bookmark. → D3, the single most valuable thing to
   copy.
3. **Progress is ambient, never a gate.** A signed-out visitor reads every
   lesson. Progress UI is an invitation, not a wall. → D8.
4. **One primary action, always.** Start Learning / Continue Learning /
   Completed — the same button in the same place, its label derived from state.
   → §9.

What we deliberately do **not** copy: the visual design (ours is ADR-018's
public design system), the illustration style, any copy, the Premium tier
mechanics, forums, and the flat lesson-list-without-sections shape.

---

## 3. Decisions to take before any code

Each is a deviation from, or a gap in, `docs/plan.md` Module 11, so each needs
its ADR **written before the code** (Part F #10). Grouped into three ADRs, not
twenty-four.

- **ADR-055** — structure: D1, D2, D3, D5, D12, D15, D16, D25, D26, D27, D29, D30
- **ADR-056** — progress and completion: D6, D7, D8, D9, D10, D11, D18, D28
- **ADR-057** — media pipeline: D19, D20, D21, D22, D23
- **ADR-058** — quizzes, written at Phase 6 kickoff: D24
- D4, D13, D17, D31 need no ADR (pure reuse of existing, documented infrastructure)

### D1 — `Module` is renamed to `CourseSection` ⟶ ADR-055

`plan.md` Module 11 and the schema call the middle level `Module`. That word
already means something else in this repo — "Module 11", "Module 16" — and a
service referring to `db.module` next to a DEVLOG entry about "Module 11" is a
permanent daily tax. The owner has settled the learner-facing word as
**Section**, so the model should match.

**Decision:** rename `Module` → `CourseSection`, `ModuleTranslation` →
`CourseSectionTranslation`, table `modules` → `course_sections`. Both tables are
empty and pre-launch, so this is a `pnpm db:reset`, not a data migration
(pre-launch DB policy: reset, never backfill). Cost is one migration and a
`plan.md` erratum; the alternative is a wrong name forever.

### D2 — No `LearningProgram` model; schools are a code registry ⟶ ADR-055

A fourth DB level (`Program → Course → Section → Lesson`) buys almost nothing: a
school has no content of its own, no translations worth storing, no ordering an
admin should own — it is _site structure_, which ADR-042 says is code. Owner
concurred.

**Decision:** `Course.track String @db.VarChar(40)`, validated against a
`LEARN_TRACKS` registry in `@repo/contracts` (the same pattern as `ROUTE_PATHS`
and `HOME_SECTION_VARIANTS`). A track has a key, a catalog title key, an icon
and a sort order — all in code. Phase 1 registers `forex` and `crypto`.

### D3 — URLs are `/learn/[course]/[lesson]`; sections never appear ⟶ ADR-055

Course and lesson slugs are already `@@unique([locale, slug])`, so they are
globally unique per locale and need no parent segment to disambiguate.

```
/learn                               school index (tracks as bands)
/learn/[courseSlug]                  course detail — curriculum + progress
/learn/[courseSlug]/[lessonSlug]     lesson
/learn/quizzes                       standalone quiz index      (Phase 6)
/learn/quizzes/[quizSlug]            standalone quiz            (Phase 6)
```

Consequences, all wanted: reordering sections or moving a lesson between
sections changes **no URL**; `createSlugRedirect()` covers the one case that
does (an editor renaming a slug); breadcrumbs still show the section because
they read the DB, not the path.

`/learn/quizzes` is a reserved segment — a course slug of `quizzes` must be
rejected at write time by `courseTranslationSchema`, or the route shadows it.

### D4 — Lesson editor = the article editor v3, not a new editor ⟶ no ADR

`admin/articles/[id]/` already ships the sectioned editor (ADR-046): Tiptap with
class-based tone/family/size, tables, in-body video, HTML source view, FAQ
dialog, SEO analysis, media picker, one-transaction save (`saveArticle`,
prepare/apply/finish). A lesson is an article with different sidebars. Reuse
`rich-text-editor.tsx`, `editor-extensions.ts`, `_panels/seo-analysis.tsx`,
`media-picker-dialog.tsx` and the prepare/apply/finish save shape. Any panel
that turns out to be genuinely shared moves to `admin/_components/` in the same
PR rather than being copied.

### D5 — Lesson body is rich text + typed attachments, not blocks ⟶ ADR-055

- **Body:** one sanitized-HTML field (`LessonTranslation.content`, exists).
  Headings, lists, tables, callouts, images and in-body video embeds are all
  already supported by `sanitizeRichText()` and the editor.
- **Attachments:** typed sibling records — `LessonAttachment` rows (PDF,
  download, image) rendered in a **fixed** position by the lesson template.
- **External resource:** `Lesson.externalUrl` (D15).
- **Quiz:** `Lesson.quizId` → a reusable `Quiz` (D24), rendered after the body.

The admin controls _what_ is on a lesson and its order within each list; the
template controls _where_ those lists sit. That is the ADR-042 split, one level
down.

### D6 — Progress is a client island; no public page goes dynamic ⟶ ADR-056

`architecture.md` #6: public routes are ISR + cache tags, and "do not fix a
caching problem by making public routes dynamic". `auth-slot.tsx` already
establishes the precedent — a server `auth()` read on the public header was
removed precisely because it made every public navigation uncached.

**Decision:** course and lesson pages are `"use cache"` + `cacheTag("content")`
and contain **no session read**. Progress renders in a client component that
hydrates from `GET /api/learn/progress?course=<id>` after paint. Writes go to
`POST /api/learn/progress`. Consequences:

- "Continue Learning" and every ✓/○ marker appear a beat after paint. Accepted:
  the alternative is an uncached learn area.
- The API route is the authorization boundary — session, `visibility` per
  ADR-012, rate limit.
- No progress data can leak into a cached RSC payload, because none is read
  during render — satisfying `security.md` #12 by construction.

### D7 — Two progress tables, not eight ⟶ ADR-056

- `LessonProgress` — one row per (user, lesson). Lesson state, completion
  timestamps, drop-off analytics, section progress by aggregation.
- `CourseEnrollment` — one row per (user, course). "Continue Learning"
  (`lastLessonId`), started/completed timestamps, and a denormalised
  `lessonsCompleted` counter so the index page needs one query, not N.

An event log, `user_video_progress` (D9) and a separate section-progress table
are all derivable or deferred. Adding an event log later is additive and cheap;
carrying one now is not. Owner concurred.

### D8 — Guests read everything; progress requires an account ⟶ ADR-056

No localStorage progress, no guest→account merge in Phase 1. Merge is a
conflict-resolution problem (which side wins on a lesson completed in both?)
that costs more than it returns before there are users. A guest sees the full
curriculum with one inline "Sign in to save your progress" card. The
`progress_tracking` flag is already `AUTHENTICATED`, which is exactly this.

### D9 — No video resume position in Phase 1 ⟶ ADR-056

Resuming at 13:42 needs the YouTube IFrame API, which needs `script-src` widened
to `youtube.com` in `proxy.ts`, and our sanitizer deliberately emits bare
`youtube-nocookie` iframes with no JS bridge (`content.ts:226-243`). Widening
CSP for a convenience feature, in a programme whose CSP is still report-only and
heading for enforcement in Module 14, is a bad trade. No `videoPositionSec`
column until a player integration is specified.

### D10 — Completion is explicit, with a per-lesson rule ⟶ ADR-056

`Lesson.completionRule` enum, two values in Phase 1:

- `MANUAL` (default) — learner presses "Mark complete". Works identically for
  text, video, PDF **and external** lessons, which is what makes D15 cheap.
- `QUIZ_PASS` — set when the lesson's attached quiz is passed; the manual
  control is hidden.

Scroll-depth and video-percentage auto-completion are rejected for Phase 1: both
are unreliable, untestable at the DB level, and produce completion rows the
learner did not intend.

### D11 — No lesson content versioning ⟶ ADR-056

An edited lesson does **not** invalidate existing completions. `Lesson` already
has `lastReviewedAt`. Versioning completions against content hashes means
telling a learner they have un-finished something they finished.

### D12 — Media wiring: FK columns replace URL strings ⟶ ADR-055

Replace `Course.coverImageUrl` / `Lesson.coverImageUrl` with `coverAssetId` /
`heroAssetId` FKs to `MediaAsset` (ADR-049 put the picker everywhere). Keep
`Lesson.videoUrl` — an external embed URL is genuinely not an asset, and
`parseVideoUrl` already validates it. Add `LessonAttachment` for PDFs and
downloads. Every one of these placements writes a `ContentReference` row
(`sourceType: COURSE`, `refType: MEDIA`) so `deleteMedia()`'s existing in-use
guard protects course media the day it ships (D21).

---

### D15 — External resources are a nullable URL, not a lesson type ⟶ ADR-055

**(new in v2 — owner §41, §42)**

The owner asked explicitly for a design that avoids "dozens of lesson types",
and that instinct is right. A `LessonType` enum forces illegal combinations to
be representable (`EXTERNAL` + a body? `VIDEO` + a PDF?) and every consumer to
switch on it.

**Decision — capabilities, not types.** A lesson is a bag of optional
capabilities; what it _is_ is derived:

```
Lesson
 ├── content       LessonTranslation.content   rich text, optional
 ├── videoUrl      validated embed URL         optional
 ├── attachments   LessonAttachment[]          optional
 ├── externalUrl   https URL                   optional   ← new
 └── quizId        Quiz                        optional
```

`isExternalLesson = externalUrl !== null`. A derived helper in `@repo/utils`
gives the display badge ("Video", "PDF", "External · YouTube", "Reading") from
the capabilities present, so the admin never picks a type and the two can never
disagree. **At least one capability must be present** — enforced by
`lessonInputSchema`, so an empty lesson cannot be published.

**External course** (owner §41) is the same shape one level up:
`Course.externalUrl`. When set, the course's primary CTA points outward and the
curriculum is optional. A course with `externalUrl` and no lessons is legal and
renders as a single-destination card.

**Provider is derived, never stored as free text.** `parseExternalUrl()` returns
`{ host, provider }` where provider is one of the recognised set (YouTube,
Vimeo, Dailymotion, TradingView, "web") — display-only, computed at render.
Storing an admin-entered provider string is a second source of truth that will
drift from the URL.

### D16 — External URLs: stored, never fetched; linked, never framed ⟶ ADR-055

**(new in v2 — owner §43, §44)**

Three rules, and the third is the one that keeps the CSP unchanged:

1. **HTTPS only, no server-side fetch, ever.** `security.md` #9 already forbids
   proxying or fetching arbitrary URLs (SSRF). We store the string and validate
   its shape; we never resolve it, never follow redirects, never fetch a preview
   or an oEmbed. Any "rich link preview" feature is out of scope for that
   reason. Validation is `z.url()` + an explicit `https:` protocol check +
   length cap; `javascript:`, `data:` and `http:` are rejected at write time.
2. **No domain allowlist for links.** An allowlist is right for _embeds_ and
   wrong for _links_: a link is a browser navigation we do not participate in,
   and an allowlist would force an admin to file a ticket to link a textbook.
   Links render `target="_blank" rel="noopener noreferrer"` with a visible
   external-link affordance so the learner knows they are leaving.
3. **An external URL is framed only if `parseVideoUrl()` accepts it.** That
   function already normalises YouTube/Vimeo/Dailymotion watch URLs into the
   three `youtube-nocookie` / `player.vimeo.com` / `dailymotion` embed hosts the
   CSP `frame-src` already names. Everything else is a link. **No CSP change in
   this programme** — that is the whole point of the rule.

**Admin-supplied iframe HTML is never stored.** The admin pastes a normal watch
URL; `sanitizeRichText()` already rebuilds every iframe wholesale from
`parseVideoEmbedUrl()` output and drops any it cannot parse
(`content.ts:226-249`). That behaviour is reused unchanged, not reimplemented.

### D17 — Recommendations reuse `ContentRelation`; no new table ⟶ no ADR

**(new in v2 — owner §52–54)**

The owner asked whether a `CourseRecommendation` table beats an array of ids.
There is a third answer that beats both, and it is already built and already in
production use for article related-posts:

```ts
replaceRelations(tx, {
  sourceType: "course",
  sourceId: courseId,
  targetType: "course",
  relationType: "recommended",
  targetIds, // array position IS the display order
});
loadRelationTargets({
  sourceType: "course",
  sourceId,
  targetType: "course",
  relationType: "recommended",
});
```

`ContentRelation` is generic, carries `sortOrder`, has a uniqueness constraint
that makes duplicates impossible, drops self-references, and its
"replace, never merge" semantics already match how the admin UI will save. It
takes a transaction client, so recommendations commit atomically with the rest
of `saveCourse`. **Zero new tables, zero new services, one new constant**
(`RECOMMENDED = "recommended"`, `COURSE = "course"` beside the existing
`RELATED`/`ARTICLE`).

**Phase 1 of recommendations = admin-selected + same-track fallback**, exactly
as the owner proposed:

```
resolveRecommendations(courseId, track, limit)
  1. explicit ContentRelation targets, in sortOrder      ← admin-controlled
  2. if fewer than `limit`: published courses in the same track,
     by sortOrder, excluding this course and the ones already picked
```

A pure function over two queries. No algorithm, no AI, no behavioural model.
Progress-based ordering (owner's Option D) is a Phase 9 refinement that needs
only a set of completed course ids — the data will already be there.

**Surfaces:** course page ("You may also like"), course-completion state
("Recommended next"), `/learn` ("Recommended for you" is deferred — with no
account area in Phase 1 it would be identical to "Popular", and two bands saying
the same thing is worse than one).

### D18 — A course final quiz is a course-level rule, not a phantom lesson ⟶ ADR-056

**(new in v2 — owner §45A, §49)**

The owner flagged the real risk here: a final quiz must not create completion
logic that conflicts with D10's per-lesson rule. It does not, if the final quiz
is modelled at the level it actually belongs to.

**Decision:** `Course.finalQuizId String?` → `Quiz`. Course completion becomes:

```
courseComplete = all published isRequired lessons complete
                 AND (finalQuizId is null OR that quiz has a passed attempt)
```

One rule, one place (`recomputeCourseCompletion`). The final quiz is **not** a
`Lesson` row — making it one would give it a slug, a URL, a position in
`LessonProgress`, and a `completionRule` that duplicates the course-level
question. It renders as a distinct card at the end of the curriculum:

```
Course Progress    18 / 20 lessons · 90%
Final Quiz         Not started
Status             Almost complete
```

Until the quiz phase lands, `finalQuizId` does not exist and the second clause
is vacuously true — Phase 5's completion logic is written so Phase 6 adds a
conjunct, not a rewrite.

### D19 — No `MediaVariant` table and no variant pipeline; `next/image` already does it ⟶ ADR-057

> **SUPERSEDED 2026-09-08 by `changes-12-plan.md`.** The owner chose the full
> media architecture (object storage + presigned uploads + BullMQ workers +
> Sharp + self-hosted FFmpeg/HLS + CDN). The reasoning below is retained as the
> record of what was weighed; **do not implement from it.** See changes-12 §10
> for the item-by-item mapping.

**(new in v2 — owner §57, §58, §71)**

`apps/web/next.config.ts` configures `images` and the app uses `next/image`.
Next's optimizer already resizes on demand, serves WebP/AVIF by content
negotiation, generates the responsive `srcset` from the `sizes` prop, and caches
the results — for same-origin `/uploads/*` paths without any allowlisting.
Building `thumbnail/small/medium/large` variants at upload time, storing them as
`MediaVariant` rows, and picking between them in the app would **duplicate a
system we already run** and add a table, a pipeline and a cache to keep
coherent.

**Decision:** no variant generation, no `MediaVariant` table. Course cover and
thumbnail sizes are `sizes`/`width` props on `next/image` — code, per ADR-042.

**What `sharp` at upload genuinely buys, and is worth doing (Phase 3):**

| Gap                      | Why it matters                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EXIF stripping**       | An uploaded phone photo carries GPS coordinates. `next/image` output drops them, but `/uploads/[file]` serves the **original** bytes directly — so today they are publicly retrievable. This is a real privacy leak, and it is the strongest argument in the whole media section. |
| **Max-dimension clamp**  | A 12000×8000 upload is stored whole and re-optimised on every new size. Clamp the long edge (4000 px) on save.                                                                                                                                                                    |
| **Dimension extraction** | `MediaAsset.width`/`height` are nullable and currently unfilled for some paths; the picker and `next/image` both want them.                                                                                                                                                       |
| **Animated GIF / SVG**   | Explicit branches: never re-encode an animated GIF, never rasterise an SVG (it already gets the sandbox CSP at serve time).                                                                                                                                                       |

That is one dependency (`sharp`), synchronous, ~60 lines inside the existing
`storeImage()`, no queue, no new table, no new states.

### D20 — Large uploads get a route handler, not a bigger Server Action limit ⟶ ADR-057

> **SUPERSEDED 2026-09-08 by `changes-12-plan.md`.** The owner chose the full
> media architecture (object storage + presigned uploads + BullMQ workers +
> Sharp + self-hosted FFmpeg/HLS + CDN). The reasoning below is retained as the
> record of what was weighed; **do not implement from it.** See changes-12 §10
> for the item-by-item mapping.

**(new in v2 — owner §55, and a v1 finding sharpened)**

v1 noted `MAX_UPLOAD_BYTES = 5 MB` (`media.ts:20`) is too small for course PDFs.
The audit found the constraint behind it: `next.config.ts` sets
`experimental.serverActions.bodySizeLimit: "6mb"`, sized deliberately to
5 MB + multipart overhead (ADR-017). Uploads arrive as Server Action FormData.

**Raising that limit to 26 MB would raise it for every Server Action on both
surfaces** — every admin form, every public action — which is a denial-of-service
surface, not a media setting.

**Decision:**

- `MAX_UPLOAD_BYTES` becomes a per-`MediaKind` map: `IMAGE` 5 MB, `DOCUMENT`
  25 MB, `VIDEO`/`AUDIO` unchanged pending D22.
- Anything above the Server Action limit uploads through a **dedicated route
  handler** (`POST /admin/api/media/upload`) that streams the body, with
  `gateForPurpose()` + `requirePermission("media.upload")` first. Server Actions
  keep the 6 MB limit and keep handling images.
- Validation is unchanged and shared: magic-byte sniffing via
  `validateMediaUpload()`, then `storeMedia()`. **One pipeline, two transports**
  — which is exactly the owner's §74 "do not introduce a second media pipeline".

### D21 — Media lifecycle is already built; add a GC script, not a subsystem ⟶ ADR-057

**(new in v2 — owner §65, §66, §67)**

The owner's proposed lifecycle —
`DB deletion → asset marked unused → background cleanup → physical deletion` —
is **already implemented up to the last step**:

- `ContentReference` records every placement (`refType: MEDIA`), and its enums
  already include `ReferenceSourceType.COURSE` and `ReferenceType.COURSE`.
- `deleteMedia()` (`media.ts:696`) counts references and throws
  `MediaAssetInUseError` with a per-source-type breakdown rather than deleting.
- An unreferenced asset is **soft-deleted** (`deletedAt`), never hard-deleted.
  The comment at `media.ts:693` records that there is deliberately no hard-delete
  UI.

**The only gap is physical file removal for soft-deleted, unreferenced rows.**
That is a periodic sweep, and this repo has no scheduler (§0.1).

**Decision:** a `pnpm media:gc` maintenance script (dry-run by default,
`--commit` to act) that deletes files for rows soft-deleted more than N days ago
with zero references. Ops runs it, or a host cron does. It is guarded by the
already-seeded `system.maintenance` permission concept and writes an audit row.
**Not** a queue, **not** a worker, **not** a new dependency.

**Permissions (owner §66):** `media.view`, `media.upload`, `media.update`,
`media.delete` are already seeded (`seed.ts:54-57`). Use them. Create nothing.

**Security (owner §67):** magic-byte sniffing, extension derived from sniffed
type (never the client's), random 24-hex object keys (so the client filename
never reaches the filesystem), `OBJECT_KEY_PATTERN` enforced before any disk
access, `nosniff`, and a sandboxing CSP on SVG responses — all already in place
(`media.ts`, `uploads/[file]/route.ts`). Two additions: EXIF stripping (D19) and
a length/charset cap on the display-only `fileName`. **Malware scanning is out
of scope** — ClamAV is an infrastructure dependency, not a code change; the
mitigations that actually apply to this threat (never execute, never serve as
inline HTML, correct Content-Type, `nosniff`) are already shipped.

### D22 — Video stays embed-only; async processing is designed for, not built ⟶ ADR-057

> **SUPERSEDED 2026-09-08 by `changes-12-plan.md`.** The owner chose the full
> media architecture (object storage + presigned uploads + BullMQ workers +
> Sharp + self-hosted FFmpeg/HLS + CDN). The reasoning below is retained as the
> record of what was weighed; **do not implement from it.** See changes-12 §10
> for the item-by-item mapping.

**(new in v2 — owner §60–63, and the owner's own revision)**

The owner already revised this correctly: don't force self-hosted video into
Phase 1. The audit shows why that revision matters more than it may have looked
— **the prerequisites are not "add FFmpeg", they are an entire subsystem this
repo does not have:**

a worker process (none), a job queue (none), a retry/dead-letter policy (none), a
deployment target to run the worker (the app is a single Next.js process), FFmpeg
in that image (absent), a transcode ladder, an HLS packager, and a CDN (none).

**Decision for this programme:** video is external-embed only, exactly as
Phase 1 already has it via `parseVideoUrl`. "Architecture ready" means precisely
three things and nothing more:

1. `MediaKind.VIDEO` already exists, `storeMedia()` already accepts mp4/webm,
   `/uploads/[file]` already serves Range requests. Untouched.
2. The `StorageDriver` seam (ADR-017) stays the only path to bytes, so an S3/CDN
   swap later is a driver change.
3. `MediaAsset` gains a `status` column **in the phase that introduces
   asynchronous processing, not before.** A `PROCESSING` state no code can
   produce is a lie in the schema, and the pre-launch reset policy means adding
   the column later is free. (Same reasoning as D9's `videoPositionSec`.)

**And a recommendation the owner asked for by asking for the comparison:** when
uploaded video is genuinely needed, compare a managed platform (Mux, Cloudflare
Stream, Bunny) against self-hosted FFmpeg+HLS+CDN _before_ assuming the latter.
For a team this size the managed option is a smaller system, not a bigger one:
it removes the worker, the queue, the ladder, the packager and the CDN in
exchange for an API key and a per-minute cost, and it fits the existing
`StorageDriver` seam as one more driver. Self-hosting is the right answer only
if cost at volume or data residency demands it. Either way it is its own ADR and
its own programme.

### D23 — Media organisation: folder paths by id, dedup by checksum ⟶ ADR-057

> **PARTLY SUPERSEDED 2026-09-08 by `changes-12-plan.md`.** The dedup design
> moves into the worker's `media.validate` stage (changes-12 M11). The
> folder-as-path decision and the rejection of `MediaAsset.courseId`/`lessonId`
> **still stand** — changes-12 creates neither `media_folders` nor `media_usages`.

**(new in v2 — owner §56, §64, §68, §69)**

**Folders.** ADR-034 §2 already decided this: `MediaAsset.folder` is a path
string with **no folder table**, indexed as `@@index([kind, folder])`. The
owner's own preferred shape ("logical folders + storage keys, physical storage
abstract") is what already exists. Course media therefore uses a convention:

```
/courses/<courseId>/images
/courses/<courseId>/documents
/courses/<courseId>/video
```

**Keyed by course id, not slug** — a slug rename would otherwise orphan every
folder path, and folder is denormalised text with no FK to fix up. The picker
resolves ids to course titles for display, so the admin sees "Forex Basics", not
a cuid (ADR-044 #5: a raw identifier never renders).

**Rejected: `MediaAsset.courseId` / `lessonId` columns.** They duplicate
`ContentReference`, which already answers "what uses this asset" with ordering
and field-level precision, and they break reuse — one asset legitimately appears
in two courses, which a single FK cannot express.

**Dedup (§64).** `MediaAsset` has no content hash today. Add
`checksum String? @db.VarChar(64)` (SHA-256 of the bytes) with a **non-unique**
index. On upload, a match offers "Use the existing file / Upload anyway" —
non-unique precisely because the owner's own sketch keeps the second option, and
because two courses may want independently-deletable copies. Computing the hash
is a few lines in `storeMedia()` on bytes already in memory.

**Picker UX (§68, §69).** The picker opens scoped to the current course's
folder with an "All media" escape hatch, and uploads from a lesson default to
that course's folder. Scope-first, not scope-only — an admin reusing the site
logo inside a lesson must not have to re-upload it.

### D24 — Quizzes: the quiz is the entity, placement is a FK on the consumer ⟶ ADR-058 (Phase 6)

**(new in v2 — owner §45–51)**

The owner asked whether nullable `courseId`/`lessonId` on `Quiz` is right, or
whether something more normalised is preferable. Nullable FKs on the quiz make
illegal states representable (both set? attached to a lesson in another course?)
and make reuse impossible.

**Decision — invert it. The quiz is standalone by nature; consumers point at
it:**

```
Quiz            id, slug, passingScore, maxAttempts?, showAnswersAfter, isStandalone, status
Lesson.quizId       → Quiz?     lesson quiz     (drives QUIZ_PASS, D10)
Course.finalQuizId  → Quiz?     final quiz      (drives completion, D18)
Quiz with neither pointing at it, and isStandalone → /learn/quizzes/[slug]
```

One model, three use cases, no illegal states, and the same quiz can be reused
in more than one place. `isStandalone` controls public listing only — a lesson
quiz is not listed at `/learn/quizzes` even though it is technically reachable
by slug.

**Question types (§46), Phase 6:** `SINGLE_CHOICE`, `MULTIPLE_CHOICE`,
`TRUE_FALSE`. Ordering, matching, short answer and image questions are not
implemented; the `type` enum makes them additive.

**Attempts (§47, §50):** `QuizAttempt` — `quizId`, `userId`, `score`,
`percentage`, `passed`, `attemptNumber`, `startedAt`, `completedAt`, plus
`answers Json`.

**Per-answer rows: deliberately not created, with one named cost.** Submitted
answers are only ever read as a whole set, for one attempt, by one user — no
query filters on them, so a `QuizAttemptAnswer` table would be
rows-per-question-per-attempt for zero query benefit. `answers Json` on the
attempt serves the review screen (§48) exactly as well. **The one thing it
forecloses cheaply is §51's "most frequently missed questions"**, which needs
SQL aggregation across attempts. That analytic — and only that one — is the
trigger for adding `QuizAttemptAnswer` in Phase 9; everything else in §51
(attempts, average score, pass rate) aggregates fine from `QuizAttempt`.

**Answer review (§48):** `Quiz.showAnswersAfter` — `NEVER` / `AFTER_SUBMIT` /
`AFTER_PASS`. Per-option `explanation` on the translation row, authored by the
admin.

**Attempt limits (§47):** `maxAttempts Int?` — null means unlimited, which is
the default and the right one for a learning site.

**Translations:** `QuizTranslation` (title, description) and
`QuizQuestionTranslation` (prompt, options JSON, explanations). The **correct
answer lives on the untranslated `QuizQuestion` row** — a correct-answer index
is not language, and putting it in a translation lets a translator desync it.

### D25 — The Learn area gets a static sub-nav; `/glossary` does not move ⟶ ADR-055

**(new in v2.2 — owner reference screenshots)**

Both references put a persistent row of section tabs above the learning
surfaces — Babypips: _Crypto School · Crypto Quizzes · Crypto Glossary · Crypto
Guides_; FOREX.com: _Courses · Lessons · Interactive Livestreams · A-Z Glossary ·
Quiz · The Trader's Course_. It is the single strongest pattern in the set,
because it turns four separate pages into one destination.

**Decision:** a `LEARN_SECTIONS` code registry in the app (the shape
`ABOUT_ROUTE_KEYS` already uses), rendered by a `LearnSectionNav` modelled on
the existing `about/_components/section-nav.tsx`. Static and code-owned, per
ADR-042 — adding a section is a code change, exactly like the About section.

```
Courses    /learn              always
Quizzes    /learn/quizzes      Phase 6, hidden while the `quizzes` flag is off
Glossary   /glossary           existing route, linked as a sibling
```

**`/glossary` stays where it is.** It has a seeded menu row, a live sitemap
entry and indexed URLs; moving it under `/learn` would mean 301s for every term
in exchange for a tidier tree. The sub-nav links across to it and marks it
current — the nav is a _view_ of the learning surfaces, not their URL structure.

A section whose feature flag is off is **absent from the nav**, not disabled —
the flag gate already 404s the route, and a tab that leads to a 404 is worse
than no tab.

### D26 — Filters that narrow an on-page set are client-side; filters that create a collection are routes ⟶ ADR-055

**(new in v2.2 — the caching decision behind every filter the owner asked for)**

This is the constraint the reference sites do not have and we do. Under Cache
Components, reading `searchParams` makes a page **dynamic**, which
`architecture.md` #6 forbids for public routes. So `/learn?difficulty=beginner`
is not available to us, and the answer is not "make it dynamic" — it is to pick
the right mechanism per filter:

| Filter                                                 | Mechanism                     | Why                                                                                                    |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Course difficulty (ALL/BEGINNER/INTERMEDIATE/ADVANCED) | **client-side**               | Every course is already in the payload; filtering is a `useState`, costs no request and no cache entry |
| Quiz category                                          | **client-side**               | Same — the quiz index is one page of cards                                                             |
| Glossary A–Z                                           | **anchors** now, routes later | See below                                                                                              |
| Glossary topic                                         | **routes**                    | A topic is a durable, linkable, indexable collection with its own name, description and SEO            |
| Glossary / quiz text search                            | **client-side**               | The set is already loaded; instant, no request, no cache impact                                        |

**The rule, stated once:** if the filter narrows a set that is already on the
page, it is client state. If it produces something a person would bookmark,
share or find in search results, it is a route. Nothing becomes a search param.

**Glossary A–Z specifically.** The page already groups terms by letter
(`glossary/page.tsx` builds a `byLetter` map) — what is missing is the chip row.
Ship the chips as **anchor links** (`#a`, `#b`, …) with a sticky chip bar: one
page, fully cached, works without JavaScript, and matches what the data volume
justifies today. Letter _routes_ (`/glossary/letter/[letter]`, 27 statically
generated pages) become worth their weight only when one page gets heavy —
**the threshold is roughly 300 published terms**, and crossing it is the trigger
to revisit, not a judgement call to make now.

A disabled chip for a letter with no terms is rendered but not clickable, so the
row does not reflow as the glossary grows.

### D27 — Glossary topics become a real model; `category` free text goes ⟶ ADR-055

**(new in v2.2 — owner "Browse by Topic")**

The reference's topic browse shows a topic heading with a chevron into a topic
page, and terms grouped beneath it. `GlossaryTerm.category` is
`String? @db.VarChar(80)` — free text with no slug, no translation, no
description, no ordering and no page to link to. It cannot support the pattern,
and it violates two rules we already hold: ADR-044 #5 (a raw identifier never
renders) and ADR-043 #1 (public strings are translatable).

**Decision:** `GlossaryTopic` + `GlossaryTopicTranslation`, mirroring
`ArticleCategory` / `ArticleCategoryTranslation` **exactly** — a proven pattern
in this repo, so there is nothing new to design. `GlossaryTerm.topicId` replaces
`category`. Pre-launch reset, no backfill.

```
/glossary                    A–Z browse (default view)
/glossary/topics             all topics, grouped A–Z by topic name
/glossary/topics/[topic]     one topic: description + its terms
/glossary/[slug]             term detail (exists)
```

**Scope warning, stated plainly:** this is Module 11/12 glossary work, not Learn
area work. It is in this plan because the owner asked for one consistent
presentation across the public data surfaces, but it has its own phase (Phase 10) and **must not be allowed to delay Phases 1–5.** If the schedule tightens,
this is the first thing to cut — the A–Z chips (D26) deliver most of the
perceived improvement on their own and need no schema change at all.

### D28 — "Was this lesson helpful?" is a small table, not a counter pair ⟶ ADR-056

**(new in v2.2 — FOREX.com lesson footer)**

Two integer counters on `Lesson` would be cheaper and would answer only "what is
the ratio right now". A row per vote answers "which lessons got worse after the
March rewrite", which is the question an editor actually asks.

```prisma
model LessonFeedback {
  id        String   @id @default(cuid())
  lessonId  String
  userId    String?                        // null for anonymous
  helpful   Boolean
  createdAt DateTime @default(now())

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([lessonId, userId])             // one vote per signed-in learner
  @@index([lessonId, helpful])             // the editorial rollup
  @@map("lesson_feedback")
}
```

Anonymous votes are accepted (the reference asks before sign-in, and gating it
would collect almost nothing) and deduped **per browser via `localStorage`** —
which is UX, not security, and is stated as such. The endpoint is rate-limited
per IP like every other public write. `@@unique([lessonId, userId])` is enforced
only for signed-in rows; MariaDB treats `NULL`s as distinct in a unique index,
which is exactly the behaviour wanted here and is worth a comment in the schema
so nobody "fixes" it later.

### D29 — "Term of the day" rotates deterministically; no cron, no column ⟶ ADR-055

**(new in v2.2 — Decryptopedia masthead)**

The reference's "Term of the Day" / "Topic of the Day" cards need no editorial
queue and no scheduler.

**Decision:** `index = hash(YYYY-MM-DD) % publishedCount`, computed in the cached
loader, with `cacheLife` set to a daily profile so the page re-renders once a
day rather than on every request. No `featuredOn` column, no cron job, no admin
screen. It is stable within a day, different the next, and identical for every
visitor — which is the whole of the requirement.

If an editor ever needs to _choose_ the term of the day, that is a different
feature with a different cost, and it should be asked for explicitly rather than
built speculatively.

### D30 — Course cards expand their curriculum inline ⟶ ADR-055

**(new in v2.2 — FOREX.com "Show Lessons")**

The reference lets a learner open a course's lesson list without leaving the
index — a genuinely good affordance, since choosing a course is mostly a
question of "what is actually in it".

**Decision:** `getLearnIndex()` returns section and lesson **titles** with each
course (titles and slugs only — never bodies), and the card expands
client-side. The payload cost is small and bounded; the alternative — fetching
on expand — puts a request in the path of a hover-speed interaction and cannot
be cached with the page.

The expanded list reuses `CurriculumList` in a compact variant, so lesson state
markers work there too once the progress island (D6) hydrates.

### D31 — "Guides" is a presentation of articles, not a new content type ⟶ no ADR

**(new in v2.2 — Babypips Coin Guides / Token Guides)**

The reference's guide hub is category-grouped cards with a "View All" per group.
We already have `Article` + `ArticleCategory` + `ArticleTag`, and `/news`
**already renders exactly this shape** via `getCategoryDigests` (per-category
bands under a general feed, added in the 2026-09-07 second pass).

**Decision:** no `Guide` model, no new `ArticleKind`. If a guides hub is wanted,
it is a coded route over existing article data reusing `getCategoryDigests` and
`ArticleCards` — a day's work, no schema. It is **not** in this programme's
scope; it is recorded here so that when someone asks for it, the answer is
already known and nobody adds a fourth content type.

---

---

## 4. Information architecture

```
/learn  (code: route + track registry)
  │
  ├─ Track "forex" | "crypto"   code — LEARN_TRACKS in @repo/contracts
  │    └─ Course                DB   — Course + CourseTranslation
  │         ├─ externalUrl?     DB   — external course (D15)
  │         ├─ CourseSection    DB   — grouping only; never in a URL
  │         │    └─ Lesson      DB   — Lesson + LessonTranslation
  │         │         ├─ body           sanitized HTML
  │         │         ├─ videoUrl       validated embed URL
  │         │         ├─ attachments    MediaAsset via LessonAttachment
  │         │         ├─ externalUrl    https link (D15/D16)
  │         │         └─ quizId         → Quiz          (Phase 6)
  │         ├─ finalQuizId      → Quiz                  (Phase 6, D18)
  │         └─ recommendations  ContentRelation         (D17)
  │
  ├─ Standalone quizzes  /learn/quizzes                 (Phase 6)
  │
  └─ Progress (per learner, never rendered on the server)
       ├─ CourseEnrollment  → lastLessonId, lessonsCompleted, completedAt
       ├─ LessonProgress    → status, completedAt
       └─ QuizAttempt       → score, passed              (Phase 6)
```

**Journeys (owner §72).**

```
New learner   /learn → course → Start Learning → lesson → Mark complete
                    → next lesson → … → Final Quiz → result
                    → Course completed → Recommended courses

Returning     /learn → Your courses → Continue Learning → last lesson

Guest         /learn → course → lesson → read/watch → "Sign in to save progress"

Standalone    /learn/quizzes → quiz → start → submit → result → recommended course
```

---

## 5. Database

### 5.1 Changed

```prisma
model Course {
  // + track          String   @db.VarChar(40)      // LEARN_TRACKS key (D2)
  // + externalUrl    String?  @db.VarChar(500)     // external course (D15)
  // + coverAssetId   String?                        // MediaAsset (D12)
  // + lessonCount    Int      @default(0)           // denormalised, service-maintained
  // + finalQuizId    String?                        // Phase 6 (D18)
  // - coverImageUrl                                 // replaced by coverAssetId
  // + @@index([track, status, sortOrder])
}

model CourseSection {           // was `Module` (D1)
  // unchanged shape; @@map("course_sections")
}

model Lesson {
  // renamed FK: moduleId -> sectionId
  // + externalUrl     String?        @db.VarChar(500)     // D15
  // + completionRule  CompletionRule @default(MANUAL)     // D10
  // + isRequired      Boolean        @default(true)       // D10/D18
  // + heroAssetId     String?                             // D12
  // + quizId          String?                             // Phase 6 (D24)
  // - coverImageUrl                                       // replaced by heroAssetId
  // keeps: videoUrl, prerequisiteLessonId, estimatedMinutes, visibility, status
}

model MediaAsset {
  // + checksum String? @db.VarChar(64)   // SHA-256, non-unique index (D23)
  // + @@index([checksum])
  // NOT added: status (D22), courseId/lessonId (D23), variants (D19)
}

enum CompletionRule { MANUAL QUIZ_PASS }
```

### 5.2 New — Phase 1

```prisma
model LessonAttachment {
  id        String   @id @default(cuid())
  lessonId  String
  assetId   String                      // MediaAsset
  sortOrder Int      @default(0)
  label     String?  @db.VarChar(200)   // display-only; translatable label deferred
  createdAt DateTime @default(now())

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([lessonId, sortOrder])
  @@map("lesson_attachments")
}

enum LessonProgressStatus { IN_PROGRESS COMPLETED }

model LessonProgress {
  id          String               @id @default(cuid())
  userId      String
  lessonId    String
  courseId    String               // denormalised: course rollups without joining through sections
  status      LessonProgressStatus @default(IN_PROGRESS)
  completedAt DateTime?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])   // idempotent writes
  @@index([userId, courseId])    // course page: one indexed read
  @@index([lessonId, status])    // analytics: drop-off per lesson
  @@map("lesson_progress")
}

model CourseEnrollment {
  id               String    @id @default(cuid())
  userId           String
  courseId         String
  lastLessonId     String?                       // "Continue Learning"
  lessonsCompleted Int       @default(0)         // maintained in the same tx as LessonProgress
  startedAt        DateTime  @default(now())
  completedAt      DateTime?
  lastActiveAt     DateTime  @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([userId, lastActiveAt])      // learner dashboard
  @@index([courseId, completedAt])     // admin analytics
  @@map("course_enrollments")
}
```

### 5.3 New — Phase 6 (quizzes, shape only; ADR-058 finalises)

```prisma
enum QuestionType     { SINGLE_CHOICE MULTIPLE_CHOICE TRUE_FALSE }
enum AnswerVisibility { NEVER AFTER_SUBMIT AFTER_PASS }

Quiz                     id, slug, passingScore, maxAttempts?, showAnswersAfter,
                         isStandalone, status, publishedAt, deletedAt
QuizTranslation          quizId, locale, title, description, slug   @@unique([locale, slug])
QuizQuestion             quizId, type, sortOrder, correctAnswer Json   ← untranslated
QuizQuestionTranslation  questionId, locale, prompt, options Json, explanations Json
QuizAttempt              quizId, userId, score, percentage, passed,
                         attemptNumber, answers Json, startedAt, completedAt
                         @@index([quizId, userId]) @@index([userId, completedAt])
```

### 5.4 Candidate tables from owner §71 that are **not** created

| Candidate                      | Instead                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `LearningProgram`              | `LEARN_TRACKS` code registry + `Course.track` (D2)                            |
| `CourseQuiz`/`CourseFinalQuiz` | `Course.finalQuizId` FK (D18)                                                 |
| `CourseRecommendation`         | existing `ContentRelation` + `replaceRelations()` (D17)                       |
| `MediaVariant`                 | `next/image` on-demand optimization (D19)                                     |
| `MediaFolder`                  | existing `MediaAsset.folder` path string, ADR-034 §2 (D23)                    |
| `QuizAttemptAnswer`            | `QuizAttempt.answers Json`; revisit only for §51 per-question analytics (D24) |
| `MediaAsset.status`            | added in the phase that introduces async processing, not before (D22)         |

### 5.5 New — presentation additions (v2.2)

```prisma
// D28 — lesson feedback. NULLs are distinct in a MariaDB unique index, so the
// constraint binds signed-in learners only and anonymous rows accumulate
// freely. That is intended; do not "fix" it to a partial/filtered index.
model LessonFeedback {
  id        String   @id @default(cuid())
  lessonId  String
  userId    String?
  helpful   Boolean
  createdAt DateTime @default(now())

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([lessonId, userId])
  @@index([lessonId, helpful])
  @@map("lesson_feedback")
}

// D27 — Phase 10 only. Mirrors ArticleCategory/ArticleCategoryTranslation.
// GlossaryTerm.category (VarChar(80) free text) is DROPPED in the same migration.
model GlossaryTopic {
  id        String   @id @default(cuid())
  sortOrder Int      @default(0)
  iconKey   String?  @db.VarChar(40)     // lucide key, validated against a code registry
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  translations GlossaryTopicTranslation[]
  terms        GlossaryTerm[]

  @@map("glossary_topics")
}

model GlossaryTopicTranslation {
  id          String  @id @default(cuid())
  topicId     String
  locale      String  @db.VarChar(10)
  name        String  @db.VarChar(120)
  slug        String  @db.VarChar(120)
  description String? @db.Text

  topic GlossaryTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([topicId, locale])
  @@unique([locale, slug])
  @@map("glossary_topic_translations")
}
```

**Deletion policy.** Course and Lesson keep `deletedAt` soft delete. Progress
rows cascade on **user** delete (GDPR-shaped) and on **lesson** delete; a
soft-deleted lesson keeps its progress rows, which makes restore a true
round-trip.

**Why `courseId` is denormalised onto `LessonProgress`:** the course page needs
"which of this course's lessons has this user completed" on every load. Without
it that is `progress → lesson → section → course`; with it, one index seek. The
write path sets it inside the same transaction that resolves the lesson, so it
cannot drift.

---

## 6. Services — `packages/core/src/`

Route handlers and actions call these and never touch Prisma
(`architecture.md` #2).

**`courses.ts`**

```ts
listCoursesAdmin(filter?): Promise<CourseAdminRow[]>
createCourse(actor, input): Promise<string>
saveCourse(actor, input): Promise<void>       // meta + translation + recommendations, one tx
setCourseDeleted(actor, id, deleted): Promise<void>
reorderCourses(actor, ids): Promise<void>
setCourseRecommendations(tx, courseId, targetIds): Promise<void>   // wraps replaceRelations (D17)
```

**`course-sections.ts`**

```ts
createSection(actor, courseId): Promise<string>
saveSection(actor, input): Promise<void>
reorderSections(actor, courseId, sectionIds): Promise<void>
deleteSection(actor, id): Promise<void>       // refuses while lessons remain
```

**`lessons.ts`**

```ts
listLessonsAdmin(courseId): Promise<LessonAdminRow[]>
createLesson(actor, sectionId): Promise<string>
saveLesson(actor, input): Promise<void>       // prepare/apply/finish, one tx
duplicateLesson(actor, id): Promise<string>
moveLesson(actor, lessonId, toSectionId, index): Promise<void>
reorderLessons(actor, sectionId, lessonIds): Promise<void>
setLessonDeleted(actor, id, deleted): Promise<void>
setLessonAttachments(actor, lessonId, items): Promise<void>   // + syncReferences (D12/D21)
```

**`public-courses.ts`** — cached, no session

```ts
getLearnIndex(locale): Promise<TrackGroup[]>                 // "use cache" + cacheTag("content")
getCourseBySlug(locale, slug): Promise<CourseView | null>    // "use cache" + cacheTag("content")
getLessonBySlug(locale, slug): Promise<LessonView | null>    // "use cache" + cacheTag("content")
resolveRecommendations(courseId, track, limit): Promise<CourseCardView[]>   // D17
loadLearnSitemapEntries(): Promise<SitemapEntry[]>
```

**`progress.ts`** — uncached, session-scoped, never called during page render

```ts
getCourseProgress(userId, courseId): Promise<CourseProgressView>
getLearnerDashboard(userId): Promise<EnrollmentSummary[]>
markLessonComplete(userId, lessonId): Promise<CourseProgressView>
markLessonIncomplete(userId, lessonId): Promise<CourseProgressView>
touchLesson(userId, lessonId): Promise<void>                 // IN_PROGRESS + lastLessonId
recomputeCourseCompletion(tx, userId, courseId): Promise<void>   // D18-shaped from day one
```

**`quizzes.ts`** — Phase 6

```ts
listQuizzesAdmin(filter?) / createQuiz / saveQuiz / setQuizDeleted
getQuizBySlug(locale, slug)              // "use cache" + cacheTag("content") — questions only, never answers
submitQuizAttempt(userId, quizId, answers): Promise<QuizResultView>   // scoring is server-side, always
getAttemptsForUser(userId, quizId)
```

**Scoring never happens on the client and correct answers never reach it.**
`getQuizBySlug` returns prompts and options; `correctAnswer` is stripped in the
view type, not merely hidden in the UI. That is `security.md` #6's parse-don't-
spread discipline applied to a read path.

**Cache tags.** Reuse `content` (`architecture.md` #12 — the frozen tag for all
content reads). Do **not** invent `course:{id}`. `revalidateTag("content",
{ expire: 0 })` after every admin write, as articles already do.

---

## 7. Contracts — `packages/contracts/src/learn.ts`

```ts
export const LEARN_TRACKS = {
  forex: { titleKey: "learn.tracks.forex", icon: "line-chart", sortOrder: 1 },
  crypto: { titleKey: "learn.tracks.crypto", icon: "bitcoin", sortOrder: 2 },
} as const satisfies Record<string, LearnTrackSpec>;
export type LearnTrackKey = keyof typeof LEARN_TRACKS;
export function isLearnTrack(key: string): key is LearnTrackKey;

export const RESERVED_COURSE_SLUGS = ["quizzes"] as const; // D3
export const externalUrlSchema = z
  .url()
  .max(500)
  .refine((u) => u.startsWith("https://"));
```

Zod v4 schemas (`code-style.md` #12) for every service input:
`courseInputSchema` (rejects reserved slugs), `courseTranslationSchema`,
`sectionInputSchema`, `lessonInputSchema` (**enforces at least one capability**,
D15), `lessonAttachmentsSchema`, `recommendationsSchema`, `progressWriteSchema`,
`quizInputSchema`, `quizSubmissionSchema`. Every server action and route handler
parses through these before use (`security.md` #6).

---

## 8. Admin

### 8.1 Navigation

```
Learning
  Courses     /admin/learn/courses        courses.view
  Lessons     /admin/learn/lessons        lessons.view   (flat list + OUTDATED queue)
  Quizzes     /admin/learn/quizzes        Phase 6
  Progress    /admin/learn/progress       analytics.view (Phase 9)
```

Sections get **no** top-level screen — they exist only inside a course. Media
stays in the existing `/admin/media` library; the learning system adds folder
scoping to it, not a second library.

### 8.2 Course builder — `/admin/learn/courses/[id]`

- **Details** — title, slug, summary, description, track, difficulty, estimated
  hours, cover (media picker), **external URL**, visibility, status.
- **Curriculum** — the tree. Sections with move controls; lessons nested,
  movable within and between sections. Add / duplicate / delete /
  publish-toggle inline. **Final quiz** slot at the end (Phase 6).
- **Recommendations** — ordered course picker writing `ContentRelation` (D17),
  with the same-track fallback shown as a preview so the admin sees what a
  learner will actually get.
- **SEO** — reuses the article editor's SEO panel and analysis.

Drag-and-drop: **check whether a DnD library already exists before adding one**
(ADR-038 paused a navigation reorder UI; there may be precedent). Either way,
keyboard-accessible move-up/move-down ships **first** and DnD is layered on top.
DnD without a keyboard equivalent does not ship.

### 8.3 Lesson editor — `/admin/learn/lessons/[id]`

| Panel           | Source                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| Body            | `rich-text-editor.tsx` + `editor-extensions.ts` — as-is                            |
| Publish         | `_panels/publish-panel.tsx` — as-is (status machine, ADR-053)                      |
| SEO analysis    | `_panels/seo-analysis.tsx` — as-is                                                 |
| **Placement**   | new — course, section, position, prerequisite lesson                               |
| **Lesson meta** | new — duration, difficulty, `completionRule`, `isRequired`, visibility             |
| **Resources**   | new — hero asset, video embed URL, **external URL**, attachments (picker, reorder) |
| **Objectives**  | new — list editor writing `LessonTranslation.learningObjectives` (Json, exists)    |
| **Quiz**        | Phase 6 — attach an existing quiz or create one inline                             |

The Resources panel shows the derived badge live ("External · YouTube") so the
admin sees what the learner will see, and surfaces the D15 validation error when
no capability is set.

Admin display conventions (ADR-044) are binding: no raw identifiers on screen
(track keys, enum members and course ids in folder paths go through catalog
strings, stored names or `humanizeKey()`), no `<code>` for chrome,
`ConfirmDialog` on every delete/detach, filters inside the `DataTable` toolbar.
**Admin strings are English-only** (ADR-043 #2).

---

## 9. Public

### 9.1 Routes

```
app/(public)/[locale]/learn/
  page.tsx                     school index
  [course]/page.tsx            course detail
  [course]/[lesson]/page.tsx   lesson
  quizzes/page.tsx             standalone quiz index    (Phase 6)
  quizzes/[quiz]/page.tsx      quiz                     (Phase 6)
```

Explicit route files take Next precedence over `[...slug]`, as `news/`,
`glossary/` and `about/` already do. Every route is gated on the `courses` flag
and **404s when disabled**, not blank. **A track with zero published courses
renders no band at all** — with two tracks registered and possibly one prepared,
this is the most likely visible bug in the programme, so it is a test (§15).

### 9.2 Components

New in `@repo/ui` (shared, themable, no admin deps — `architecture.md` #5):

```
CourseCard        artwork, title, summary, lesson count, difficulty, CTA slot
CurriculumList    sections + lessons, collapsible (built on Accordion)
LessonStateIcon   completed / in-progress / not-started / locked
ExternalBadge     "External · YouTube" + external-link affordance (D15/D16)
ProgressBar       wrapper over the existing Progress with label + a11y text
LessonNav         previous / next, sticky on mobile
QuizResultCard    score, percentage, pass/fail, attempt number    (Phase 6)
```

App-local, session-aware, in `learn/_components/`:

```
CourseProgressIsland    client — hydrates GET /api/learn/progress
ContinueLearningButton  client — label derives from state
MarkCompleteButton      client — optimistic, POSTs, reconciles
SignInToTrackCard       server — static; the island hides it when signed in
```

The island pattern: the server renders the full curriculum statically with every
lesson in its "not started" state, and the client swaps in real state on
hydrate. No layout shift, because markers occupy their space from first paint.

### 9.3 Mobile

Not a shrunk desktop: on `< md` the course page leads with the CTA and progress,
then the curriculum accordion with all sections collapsed except the one holding
the next lesson. The lesson page moves the curriculum into a `Sheet` behind a
"Contents" button and pins `LessonNav` to the bottom. Both are existing
`@repo/ui` primitives — the mobile nav sheet pattern exists in Module 08.

### 9.5 Presentation patterns adopted from the references

Six reference screens (Babypips Forexpedia topics, Crypto Guides, Crypto
Quizzes, a quiz in progress, Decryptopedia, and FOREX.com's Academy course index
and lesson page) were reviewed for **information architecture and affordances
only** — no visual design, illustration, colour or copy is taken. Everything
below renders in ADR-018's public design system.

#### Learn index — `/learn`

```
┌ LearnSectionNav ────────────── Courses · Quizzes · Glossary ────┐
├ PageHero ─────────── title, one-line promise, ambient motif ────┤
├ Filter chips ─────── All · Beginner · Intermediate · Advanced ──┤  client-side (D26)
├ Track band: Forex ──────────────────────── (omitted if empty) ──┤
│   CourseCard  CourseCard  CourseCard                            │
├ Track band: Crypto ─────────────────────────────────────────────┤
│   CourseCard  CourseCard                                        │
└ CTA band ───────────────────────────────────────────────────────┘
```

For a signed-in learner the island (D6) inserts a **"Your courses"** band above
the first track, and each card's CTA becomes Continue rather than Start.

#### CourseCard anatomy

Taken from the FOREX.com card, which is the more useful of the two references
because it front-loads the decision:

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Advanced trading strategies      [START ▸]  │
│  artwork   │  [ADVANCED] [3 LESSONS]                      │
│  16:9      │  A few unique strategies to give you an edge. │
│            │  ▸ Show lessons                     ← D30    │
└────────────┴──────────────────────────────────────────────┘
        expanded ↓
          ○ How to trade non-farm payrolls   4-min read
          ○ Open range breakout trade        3-min read
          ○ Interest rate trading            3-min read
```

Difficulty and lesson count are badges, not prose. Reading time comes from the
existing `Lesson.estimatedMinutes`. An **external course** (D15) shows an
`ExternalBadge` and its CTA reads "Open course ↗" instead of "Start".

#### Course detail — `/learn/[course]`

The FOREX.com header pattern, which puts progress where the decision is made:

```
┌ dark band ──────────────────────────────────────────────────────┐
│ Breadcrumb   Learn / Advanced trading strategies                │
│ [ADVANCED]  Advanced trading strategies    Progress ▓▓░░░  0%   │
│                                            0 of 3 lessons       │
│                                            [ CONTINUE LEARNING ]│
└─────────────────────────────────────────────────────────────────┘
  CurriculumList (sections, collapsible; the section holding the
  next lesson is open)          │  sidebar: what you'll learn,
                                │  duration, recommendations (D17)
  Final quiz card  (Phase 6)    │
```

#### Lesson — `/learn/[course]/[lesson]`

```
┌ sidebar ─────────────┬ body ────────────────────────────────────┐
│ Lessons              │ H1  ·  4-minute read                      │
│  ● this one          │ prose, callouts, images, video, tables    │
│  ○ next              │ attachments (PDF/download)                │
│  ○ after that        │ external resource card (D15)              │
│                      │ ─────────────────────────────────────     │
│ [CTA slot]           │ Was this lesson helpful?  [Yes] [No]  D28 │
│  static, code-owned  │ [ MARK COMPLETE ]        [ NEXT LESSON ▸ ]│
└──────────────────────┴───────────────────────────────────────────┘
```

The sidebar collapses into a `Sheet` behind a "Contents" button below `md`, and
`LessonNav` pins to the bottom of the viewport (§9.3). The **CTA slot** is the
FOREX.com "Put your knowledge into practice" card — one static, code-owned
promo per track, not an admin-editable block (ADR-042).

#### Quiz index — `/learn/quizzes` (Phase 6)

```
├ masthead ───────────────────────────────────────────────────┤
├ Save-your-scores prompt ── shown to guests only ────────────┤
├ Popular ───────────────── carousel, existing Carousel ──────┤
├ Category chips ────────── All · Bitcoin · Charting · … ─────┤  client-side (D26)
└ All quizzes ───────────── grid: title, category tag, [Start] ┘
```

#### Quiz runner — `/learn/quizzes/[quiz]` (Phase 6)

```
        ‹ Browse all quizzes
              Bitcoin Basics

  QUESTION 1/9   ▓▓░░░░░░░      YOUR SCORE  ✓ 0   ✗ 0

        Q: Name the original cryptocurrency?

        ( Digicoin )   ( Dogecoin )
        ( Bytecoin )   ( Bitcoin  )
```

Pill options, one question at a time, a live counter and a running score. The
score is **server-authoritative** (§6): the client shows what the server
returned for the previous answer and never computes correctness itself. On
submit, the result card (score, percentage, pass/fail, attempt number) and — if
`showAnswersAfter` allows — per-question review with the admin's explanation.

#### Glossary — `/glossary`

The Decryptopedia and Forexpedia patterns combined, minus the parts that need
data we do not have:

```
├ masthead ───────────────────────────────────────────────────┤
├ Term of the day  │  Topic of the day ──────────── D29 ──────┤
├ Tabs ─────────── Browse by term · Browse by topic · Search ─┤
├ A–Z chips ────── # A B C … Z   (anchors; empty = disabled) ─┤  D26
└ Terms grouped by letter, with the short definition inline ──┘
```

"Browse by topic" links to `/glossary/topics` (D27). "Search" is a client-side
filter over the loaded set, not a request. Each term shows its
`simpleExplanation` inline — the reference does this and it is why the page is
useful without a click.

#### What is deliberately **not** adopted

- **The right-hand partner/affiliate rail.** Advertising placement is a
  commercial decision, not a presentation one, and it is not in this programme.
- **The inspirational quote band.** No.
- **"What to read next" as a separate carousel on every page.** We already have
  recommendations (D17) and `ArticleCards`; a third related-content mechanism on
  the same page is noise.
- **A "Lessons" tab listing every lesson across all courses.** FOREX.com has
  one; it is a flat list of hundreds of items with no context, and our
  `/learn` + course pages already cover the same intent better. The admin gets
  a flat lesson list (§8.1) because editors genuinely need one; learners do not.
- **Livestreams / "The Trader's Course"** — features we do not have.

---

---

## 10. i18n, RTL, a11y

- A new **public** `learn` namespace (ADR-043 #1) — `check:catalog-completeness`
  enforces it for every locale in `ENFORCED_LOCALES`.
- **Logical properties only** (`code-style.md` #3). Curriculum tree, lesson nav
  arrows and progress bars are the highest-risk RTL surfaces here; RTL smoke
  runs `en` and `ar` over `/learn`, a course and a lesson.
- **A11y:** accordion keyboard-operable; `LessonStateIcon` carries text
  alternatives, never colour alone; `ProgressBar` exposes `aria-valuenow` plus a
  visible "7 of 20 lessons"; single `h1` with ordered headings; external links
  announce that they open in a new tab. axe serious/critical fail CI.

---

## 11. SEO

- `generateMetadata` per course, lesson and quiz from `*Translation` SEO fields,
  canonical + hreflang pairs — the helpers `/news` already uses.
- `sitemap.ts` gains `loadLearnSitemapEntries()`: **published, PUBLIC-visibility
  content only.** Draft, scheduled, `AUTHENTICATED` and `PREMIUM` items are
  excluded; unpublished routes 404 rather than `noindex`.
- JSON-LD `Course` on the course page (`plan.md` Module 12 asks for it), with
  `hasPart` from sections. None on lesson pages in Phase 1.
- An **external course** still gets a real indexable page with our description,
  and the outbound CTA is `rel="noopener noreferrer"` — it is a landing page, not
  a redirect. A course whose only content is an outbound link should carry enough
  original description to justify indexing; otherwise mark it `noindex`.
- Slug change → `Redirect` row → 301, via `createSlugRedirect()`.

---

## 12. Security

1. `requirePermission("courses.update")` etc. as the **first line** of every
   admin action (`security.md` #1). Keys come from the seeded registry — the CI
   cross-check (`testing.md` #5) fails on a typo.
2. `courses.publish` / `lessons.publish` gate the publish transition in the
   service, not the UI.
3. Rich text sanitized **server-side on save**, always (`security.md` #8).
4. **External URLs: stored, never fetched; HTTPS-only; framed only via
   `parseVideoUrl` (D16).** No CSP change in this programme.
5. IDOR: public loaders 404 on unpublished or insufficiently-visible content;
   `/api/learn/progress` scopes every read and write to the session user and
   404s on a lesson the caller cannot see. Module 14's learner-session probes
   extend to `/admin/learn/*`.
6. Progress and quiz-submit endpoints are rate-limited per account.
7. **Quiz answers are scored server-side and correct answers never enter the
   client payload** (§6).
8. Uploads: magic-byte sniffing, per-kind caps, `storeMedia()` only, EXIF
   stripped (D19), no arbitrary server-side URL fetch (SSRF).

---

## 13. Performance

- Course and lesson pages: `"use cache"` + `cacheTag("content")`, ISR. The lesson
  page carries the `plan.md` Module 12 LCP budget (< 2.5s) — the Lighthouse
  budget file must cover `/learn/*` before Phase 4 closes.
- **Never load the whole course tree on a lesson page.**
- `Course.lessonCount` and `CourseEnrollment.lessonsCompleted` are denormalised
  so index and dashboard are one indexed read each.
- The progress endpoint returns one course's rows, not a learner's history.
- Images via `next/image` (D19) with explicit `sizes`; attachments lazy.
- `@repo/ui` additions must not pull admin-only deps (`architecture.md` #5).

---

## 14. Phases and PRs

Adopting the owner's §75 restructure. Phases 1→5 are strictly ordered; 6, 7 and
8 are independent of each other once 5 lands.

### Phase 1 — Governance and schema

- **PR 1.1** ADR-055 (structure), ADR-056 (progress), ADR-057 (media). Merged
  **before** PR 1.2.
- **PR 1.2** Schema: the D1 rename; `Course.track`/`externalUrl`/`coverAssetId`/
  `lessonCount`; `Lesson.externalUrl`/`completionRule`/`isRequired`/
  `heroAssetId`; drop `*ImageUrl`; `MediaAsset.checksum`; add
  `LessonAttachment`, `LessonProgress`, `CourseEnrollment`, the two enums. One
  migration, `pnpm db:reset`.
- **PR 1.3** `@repo/contracts/learn.ts` — `LEARN_TRACKS` (forex + crypto),
  reserved slugs, every Zod schema.
- **PR 1.4** Seed: one demo course per track, 3 sections, ~8 lessons, one
  external lesson, published. `docs/erd.md` updated.

### Phase 2 — Course/lesson services

- **PR 2.1** `courses.ts` + `course-sections.ts` + integration tests
  (Testcontainers, real MariaDB).
- **PR 2.2** `lessons.ts` incl. `moveLesson`, `duplicateLesson`, attachments,
  external URL validation, `syncReferences` wiring.
- **PR 2.3** `public-courses.ts` cached readers + `resolveRecommendations` +
  sitemap entries.

### Phase 3 — Admin course builder

> PR 3.5 is **replaced** by `changes-12-plan.md` Phases M1–M4. Phases 1–5 here
> stay on the existing local-disk driver and do **not** block on that programme
> (changes-12 §1.1) — the `StorageDriver` seam swaps underneath without moving
> any learning code.

- **PR 3.1** Sidebar group; `/admin/learn/courses` list.
- **PR 3.2** Course editor — Details + SEO.
- **PR 3.3** Curriculum tab; keyboard move controls first, DnD on top.
- **PR 3.4** Lesson editor: article-editor reuse + Placement / Lesson meta /
  Resources / Objectives panels.
- **PR 3.5** Media: `sharp` (EXIF strip, dimension clamp, dimension extraction),
  checksum dedup, per-kind caps, the large-upload route handler (D20), course
  folder scoping in the picker (D23), `pnpm media:gc` (D21).

### Phase 4 — Public learning

- **PR 4.0** `LearnSectionNav` + `LEARN_SECTIONS` registry (D25); flag-absent
  tabs; `about/_components/section-nav.tsx` is the pattern to follow.
- **PR 4.1** `/learn` — track bands, `CourseCard` (D30 expandable curriculum),
  client-side difficulty chips (D26), flag gate, empty-track suppression.
  **Closes the live 404.**
- **PR 4.2** `/learn/[course]` — hero, curriculum, static all-not-started state.
- **PR 4.3** `/learn/[course]/[lesson]` — body, attachments, video, external
  resource, `LessonNav`, mobile Sheet.
- **PR 4.4** SEO: metadata, canonical/hreflang, sitemap, JSON-LD, breadcrumbs,
  redirects. Public `learn` catalog.
- **PR 4.5** Glossary presentation, no schema: A–Z chip bar with anchors and
  disabled empty letters, client-side search, term-of-the-day (D29). Ships
  independently of Phase 10.

### Phase 5 — Progress

- **PR 5.1** `progress.ts` + integration tests (idempotency, counter under
  concurrency). `recomputeCourseCompletion` written D18-shaped.
- **PR 5.2** `GET/POST /api/learn/progress`.
- **PR 5.3** Client islands; skeleton-then-resolve, no CLS.
- **PR 5.4** "Your courses" band; homepage `learning_paths` / `featured_lessons`
  sections (seeded `enabled: false` — enabling needs `pnpm db:reset`).
- **PR 5.5** `LessonFeedback` (D28): model, `POST /api/learn/feedback`,
  the helpful/not-helpful control, localStorage dedup, rate limit.
- **PR 5.6** Hardening: axe, RTL smoke, Lighthouse budget, learner-session
  probes, XSS suite extended to lesson bodies. DEVLOG entry.

### Phase 6 — Quizzes _(ADR-058 at kickoff; the `quizzes` flag stays off until it lands)_

Models (§5.3); admin quiz builder + inline attach from the lesson editor; public
lesson quiz, course final quiz, `/learn/quizzes`; attempts, results, review;
`QUIZ_PASS` and D18 course completion become reachable.

### Phase 7 — Recommendations

Admin picker writing `ContentRelation`; same-track fallback; course-page and
completion-state surfaces. Small, because D17 means there is no new persistence
to build.

### Phase 8 — Advanced media

> **Replaced in full by `changes-12-plan.md`.** Object storage, presigned
> uploads, the BullMQ worker, Sharp derivatives, FFmpeg/HLS transcoding and the
> CDN are specified there, and run in parallel with Phases 1–5 rather than after
> them.

### Phase 9 — Analytics and hardening

`/admin/learn/progress` from `LessonProgress` / `CourseEnrollment` /
`QuizAttempt`: started, completed, completion rate, per-lesson drop-off,
attempts, average score, pass rate, **least-helpful lessons from
`LessonFeedback` (D28)**. `QuizAttemptAnswer` only if per-question
analytics is actually wanted (D24). Full a11y/security/perf/RTL sweep.

### Phase 10 — Glossary topics _(D27; independent, cut first if the schedule tightens)_

`GlossaryTopic` + `GlossaryTopicTranslation`; drop `GlossaryTerm.category`;
admin topic CRUD reusing the `ArticleCategory` screens; `/glossary/topics` and
`/glossary/topics/[topic]`; the Browse-by-topic tab; topic-of-the-day. **Must
not delay Phases 1–5** — PR 4.5 already delivers most of the perceived
improvement without touching the schema.
---

## 15. Criterion → test

| Criterion                                                  | Test                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Header "Learn" link resolves                               | E2E: `/` → click Learn → 200, shelf renders                                                                     |
| `courses` flag off → 404, not blank                        | E2E, flag disabled, all routes                                                                                  |
| **Track with no published courses renders no band**        | Integration + E2E on `/learn` with `crypto` empty                                                               |
| **Course slug `quizzes` rejected**                         | Unit on `courseTranslationSchema` (D3)                                                                          |
| Reordering sections changes no URL                         | Integration: reorder, assert every lesson path unchanged                                                        |
| Slug change 301s the old path                              | E2E                                                                                                             |
| Illegal status transition rejected                         | Unit: DRAFT→PUBLISHED without APPROVED throws                                                                   |
| Publish without permission rejected                        | Integration: no `lessons.publish` → `PublishPermissionError`                                                    |
| Lesson body XSS stripped                                   | Unit: script / `onerror` / `javascript:` payloads absent after `saveLesson`                                     |
| Iframe host allowlist holds                                | Unit: `evil.com` iframe in a body → dropped                                                                     |
| **`http:` / `javascript:` external URL rejected**          | Unit on `externalUrlSchema` (D16)                                                                               |
| **Non-video external URL is never framed**                 | Component: renders an `<a rel="noopener noreferrer">`, no `<iframe>` (D16)                                      |
| **Lesson with no capability cannot be saved**              | Unit on `lessonInputSchema` (D15)                                                                               |
| **Server never fetches an external URL**                   | Integration: assert no outbound request during course/lesson save or render                                     |
| Unpublished lesson is 404, not 403                         | E2E as anonymous and as learner                                                                                 |
| `AUTHENTICATED`/`PREMIUM` hidden from anonymous            | Integration on the loader **and** E2E on the route (ADR-012)                                                    |
| No session read during public render                       | Cached RSC payload has no user field; page stays cached across two requests                                     |
| Progress endpoint scopes to caller                         | Integration: A cannot read or write B's progress                                                                |
| Double "mark complete" is idempotent                       | Integration: two writes → one row, counter = 1                                                                  |
| `lessonsCompleted` never drifts                            | Concurrency: N parallel completions → counter equals distinct completed lessons                                 |
| Course completes only on all required lessons              | Integration incl. an `isRequired: false` lesson left incomplete                                                 |
| **Course with a final quiz needs the pass**                | Integration: all lessons done, quiz unpassed → not complete (Phase 6, D18)                                      |
| Continue Learning returns to the last lesson               | E2E                                                                                                             |
| Guest sees curriculum + sign-in prompt, no progress        | E2E anonymous                                                                                                   |
| Editing a lesson does not un-complete it                   | Integration (D11)                                                                                               |
| **Recommendations: explicit order, then same-track fill**  | Unit on `resolveRecommendations`, incl. self-exclusion and dedup (D17)                                          |
| **Quiz answers never reach the client**                    | Integration: `getQuizBySlug` view type and payload carry no `correctAnswer`                                     |
| **Quiz scored server-side**                                | Integration: forged client score is ignored                                                                     |
| 6 MB PDF accepted, 6 MB image rejected                     | Unit on the per-kind cap map (D20)                                                                              |
| **Large PDF bypasses the Server Action limit**             | Integration on the upload route handler (D20)                                                                   |
| **EXIF is stripped from a stored image**                   | Unit: upload a GPS-tagged JPEG, read stored bytes, assert no EXIF (D19)                                         |
| **Oversized image is clamped**                             | Unit: 12000px upload → stored long edge ≤ 4000 (D19)                                                            |
| **Duplicate upload is detected**                           | Integration: same bytes twice → checksum match reported (D23)                                                   |
| **In-use media cannot be deleted**                         | Integration: place an asset on a lesson → `deleteMedia` throws (D21)                                            |
| **`media:gc` never deletes a referenced or recent asset**  | Unit + integration, dry-run and commit (D21)                                                                    |
| **No filter makes a public page dynamic**                  | Integration: `/learn`, `/learn/quizzes`, `/glossary` stay cached across two requests with filters applied (D26) |
| **Difficulty chips filter without a request**              | E2E: apply a chip, assert zero network requests and the URL unchanged (D26)                                     |
| **A–Z chip for an empty letter is not clickable**          | Component test on the chip bar (D26)                                                                            |
| **A–Z anchors resolve to a rendered group**                | E2E: every enabled chip scrolls to an existing heading                                                          |
| **Term of the day is stable within a day, changes across** | Unit on the date-hash selector with two fixed dates (D29)                                                       |
| **A flag-off section is absent from the sub-nav**          | Component: `quizzes` off → no Quizzes tab, and no link to a 404 (D25)                                           |
| **Card curriculum carries titles only, never bodies**      | Integration: `getLearnIndex` payload has no `content` field (D30)                                               |
| **One feedback vote per signed-in learner**                | Integration: two votes → one row, value updated (D28)                                                           |
| **Anonymous feedback is accepted and rate-limited**        | Integration: burst → 429, first vote stored (D28)                                                               |
| **Quiz score comes from the server, never the client**     | Integration: tamper with the client score → server value wins (Phase 6)                                         |
| **Glossary topic slug collisions rejected per locale**     | Unit on `glossaryTopicSchema`; `@@unique([locale, slug])` (D27, Phase 10)                                       |
| Soft delete → restore preserves progress                   | Integration                                                                                                     |
| RTL: no horizontal overflow, `dir=rtl`                     | Playwright `ar` over all templates                                                                              |
| a11y                                                       | axe on all templates; keyboard-only reorder in the builder                                                      |
| LCP < 2.5s on a lesson page                                | Blocking Lighthouse budget                                                                                      |
| Every permission string exists in the seed registry        | Existing CI cross-check                                                                                         |

Coverage floors: `@repo/core` 80%, `@repo/contracts` 90%, `@repo/utils` 90%.

---

## 16. Risks

1. **The rename (D1) touches a shipped schema.** Mitigated by empty tables and
   by doing it in PR 1.2, before any service references `db.module`.
2. **The progress island is a real UX cost.** Every ✓ appears after hydrate.
   Mitigated by reserved space and skeletons; the alternative is forbidden by
   `architecture.md` #6.
3. **Drag-and-drop is where a11y programmes die.** Keyboard controls ship first.
4. **Phase 8 is a trapdoor.** "Video upload" reads like a feature and is a
   subsystem (§0.1). It must start with the D22 decision and its own ADR, or it
   will silently consume the schedule. Nothing in Phases 1–7 depends on it.
5. **Two tracks, one prepared.** If Crypto content is not ready, `/learn` must
   not show an empty Crypto band — hence the test in §15.
6. **`pnpm build` has not been green in this tree for some time** — the last six
   DEVLOG entries all record it unrun, for environmental reasons. Get a green
   build before Phase 1 lands, or this programme inherits an unknown.
7. **Phase 10 (glossary topics) is the schedule's pressure valve.** It is real
   work on a shipped model for a browse mode PR 4.5 already approximates. Cut it
   first, and cut it without guilt.
8. **Filters are the likeliest way this plan gets a page made dynamic.** A
   future contributor reaching for `searchParams` on `/learn` would silently
   uncache it; D26 and the first row of §15 exist to catch that.
9. **Scope creep toward a full LMS.** Certificates, cohorts, discussions,
   subscriptions and drip scheduling are adjacent and out. The schema does not
   block them; this plan does not build them.

## 17. Explicitly not in this programme

Block-based lesson canvas (D5) · `LearningProgram` table (D2) · `MediaFolder`
table (D23, still not created) · `CourseRecommendation` table (D17) ·
`MediaAsset.courseId`/`lessonId` (D23) · rich link previews or any server-side
fetch of an external URL (D16) · guest→account progress merge (D8) · lesson
content versioning (D11) · configurable per-course completion rules (D10) ·
AI/behavioural recommendations (D17) · certificates · a `/account` area
(owner-deferred) · subscriptions or a real `PREMIUM` entitlement model (ADR-012
stands).

**Moved into `changes-12-plan.md`, not dropped:** `MediaVariant` / variant
generation · self-hosted video, FFmpeg and HLS · a job queue and a worker
process · object storage and CDN · the CSP change those require · malware
scanning (feasible once a worker container exists; deferred within that
programme to M12, not refused).

**One rejection that no longer holds.** D9 ruled out video resume position
because it needed the YouTube IFrame API and a `script-src` widening our
sanitizer deliberately makes impossible. With changes-12 M5.4 shipping **our
own** hls.js player, that reasoning is gone: we own the player events and no
third-party script is involved. Resume position becomes a small, ordinary
feature — a `positionSeconds` column on `LessonProgress` and a throttled write.
It is **still not in Phase 1**, but it should be reconsidered when M5.4 lands
rather than left standing on a rationale that has expired.

---

## 18. Execution brief

For whoever implements this, human or agent. This section is the working
contract; §1–17 is the reasoning behind it.

**Before writing any code**, in this order: `CLAUDE.md`; `.claude/rules/*`
(architecture, security, code-style, testing); `.claude/skills/content/SKILL.md`
and the skill for whichever surface the PR touches; ADR-004, 006, 009, 012, 017,
034, 042, 043, 044, 046, 049, 052, 053; the last 5 DEVLOG entries.

**Verify before you trust.** Every file path, model, permission key, flag and
function named in this plan was verified on 2026-09-08, but this document is not
the repository. Re-check each one before you depend on it, and if something has
moved, fix the plan in the same PR rather than working around it.

**Rules that override convenience:**

1. Never import `@repo/db` from `apps/web`. Route handlers and actions call
   `@repo/core`.
2. `requirePermission()` is the first line of every mutation. No exceptions.
3. No new permission keys, no new cache tags, no new feature flags — all three
   registries already contain what this programme needs.
4. No second media pipeline, no second upload path, no queue.
5. No CSP change **from this programme**. The one deliberate change lives in
   `changes-12-plan.md` M10 (CDN origins, which also tightens `img-src`). If a
   learning feature seems to need another, it is the wrong feature.
6. Sanitize on save, server-side, always.
7. No hardcoded user-facing strings; no hex literals; logical properties only.
8. An ADR precedes the code that deviates from the plan; a DEVLOG entry follows
   the code that lands.

**Order:** phases sequentially, PRs within a phase sequentially. Do not begin
Phase _n+1_ until Phase _n_'s tests are green. Do not start Phase 8 at all
without the D22 decision recorded as an ADR.

**Stop and ask** if: a decision in §3 turns out to conflict with code written
since 2026-09-08; a phase needs a dependency not already in the tree (beyond
`sharp` in PR 3.5); or a test in §15 cannot be written as specified — the last
one usually means the design is wrong, not the test.
