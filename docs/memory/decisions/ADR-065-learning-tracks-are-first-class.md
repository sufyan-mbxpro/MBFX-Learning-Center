# ADR-065: Learning tracks are first-class — per-track URLs, header entries and a sticky section bar

**Status:** Accepted
**Date:** 2026-09-09
**Module:** 12 (public site), 11 (content system), 08 (navigation), 01 (`@repo/db`)
**Supersedes:** —
**Amends:** ADR-055 §3 (URLs), ADR-055 §7 (the Learn sub-nav), ADR-058 §1
(the quiz index), ADR-048 (panel registry — two new panels)
**Superseded by:** —

## Context

ADR-055 §2 made a track (`forex`, `crypto`) a code registry rather than a
table, and §3 gave the Learn area flat URLs: `/learn`, `/learn/[course]`,
`/learn/[course]/[lesson]`, `/learn/quizzes`. The track existed as a **band on
one index page** and as a client-side filter chip — it had no URL, no header
entry and no scope of its own.

The owner supplied babypips as the reference treatment and asked for three
things:

1. the header to carry the tracks as separate entries ("Learn Forex", "Learn
   Crypto") rather than one "Learn";
2. hovering one of those to reveal its learning surfaces — courses, quizzes,
   glossary;
3. the Learn area's second bar to be **pinned**, so it stays reachable while
   the reader scrolls a long lesson.

Three facts made the flat structure the wrong floor to build that on.

- **A track is exactly what ADR-055 §8 calls a route.** "If the filter narrows
  a set already on the page, it is client state; if it produces something a
  person would bookmark, share or find in search results, it is a route."
  A crypto learner bookmarks the crypto school. The track chip was on the
  wrong side of the project's own rule.
- **A hover panel per track needs per-track destinations.** "Learn Crypto →
  Quizzes" pointing at an index of forex quizzes is a lie the nav tells on
  every page. `Quiz` and `GlossaryTerm` carried no track at all — only
  `Course` did.
- **The second bar could not stay track-scoped under flat URLs.** Once a
  reader opens `/learn/price-action`, the URL no longer says which school they
  are in, so the bar has nothing to scope itself to.

## Decision

### 1. The track is a path segment; everything under Learn nests inside it

```
/learn                                   both schools (umbrella index)
/learn/[track]                           school index — the track's courses
/learn/[track]/[course]                  course
/learn/[track]/[course]/[lesson]         lesson
/learn/[track]/quizzes                   the track's quiz index
/learn/[track]/quizzes/[quiz]            quiz runner
/learn/[track]/glossary                  the track's A–Z glossary view
```

`[track]` is validated against `LEARN_TRACKS` and 404s otherwise; the registry
also feeds `generateStaticParams`, so the tracks are prerendered rather than
matched at request time. **The registry stays the source of truth** — this ADR
gives it URLs, it does not turn it into a table (ADR-055 §2 stands).

A course loaded at the wrong track 404s rather than rendering: `/learn/crypto/
price-action` is not a second URL for a forex course, it is a wrong one.

This **replaces** ADR-055 §3's flat shape. Every previously published learn URL
moves. Accepted because the site is pre-launch: there is nothing indexed to
301, and the alternative — keeping the flat URLs and bolting track landing
pages beside them — gives every course two truths about where it lives.

### 2. Glossary TERM urls do not move; the track glossary is a view

`/glossary` and `/glossary/[term]` are untouched, exactly as ADR-055 §7
promised. `/learn/[track]/glossary` is a **filtered view** onto the same terms
and links to the same `/glossary/[term]` pages — a track's A–Z, not a second
copy of the glossary. This is why the reserved-slug list under a course gains
`glossary` (ADR-055 §3's rule, one more entry).

### 3. `Quiz.track` is required; `GlossaryTerm.track` is nullable, and null means both

The asymmetry is deliberate and is the whole reason the two columns differ.

- A **quiz is a discrete artifact** authored for one school, and it needs a
  single canonical URL — `/learn/[track]/quizzes/[slug]` cannot be built from
  a null. So `Quiz.track` is `String @db.VarChar(40)`, registry-validated in
  `@repo/contracts` with no FK, the same way `Course.track` is.
- A **glossary term is frequently cross-market**: "leverage", "volatility" and
  "spread" belong to both schools, and duplicating them per track would give
  one concept two pages competing in search. So `GlossaryTerm.track` is
  `String? @db.VarChar(40)`, and **null means the term appears in every
  track's glossary**. `/glossary` continues to list all of them.

`GlossaryTopic` gains no column. Topics are cross-cutting groupings of terms
and `/glossary/topics` stays global; a track view is A–Z plus search, which is
what a learner uses a glossary for mid-lesson.

### 4. The header carries the tracks, not "Learn"

The seeded `learn` root row is replaced by one root per registered track, each
with four children — its three surfaces plus the umbrella. The database still owns the rows, the labels and the
hrefs (ADR-048's split is unchanged); the code registry owns the panel's
composition and its icons:

```
Learn Forex ▾           Learn Crypto ▾
  Courses                 Courses
  Quizzes                 Quizzes
  Glossary                Glossary
  All learning            All learning
```

`/learn` survives as the umbrella index and is the last ROW of each panel. Not
a "view all" footer: that resolves its label from the panel's own item and
would read "Learn Forex · View all" over a link to the page covering BOTH
schools. It is not in the header itself, because three learning entries in one
bar is the crowding ADR-048's panels exist to avoid.

Six route keys join `ROUTE_PATHS` — `learn-{track}`, `learn-{track}-quizzes`,
`learn-{track}-glossary`. They are spelled literally, so `RouteKey` stays a
union of literals, and a unit test fails if a registered track has no keys or
a key names an unregistered track. **Adding a track is a code change in three
files, told to you by a failing test** rather than remembered.

### 5. The section bar is track-scoped, and it is pinned

`LEARN_SECTIONS` becomes a function of the track: Courses → `/learn/[track]`,
Quizzes → `/learn/[track]/quizzes`, Glossary → `/learn/[track]/glossary`. A
section whose feature flag is off is still ABSENT rather than disabled
(ADR-055 §7's rule, unchanged), and the bar renders on every page under
`/learn/[track]/**` — including a lesson, which is the page a reader is on
longest.

It sticks **below the site header**, not at `top-0`. The header's height is
not a constant — an announcement bar, a top bar and a wrapped nav all change
it — so `SiteHeader` publishes its measured height as `--header-offset` on
the document element through a `ResizeObserver`, and the bar sticks at
`top-(--header-offset)`. A fixed `top-16` would have hidden the bar behind the
header the moment the announcement bar was switched on.

`/learn` itself renders NO bar. It is the umbrella above both schools, and a
bar whose entries all point into one track would be lying on the one page that
belongs to neither.

## Consequences

- **Every learn URL changes**, including the redirect rows `saveCourse` and
  `saveLesson` write on a slug rename — those builders now take a track.
  `coursePath`, `lessonPath` and `quizPath` are the only places this shape
  lives, so it is three signatures, not a search-and-replace.
- **A course's track is now part of its address**, so moving a course between
  tracks changes its URL and its lessons' URLs. `saveCourse` writes redirects
  for a track change exactly as it does for a slug change.
- **A migration plus a seed reset.** Two new columns and one required backfill
  (`Quiz.track`). Pre-launch policy is reset, not backfill.
- **`/learn/quizzes` and `/learn/glossary` are gone as URLs.** Both are now
  track-scoped. `RESERVED_COURSE_SLUGS` keeps `quizzes` and adds `glossary`,
  one level deeper than before.
- **The admin gains a Track field on the quiz editor** and on the glossary term
  editor. The glossary field has a "Both schools" option, which is the null.
- **Two more panels in a registry that had one.** The About panel is untouched.

## Alternatives considered

- **Track landing pages only (`/learn/forex`), courses staying flat.**
  Rejected by the owner and on the merits: the course URL stops saying which
  school it belongs to, and the second bar loses its scope the moment a course
  opens — which is most of the reading time.
- **`?track=forex` as a search param.** Rejected: reading `searchParams` makes
  the page dynamic, which `architecture.md` #6 forbids on public routes, and
  ADR-055 §8 already ruled that nothing becomes a search param.
- **A `Track` table with FKs.** Rejected: ADR-042 keeps site structure in code,
  and ADR-055 §2 already decided this. A table would need an admin screen to
  be worth having, which is the cancelled surface again.
- **Duplicating cross-market glossary terms per track.** Rejected: two pages
  for one concept, competing in search, drifting apart in edit. Null-means-both
  costs one nullable column.
- **`top-16` for the sticky bar.** Rejected: it is correct only for the one
  header configuration that happens to be seeded today.

## Compliance

- `packages/contracts/src/learn.test.ts` — every registered track has its
  three route keys, and every `learn-*` route key names a registered track.
- `apps/web/app/(public)/[locale]/_nav/mega-menu.test.ts` — both track panels
  resolve, every column route key is registered, every catalog key exists.
- `apps/web/app/(public)/[locale]/learn/_nav/learn-sections.test.ts` — the
  section list is built per track and a flag-off section is absent.
- `learn-section-nav.test.tsx` — the bar is `sticky`, offsets on
  `--header-offset`, and marks the right entry current on a lesson URL.
- Integration: a course loaded under the wrong track 404s; a slug rename writes
  a redirect carrying the track; the quiz index lists only its own track.
- `pnpm lint` (logical properties, no colour literals) and
  `check:catalog-completeness` for the new `nav.*` and `learn.*` keys.
