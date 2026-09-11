# ADR-055: The Learn area — hierarchy, URLs, capabilities and public presentation

**Status:** Accepted
**Date:** 2026-09-08
**Module:** 11 (content system), 12 (public site), 09 (admin shell)
**Supersedes:** —
**Superseded by:** —

## Context

`plan.md` Module 11 specified a `Course` / `Module` / `Lesson` hierarchy and
Module 12 deferred the public `/learn` area. The schema for the hierarchy has
shipped (`packages/db/prisma/schema.prisma`: `Course`, `CourseTranslation`,
`Module`, `ModuleTranslation`, `Lesson`, `LessonTranslation`) and **no service
code touches any of it**. The permissions (`courses.*`, `lessons.*`), the
`courses` feature flag (enabled, PUBLIC), the `learn` → `/learn` entry in
`ROUTE_PATHS` and a main-menu row gated on `requiresFeature: "courses"` are all
seeded and live.

The consequence is a shipped bug: the header renders a "Learn" link and
`/learn` has no route file, so the request falls through to
`[locale]/[...slug]`, `resolvePublicPage("/learn")` finds no CMS page, and the
route calls `notFound()`.

`docs/changes/changes-11-plan.md` (v2.2, owner-reviewed 2026-09-08) specifies
the programme that closes it. Building it forces decisions that `plan.md`
Module 11 either did not take or took differently, and ADR-042 constrains all
of them: site design is static and code-owned; only content _data_ is dynamic.

Babypips (School of Pipsology / School of Crypto) and FOREX.com Academy were
used as **information-architecture references only** — no assets, copy or
visual design is taken. `babypips.com` returns HTTP 403 to automated fetches,
so those findings come from supplied screenshots and the brief, not a live
read; each is adopted on its merits, not as a spec to match.

## Decision

### 1. `Module` is renamed to `CourseSection` (D1)

`Module` → `CourseSection`, `ModuleTranslation` → `CourseSectionTranslation`,
table `modules` → `course_sections`, FK `Lesson.moduleId` → `Lesson.sectionId`.
The word "Module" already denotes a build unit in this repository ("Module 11",
"Module 16"); a service reading `db.module` next to a DEVLOG entry about
Module 11 is a permanent daily ambiguity. The owner settled the learner-facing
word as **Section**, so the model matches the vocabulary.

Both tables are empty and the product is pre-launch, so this is a
`pnpm db:reset`, not a data migration.

### 2. No `LearningProgram` model; schools/tracks are a code registry (D2)

A fourth database level would carry no content of its own, no translations
worth storing and no ordering an admin should own — it is site structure, which
ADR-042 places in code.

`Course.track String @db.VarChar(40)`, validated against a `LEARN_TRACKS`
registry in `@repo/contracts` — the same pattern as `ROUTE_PATHS` and
`ABOUT_ROUTE_KEYS`. A track has a key, a catalog title key, an icon and a sort
order, all in code. Phase 1 registers `forex` and `crypto`.

**A track with no published courses renders no band at all.** With two tracks
registered and possibly one prepared, an empty band is the most likely visible
defect in the programme, so it is a test, not a convention.

### 3. URLs are `/learn/[course]/[lesson]`; sections never appear in a path (D3)

```
/learn                            school index — tracks as bands
/learn/[courseSlug]               course detail
/learn/[courseSlug]/[lessonSlug]  lesson
/learn/quizzes                    standalone quiz index   (Phase 6)
/learn/quizzes/[quizSlug]         standalone quiz         (Phase 6)
```

Course and lesson slugs are already `@@unique([locale, slug])`, so they are
unique per locale and need no parent segment to disambiguate. Reordering
sections, or moving a lesson between sections, therefore changes **no URL**.
The one case that does change a URL — an editor renaming a slug — is covered by
the existing `createSlugRedirect()`. Breadcrumbs still show the section because
they read the database, not the path.

