# ADR-081: Announced destinations get a page, counts count what a reader can reach, and the glossary joins the one section bar

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 11 (content), 12 (public site), 15 (articles), 08 (navigation)
**Supersedes:** the `status` semantics of `EXPLORE_DESTINATIONS`
(homepage design pass 2026-09-07). Extends ADR-076 §1 to the glossary.
**Superseded by:** —

## Context

The owner reviewed the running site (`docs/changes/changes-22-design-fixes.md`)
and reported eighteen things. Most were spacing and hover work that needs no
decision recorded. Five were not: they are rules that will be wrong again the
next time somebody adds a destination, a section or a facet, so they are
written down here rather than left in the files that happen to hold them
today.

What the code had:

- **`/tools` and `/markets` were in the header, in the footer and on the
  homepage carousel, and neither had a route.** Both fell through the
  `[...slug]` catch-all, found no published CMS page, and rendered the site's
  404 — an error page with a "Back home" button, reached by following the
  site's own navigation. The carousel knew, and refused to link: a `soon` card
  was a flat, non-interactive tile. The header did not know and linked anyway.
- **A course could say "2 lessons" over a curriculum that said there were
  none.** `Course.lessonCount` counted `status: PUBLISHED` lessons.
  `loadCourseBySlug` builds the curriculum from `publicLessonWhere()` AND
  `section: { isPublished: true }` — and `CourseSection.isPublished` defaults
  to **false**, so an editor who published a course and both its lessons still
  had a third switch nobody had told them about. `progress.ts` was quietly
  worse off: its numerator already used the reachable set against this
  denominator, so a course with one unreachable lesson could never reach 100%,
  and the comment there asserting that the two "count what that denominator
  counts" was describing an intention rather than the code.
- **The /news sidebar listed "Trade Ideas 0"**, linking to an archive that
  showed the article. The facet counts are scoped by `kinds`, and ADR-015 #11
  splits the feeds — `/news` is NEWS, `/analysis` is ANALYSIS + TRADE_IDEA —
  while `/news/category/<slug>` deliberately spans all three because it is the
  one archive both feeds link into. So a category holding only trade ideas was
  a rail row promising nothing, next to a page that had something.
- **The glossary had its own tab strip.** A 2px underline on the current entry
  and an ink-only hover, beside the pinned brand-tinted bar About and both
  schools share since ADR-076 §1.
- **The /news sidebar also had a month archive.** Months as plain text with a
  count and no destination — there is no `/news/archive/2026-09` route and
  never was — and deriving it cost one `findMany` over every published row on
  every sidebar render.

## Decision

1. **A destination the site names has a page. Always.**
   `/tools` and `/markets` are real routes rendering the shared `ComingSoon`
   component (`app/(public)/[locale]/_components/coming-soon.tsx`): what the
   section will do, in three concrete lines, and the four finished sections as
   real cards. `noindex, follow` — nothing to index, but the links out are
   worth following.
   - **`EXPLORE_DESTINATIONS.status` changes meaning.** It used to mean "there
     is no page here, do not link". It now means "the page behind this explains
     that the section is still being built". Every carousel card links, lifts
     and sweeps; `soon` swaps the "Explore" arrow for a "Coming soon" badge.
   - **The claim stays checked against the filesystem.**
     `explore-destinations.test.ts` asserts that every destination has a page
     file, and that `status === "soon"` ⟺ that file renders `<ComingSoon `.
     Building a section and forgetting to flip `status` fails there.
   - Adding a third coming-soon destination is a `COMING_SOON_SECTIONS` entry,
     six catalog keys and a three-line route file.

2. **`Course.lessonCount` counts what a reader can REACH.**
   `recomputeLessonCount` filters on `publicLessonWhere()` **and**
   `section: { isPublished: true }` — the same rule the curriculum query uses,
   so the header and the curriculum cannot disagree and progress's numerator
   and denominator come from one set.
   - Every write that can change reachability recounts: `saveLesson`
     (visibility, section), `moveLesson`, `saveSection` (publish), plus the
     status and soft-delete paths that already did.
   - **A section is created VISIBLE**, against the column's own default. A
     section is grouping, not content; it has no status machine, and the
     publish decisions that matter are the course's and the lessons'. Staging
     one is the exception and costs a click. An empty section renders nothing
     either way, so this shows a reader nothing until it holds something.
   - The admin says so out loud: a section that is not published wears a
     "Hidden from readers" badge, rather than the `secondary`-instead-of-
     `outline` badge variant that was the only previous sign.
   - **The one thing it cannot track is time.** A SCHEDULED lesson that falls
     due with no write behind it is reachable before the column knows; the
     count catches up on the next write to any lesson in the course. That
     window is bounded by the same `cacheLife` every learn reader runs under
     (ADR-071: the query decides visibility, the sweep is bookkeeping).

3. **A facet rail never shows a zero.** `loadArticleFacets` drops a category
   whose count is zero. A rail row is a promise that there is something behind
   it, and the counts are already feed-scoped, so the promise and the count
   have to agree. The feed split (ADR-015 #11) is unchanged: a trade idea still
   belongs to `/analysis`, and `/news/category/<slug>` still spans all three
   kinds because both feeds link into it.
   - The month archive is **removed** — facet, panel, catalog key and query.
     It was the only facet that scanned every published row, paying for the one
     panel a reader could not use.

4. **The glossary uses the one `SectionNav`** (ADR-076 §1 extended).
   `GlossaryTabs` keeps the single rule that is the glossary's own — a strip of
   one entry is not navigation, so it renders nothing until a topic has
   published terms — and delegates everything else. `current` is gone with it:
   `SectionNav` derives the active entry from the pathname by longest prefix,
   so `/glossary/topics/<topic>` lights up Browse by topic without every page
   naming itself.

5. **A topic with no published terms is still omitted from
   `/glossary/topics`** — the empty-group rule stands — **but the admin says
   why.** `listGlossaryTopics` returns `publishedTermCount` beside `termCount`,
   computed with the same `publicGlossaryTermWhere()` the public loader uses,
   and a topic at zero wears "Not on the public index" in the topics table.
   The reported symptom ("I published a topic and it is not listed") was two
   correct behaviours meeting: an empty topic is omitted, and a term filed as
   Unfiled joins no topic. Neither should change; both should be visible.

6. **Section chrome flushes the edge it shares.** `.section-flush-start` /
   `.section-flush-end` in `@repo/ui` `globals.css`, declared after the three
   rhythm classes so the longhand beats the `padding-block` shorthand by source
   order. Two stacked sections each paying full rhythm is right when they are
   two things to read and wrong when one is chrome for the other — the /learn
   toolbar sat in ~128px of nothing at each end.

## Consequences

- The site can no longer 404 on its own navigation, and the homepage carousel
  stops having a second, quieter opinion about where a reader may go.
- The learn admin loses a trap that made a correctly-published course look
  empty. The cost is that an editor who WANTS a staged section must now turn
  one off, which is a visible switch in a dialog they already open.
- `/news` still does not list trade ideas. That is ADR-015 #11, not a bug, and
  this ADR does not reopen it — it only stops the sidebar implying otherwise.
- One more surface (`ComingSoon`) depends on the `public` namespace, which is
  translation-enforced for every active locale (ADR-043 #1). Only `en` is
  active, so only `en.json` carries the copy today.
- `explore-destinations.test.ts` now reads route sources. A route file that
  renders `ComingSoon` through an indirection it cannot see would read as
  `live`; the test's own header says so, and the string it looks for is the
  JSX element, not the import.
