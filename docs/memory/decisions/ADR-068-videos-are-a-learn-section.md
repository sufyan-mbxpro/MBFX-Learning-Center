# ADR-068: Videos are a first-class learn section — a new content entity, on borrowed permissions

**Status:** Accepted
**Date:** 2026-09-09
**Module:** 11 (content system), 12 (public site), 09 (admin shell), 08 (navigation), 01 (`@repo/db`)
**Supersedes:** —
**Amends:** ADR-055 §3 (reserved course slugs — `videos` joins them), ADR-065 §4
(a track owns FOUR route keys, not three), ADR-048 (the two learn panels gain a
row)
**Superseded by:** —

## Context

The owner asked (`docs/changes/changes-16-topics adds.md`, 2026-09-09) for a
content type carrying a title, a rich body, a thumbnail, SEO, attached videos —
uploaded or external — and a list of labelled links, grouped by an
admin-managed category and rendered on the public site. The reference supplied
was `docs/changes/image-26.png`: a FOREX.com page whose whole subject is one
embedded video.

`docs/changes/changes-16-plan.md` is the executable plan; the owner accepted it
the same day. This ADR records the six decisions in it that deviate from, or
extend, existing ones. Everything else in that plan follows a decision already
made.

Four facts about the repository shaped every one of them:

- **The bytes layer already exists and is not the interesting part.**
  `storeMedia()` accepts MP4/WebM by magic bytes to a per-kind cap,
  `/uploads/[file]` serves them with `Accept-Ranges`, `parseVideoUrl()`
  whitelists three embed providers, and `frame-src` already names exactly the
  origins that parser emits. A plan that "adds video upload" would be rebuilding
  what shipped in changes-02, ADR-034 and changes-13.
- **A lesson is a heavier thing than a video page.** It lives in a section
  inside a course, carries a completion rule, feeds `LessonProgress`, and can
  gate course completion on a quiz.
- **Two registries already decide learn URLs**, `LEARN_TRACKS` and
  `ROUTE_PATHS`, joined by `LEARN_TRACK_ROUTE_KEYS` (ADR-065 §4).