`quizzes` is a reserved course slug, rejected at write time by
`courseTranslationSchema`; otherwise a course named "quizzes" shadows the
Phase 6 route.

### 4. A lesson body is rich text plus typed capabilities, never a block canvas (D5, D15)

ADR-036 rejected Puck and ADR-042 cancelled the composer programme. A lesson
body is one sanitized-HTML field (`LessonTranslation.content`, exists), edited
with the existing article editor v3 (ADR-046) — Tiptap, `sanitizeRichText()`,
the media picker, the SEO panel and the prepare/apply/finish save shape, reused
rather than reimplemented.

**There is no `LessonType` enum.** A type enum makes illegal combinations
representable (`EXTERNAL` plus a body? `VIDEO` plus a PDF?) and forces every
consumer to switch on it. Instead a lesson is a bag of optional capabilities
and what it _is_ is derived:

```
content       LessonTranslation.content    rich text
videoUrl      validated embed URL
attachments   LessonAttachment[]           PDF / download / image
externalUrl   https URL
quizId        Quiz                         (Phase 6)
```

**At least one capability must be present** — enforced by `lessonInputSchema`,
so an empty lesson cannot be saved. A derived helper produces the display badge
("Video", "PDF", "External · YouTube", "Reading") from the capabilities present,
so the admin never picks a type and the two can never disagree.

`Course.externalUrl` is the same shape one level up: when set, the course's
primary CTA points outward and its curriculum is optional.

**Provider is derived, never stored.** A stored admin-entered provider string
is a second source of truth that drifts from the URL; it is computed at render
from the host.

### 5. External URLs are stored, never fetched; linked, never framed (D16)

1. **HTTPS only, and no server-side fetch, ever.** `security.md` #9 forbids
   proxying or fetching arbitrary URLs. We store the string and validate its
   shape; we never resolve it, follow redirects, or fetch a preview or oEmbed.
   Rich link previews are out of scope for exactly that reason. Validation is
   `z.url()` plus an explicit `https:` check plus a length cap; `javascript:`,
   `data:` and `http:` are rejected at write time.
2. **No domain allowlist for links.** An allowlist is right for embeds and
   wrong for links: a link is a browser navigation we do not participate in,
   and an allowlist would force an admin to file a ticket to cite a textbook.
   Links render `target="_blank" rel="noopener noreferrer"` with a visible
   external-link affordance.
3. **An external URL is framed only if `parseVideoUrl()` accepts it.** That
   function already normalises YouTube / Vimeo / Dailymotion watch URLs into
   the three embed hosts the CSP `frame-src` already names. Everything else is
   a link.

**Therefore this programme makes no CSP change.** Admin-supplied iframe HTML is
never stored: `sanitizeRichText()` already rebuilds every iframe from
`parseVideoEmbedUrl()` output and drops any it cannot parse.

### 6. Media is referenced by foreign key, not by URL string (D12)

`Course.coverImageUrl` and `Lesson.coverImageUrl` are replaced by
`coverAssetId` / `heroAssetId` FKs to `MediaAsset`, per ADR-049 (the picker is
everywhere). `Lesson.videoUrl` stays — an external embed URL is genuinely not
an asset. `LessonAttachment` carries PDFs and downloads.

Every placement writes a `ContentReference` row (`sourceType: COURSE`,
`refType: MEDIA`), both members of which already exist in the enums, so
`deleteMedia()`'s in-use guard protects course media from the day it ships.

**This decision is about learning content pointing at media. It is not a media
architecture decision** — object storage, derivatives, the queue, transcoding,
the CDN and media lifecycle are owned by `docs/changes/changes-12-plan.md` and
its ADR-059…062. See "Media architecture is out of scope" below.

### 7. The Learn area gets a static sub-nav; `/glossary` does not move (D25)

A `LEARN_SECTIONS` code registry rendered by a `LearnSectionNav`, modelled on
the existing `about/_components/section-nav.tsx`. Static and code-owned per
ADR-042 — adding a section is a code change.

```
Courses    /learn          always
Quizzes    /learn/quizzes  Phase 6; absent while the `quizzes` flag is off
Glossary   /glossary       existing route, linked as a sibling
```

`/glossary` stays where it is: it has a seeded menu row, a sitemap entry and
indexed URLs, and moving it under `/learn` would mean a 301 for every term in
exchange for a tidier tree. The sub-nav is a **view** of the learning surfaces,
not their URL structure.

A section whose flag is off is **absent** from the nav, not disabled — the flag
gate already 404s the route, and a tab leading to a 404 is worse than no tab.

### 8. Filters that narrow an on-page set are client state; filters that create a collection are routes (D26)

Under Cache Components, reading `searchParams` makes a page dynamic, which
`architecture.md` #6 forbids for public routes. So the answer to
`/learn?difficulty=beginner` is not "make it dynamic" — it is to pick the right
mechanism per filter:

| Filter                      | Mechanism                 |
| --------------------------- | ------------------------- |
| Course difficulty           | client-side               |
| Quiz category               | client-side               |
| Glossary / quiz text search | client-side               |
| Glossary A–Z                | anchors now, routes later |
| Glossary topic              | routes                    |

**The rule, stated once:** if the filter narrows a set already on the page, it
is client state; if it produces something a person would bookmark, share or
find in search results, it is a route. **Nothing becomes a search param.**

Glossary A–Z ships as anchor links (`#a`, `#b`, …) with a sticky chip bar: one
page, fully cached, works without JavaScript. A letter with no terms renders a
chip that is present but not clickable, so the row does not reflow as the
glossary grows. Letter _routes_ become worth their weight only when one page
gets heavy — roughly 300 published terms is the trigger to revisit.

### 9. Glossary topics become a real model; `category` free text goes (D27)

`GlossaryTerm.category` is `String? @db.VarChar(80)` — free text with no slug,
no translation, no description, no ordering and no page to link to. It cannot
support a topic browse, and it violates ADR-044 #5 (a raw identifier never
renders) and ADR-043 #1 (public strings are translatable).

`GlossaryTopic` + `GlossaryTopicTranslation`, mirroring `ArticleCategory` /
`ArticleCategoryTranslation` exactly. `GlossaryTerm.topicId` replaces
`category`. Pre-launch reset, no backfill.

This is Module 11/12 glossary work, not Learn area work; it has its own phase
and **must not delay the learning launch**.

### 10. "Term of the day" rotates deterministically (D29)

`index = hash(YYYY-MM-DD) % publishedCount`, computed in the cached loader with
a daily `cacheLife`. No `featuredOn` column, no cron job, no admin screen. It
is stable within a day, different the next, and identical for every visitor —
which is the whole requirement. An editor _choosing_ the term of the day is a
different feature with a different cost and should be asked for explicitly.

### 11. Course cards expand their curriculum inline (D30)

`getLearnIndex()` returns section and lesson **titles and slugs** with each
course — never bodies — and the card expands client-side. Fetching on expand
would put a request in the path of a hover-speed interaction and could not be
cached with the page.

### Media architecture is out of scope of this ADR

`docs/changes/changes-11-plan.md` originally grouped five media decisions
(D19–D23) into a planned ADR-057. Every one of them is superseded by
`docs/changes/changes-12-plan.md` §11 — D19 by M7, D20 by M2, D22 by M8, D23's
dedup by M12, and D21's garbage collection by M2/M8/Phase M6 — which carry
their own ADR-059 (storage + CDN), ADR-060 (queue, worker, state ownership),
ADR-061 (pipeline, model, settings, observability) and ADR-062 (video, FFmpeg,
HLS).

**ADR-057 is therefore deliberately not written**, and that number is left
unused rather than reassigned, so that a future reader who finds "ADR-057" in
changes-11 finds this paragraph rather than a gap. `MediaAsset.checksum`,
`MediaAsset.status`, derivatives and the GC script are **not** added by the
learning programme; changes-12 M6 owns that model.