- **This repository has twice refused to add permission keys for a new content
  type** — quizzes (ADR-058 #8) and glossary topics (D27) — because a key no
  seeded role holds is a silent 403 waiting to happen.

## Decision

### 1. Videos are a fourth learn section, scoped to a track

`/learn/[track]/videos`, `/learn/[track]/videos/[topic]` and
`/learn/[track]/videos/categories/[category]`, with a tab in the section bar
between Courses and Quizzes.

Not a top-level `/videos`. ADR-065 made the school the unit a reader navigates
by; a video library sitting outside that split would be the one learning surface
that ignores it, and "Learn Crypto → Videos" would have nowhere honest to point.

**`VideoTopic.track` is REQUIRED**, for the reason ADR-065 §3 gave for
`Quiz.track`: a canonical URL cannot be built from a null. Moving a topic
between schools writes a redirect exactly as a slug rename does. A topic read
under the wrong track returns null and the page 404s, rather than answering at
two URLs.

**A category, by contrast, spans tracks.** It is taxonomy, not address. The
category page under a track is a filtered view onto it — the same relationship
`/learn/[track]/glossary` has with `/glossary`. So the same category chip shows
different counts under different schools, which is correct and is the
consequence being accepted here.

**`videos` joins `RESERVED_COURSE_SLUGS`** and `categories` becomes the first
`RESERVED_VIDEO_SLUGS` member — ADR-055 #3's rule applied one level down, at
write time rather than discovered at read time.

### 2. `VideoTopic` is a new entity, not a Lesson variant

Modelling a video page as a lesson means every video needs a synthetic course
and a synthetic section, and every completion, enrollment and analytics query
grows a clause to exclude rows that are not really lessons. The relationship is
the one ADR-058 #1 found for quizzes: a thing that stands on its own is a poor
member of someone else's hierarchy.

What it **reuses rather than redefines**: `ContentStatus` and the seven-state
machine, `FeatureVisibility`, the translation + `sourceHash` +
`translationStatus` shape, `Redirect` on slug change, `ContentReference` for
media placements, and the `content` cache tag. `ContentEntity` in
`packages/core/src/content.ts` gains `"videos"`, and `ENTITY_DELEGATE` and
`ENTITY_PUBLISH_PERMISSION` gain one row each. That is the entire cost of
joining the machine — there is no second transition function.

**No new cache tag.** architecture.md #12 freezes the list, and a video topic is
content.

### 3. Videos publish on the `lessons.*` permission keys

There are no `videos.*` keys in the seed registry and none are added. The
precedent is set twice (ADR-058 #8, D27) and the reasoning is unchanged: five
new keys need three role grants behind them, and a key no role holds produces
the silent-403 bug `check:permission-keys` exists to catch.

**The cost, stated plainly:** video authorship cannot be granted independently
of lesson authorship. The same people write both. `ENTITY_PUBLISH_PERMISSION` is
already the indirection that makes a `videos.*` group a one-line change the day
that stops being true.

### 4. A video row carries exactly one source

`VideoTopicVideo` holds `assetId` (a `MediaAsset` of `kind: VIDEO`) **or**
`externalUrl` — never both, never neither. Enforced by a `.refine()` in
`@repo/contracts`, the way `menuItemLinkSchema` already enforces its
exactly-one-of rule, so the admin form, the server action and the service fail
identically instead of in three slightly different ways.

Enforced there and **not** as a database CHECK constraint: a second enforcement
point that can disagree with the first is worse than one that cannot.

Render follows the source and nothing else. `assetId` becomes a `<video
controls>` against `/uploads/…` with a poster; `externalUrl` is parsed by
`parseVideoUrl()` and handed to the shared `VideoFacade`. A URL the parser
rejects is refused at save and renders nothing — the raw URL is never echoed
into markup (security.md #9), which is what keeps `frame-src` and the parser
from drifting apart in the unsafe direction.

The per-row `title` is display-only and **not translatable**, following
`LessonAttachment.label`: a translatable label is deferred until an editor asks
for one.

**The 100 MB ceiling stands** (owner, 2026-09-09). `media.maxBytes.video`
defaults to 100 MB and the upload is one request through a route handler, so a
long screen recording will not fit. changes-12 is where that is solved properly;
until then the editor's Videos panel says so in its help text, from a catalog
key. An honest limit in the UI beats a failed upload.

### 5. A link is a label plus exactly one href, internal or external

The brief's "external or internal site link" is `menuItemLinkSchema`'s rule with
one widening: an editor linking to a specific course cannot use a `routeKey`,
because `ROUTE_PATHS` registers static routes only. So a link carries a `path`
(site-relative, one leading `/`) or a `url` (https only), never both.

The `path` validator rejects anything not starting with a single `/`, which is
what keeps a protocol-relative `//evil.example` out of a field called
"internal". Internal links render through `@repo/i18n`'s `Link` so they carry
the locale prefix; external ones get `target="_blank" rel="noopener noreferrer"`
and the existing opens-in-new-tab screen-reader string.

**Whether a link is external is derived at render, never stored** — the same
rule that keeps iframes out of the database.

### 6. Every media placement is mirrored into `ContentReference`

`ReferenceSourceType` gains `VIDEO_TOPIC`. Cover, uploaded video and poster ids
each write a `MEDIA` reference inside the same transaction as the save, so
`deleteMedia()`'s in-use guard refuses to delete bytes a published page is
playing.

This is ADR-035's wiring, not a new mechanism. It is recorded here because
omitting it is invisible until the day a published video page goes blank.

### 7. The card is not a stretched link

`CourseCard` paints a stretched `::after` over its header row and `QuizCard`
over the whole card. `VideoCard` does **neither** (owner, 2026-09-09).

A video card carries a play affordance over its thumbnail, and playing is not
navigating — that is a second target with a different destination. One stretched
link plus a play button inside it has only two outcomes: the button sits under
the overlay and cannot be reached, or it punches a hole in the overlay and the
card stops behaving like one link. So the title is an ordinary anchor, the play
control is a real button, and the guard test asserts the inverse of
`quiz-card.test.tsx`: no overlay anywhere in the card, both controls in the tab
order, each with its own accessible name.

## Consequences

- A track now owns **four** route keys. `packages/contracts/src/learn.test.ts`
  hardcoded three in three places (the surface list, the `learn-*` regex, and
  the path assertions) and is extended in the same PR that adds the keys — the
  drift guard only guards what it enumerates.
- `VideoFacade` moves from `app/(public)/[locale]/news/_components/` to
  `app/(public)/[locale]/_components/`. The lesson page already imported it four
  levels up out of another section's private folder; this decision would have
  made a third consumer of a component filed under News.
- One new feature flag, `videos`, seeded OFF until its routes exist — a
  flag-off section is ABSENT from the section bar, not disabled (changes-11
  D25), so the registry wiring can land before the pages do. A seeded flag needs
  `pnpm db:reset` to appear.
- **No CSP change, no new upload path, no queue, no transcode, no new cache
  tag, no new permission key.**
- View counts, a share row and the reference page's promo panel are out of
  scope (changes-16-plan §4). The dead `viewCount` columns on `Lesson` and
  `GlossaryTerm` stay dead; nothing here starts writing them.
- A lesson cannot link to a video topic yet. Deferred by the owner on
  2026-09-09; it is one nullable column when it is wanted.
- Video topics take no part in progress, completion or enrollment. Nothing in
  `LessonProgress`, `CourseEnrollment` or `recomputeCourseCompletion` is
  touched.

## Alternatives considered

**Add `videos.*` permission keys.** Cleaner authorship model on paper. Rejected:
five keys with no role behind them is the failure mode this repo has already
avoided twice, and the fix stays cheap because the publish permission is a map
lookup, not an interpolated string.

**Make a video a Lesson with `videoUrl` set, in a hidden course.** Zero new
tables. Rejected: it makes every course and progress query carry an exclusion
clause forever, and the first analytics number that quietly counts video pages
as lessons is a bug nobody will look for.

**Store `isExternal` on the link row.** One less derivation at render. Rejected:
it is a second source of truth for something the href already says, and the two
disagree the first time a link is edited.

**Put the category in the topic's path** (`/learn/[track]/videos/[category]/[topic]`).
Better hierarchy in the URL. Rejected: re-filing a topic would then move its
canonical URL and cost a redirect for a change that is pure taxonomy, and the
detail page is the one that gets linked to.

**Free-text category, like `Quiz.category`.** No table, no admin screen. Rejected:
the owner asked for category CRUD, and a category here needs a slug, a
description and SEO fields — it is a page, so it is a row. `categoryTone()`
hashes a string precisely because a quiz category has no registry to enumerate;
this one does.