The learning programme proceeds on the existing local-disk `StorageDriver`
(changes-12 §1.1). When object storage lands, the driver underneath changes and
no learning code moves.

## Consequences

- **The rename touches a shipped schema.** Mitigated by both tables being
  empty and by doing it before any service references `db.module`. After this
  ADR, `db.module` does not exist and cannot be reintroduced by habit.
- **`/learn/quizzes` permanently costs one course slug.** Enforced in the
  contract rather than left to reviewer memory.
- **Capabilities-not-types means "what is this lesson" is answered by a derived
  helper in more than one place** (badge, icon, card). Mitigated by that helper
  living in `@repo/utils` with unit tests, so there is one implementation, not
  three.
- **No search-param filters means some filter states are not linkable.** A
  learner cannot send someone "/learn filtered to Beginner". Accepted: the set
  is small, the alternative uncaches the page, and the filters that genuinely
  deserve a URL (glossary topics) get routes.
- **Client-side filtering ships the whole set to the browser.** Bounded and
  small at the Learn area's data volume; the 300-term threshold above is the
  point at which the glossary half is revisited.
- **Dropping `GlossaryTerm.category` loses existing free-text values.**
  Pre-launch, so there is nothing of value to lose; post-launch this would have
  required a backfill and would not have been taken this way.
- **Deriving the video provider at render costs a parse per card.** Trivially
  cheap, and it removes an entire class of drift bug.

## Alternatives considered

- **Keep the name `Module`.** Rejected: it collides with the repository's own
  build-unit vocabulary in every log, comment and code review, and the tables
  are empty so the rename is nearly free exactly once — now.
- **A `LearningProgram` table.** Rejected: it is site structure, and ADR-042
  puts site structure in code. It would also hand an admin an ordering control
  over something with no content.
- **`/learn/[course]/[section]/[lesson]` URLs.** Rejected: it makes curriculum
  reordering a URL-breaking operation, which is the single most valuable thing
  the reference sites get right by avoiding.
- **A `LessonType` enum.** Rejected: it makes illegal states representable and
  puts a switch in every consumer. Capabilities cannot disagree with
  themselves.
- **A domain allowlist for external links.** Rejected for links (see 5.2);
  retained for embeds, where `parseVideoUrl` already enforces it.
- **Server-side link previews / oEmbed.** Rejected: SSRF, forbidden by
  `security.md` #9.
- **`searchParams`-driven filters.** Rejected: uncaches every public learning
  page, contrary to `architecture.md` #6.
- **Moving `/glossary` under `/learn`.** Rejected: 301s for every indexed term
  buy only tree tidiness.
- **Keeping `GlossaryTerm.category` and adding a slug beside it.** Rejected: a
  third naming pattern next to two proven ones (`ArticleCategory`,
  `ArticleTag`) for no gain.

## Compliance

- `pnpm typecheck` fails on any surviving reference to `db.module` /
  `moduleId` once the rename lands.
- Unit test: `courseTranslationSchema` rejects the slug `quizzes`.
- Unit test: `lessonInputSchema` rejects a lesson with zero capabilities.
- Unit test: `externalUrlSchema` rejects `http:`, `javascript:` and `data:`.
- Component test: a non-video external URL renders an
  `<a rel="noopener noreferrer">` and **no** `<iframe>`.
- Integration test: no outbound HTTP request occurs during course or lesson
  save or render.
- Integration test: `/learn`, `/learn/quizzes` and `/glossary` stay cached
  across two requests with filters applied — the regression guard for anyone
  reaching for `searchParams`.
- Integration test: `getLearnIndex()`'s payload contains no `content` field.
- Integration + E2E: a track with zero published courses renders no band.
- Component test: with the `quizzes` flag off, the sub-nav has no Quizzes tab.
- Existing CI permission-key cross-check covers `courses.*` / `lessons.*`; this
  ADR adds **no** new permission key, cache tag or feature flag.
