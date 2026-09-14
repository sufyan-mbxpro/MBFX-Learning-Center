# ADR-082: The curriculum is a timeline of play marks, the rail is a variant rather than a breakpoint, and the pager's forward step is the emphasised one

**Status:** Accepted
**Date:** 2026-09-12
**Module:** 07 (`@repo/ui`), 12 (public site)
**Supersedes:** the `not-started` glyph in `LessonStateIcon` (changes-11 §9.2);
the two-`Button` shape of `LessonNav` (changes-11 §9.2/§9.3).
**Superseded by:** —

## Context

The owner reviewed the running lesson and course pages
(`docs/changes/changes-24-fixes.md`) and reported three things, one of them
with a reference screenshot of how a course outline should present. All three
are the same class of problem — a component doing the right thing at the wrong
width, or saying the right thing too quietly — and all three will be wrong
again the next time somebody adds a learning surface, so they are written here
rather than left in the files that happen to hold them today.

What the code had:

- **The lesson rail rendered the course page's layout in a 16rem column.**
  `CurriculumList`'s `full` variant lays a row out as
  `[marker] [title …] [duration]`. Subtract the panel's `px-4`, the row's
  `px-3`, a 20px marker, two gaps and a `shrink-0` "42-min read" from 256px
  and the title has about **78px** left, so `price-action-candlesticks` came
  out one word per line and a two-lesson section stood taller than the article
  beside it. The section title above it fared no better: the Accordion's own
  `hover:underline` underlined four wrapped lines at once, and there was no
  edge anywhere between the panel's title, the section names and the lesson
  names — three weights of the same thing in one column.
- **The course outline was a flat list of rows.** Correct, ordered, and
  saying nothing about being a sequence. The owner's reference is a vertical
  timeline: a circled play mark per lesson, joined by a connector, the whole
  row a target — "each play button clickable to show & view".
- **The pager's label was `text-xs opacity-80` on the brand ground.** Faint
  ink on a brand surface is the pairing ADR-018 rule 5 and ADR-073 exist to
  stop, and here it was carrying the word that says which way the reader is
  going. The two cells were `flex-1` `Button`s, and a `Button` is
  `whitespace-nowrap` at a fixed height, so the lesson title had to `truncate`
  on one line and the pair came out as two wide, flat, half-height slabs.
  Nothing in CI could see it: it types, it lints, and axe does not compute
  contrast through an `opacity` set on an ancestor of the text.

## Decision

1. **`not-started` is a play mark, and the course outline is a timeline whose
   marker is inside the click target.**
   - `LessonStateIcon`'s `not-started` glyph is `Play`, filled. It was the one
     state whose glyph said nothing — an empty ring is the ABSENCE of a mark,
     so three states carried meaning and the fourth carried a hole. A play
     triangle says "start here", which is exactly what not-started means, and
     the four glyphs stay mutually distinct in greyscale (check / dot /
     triangle / padlock). The `aria-label` is unchanged, so the plan §10 rule
     — never colour alone — is unaffected.
   - The icon gains a `size`: `sm` (20px) is the list marker, `lg` (36px) is
     the timeline node, which has to be big enough to read as a button.
   - `CurriculumList`'s `full` variant draws its lessons as an `<ol>` of
     timeline rows: the marker in its own column, a `w-px` connector below
     every node but the last, the content beside it.
   - **The marker sits OUTSIDE the anchor and is clickable anyway**, by the
     stretched-link construction `CourseCard` and `QuizCard` already document:
     the `<li>` is the positioned host and the title anchor paints
     `after:inset-0` over it. This is the only shape that keeps the play mark
     part of the click target without nesting anchors or adding a second entry
     to the accessibility tree. **Consequence, and it is the trap:** nothing
     between the anchor and the `<li>` may be positioned, or the overlay
     silently shrinks to that box with the timeline still looking exactly
     right. `curriculum-list.test.tsx` asserts both halves.
   - Only the `not-started` marker takes the hover tint. Turning every node
     brand-coloured on hover would erase the state it is there to report.

2. **A layout that only works above some width is a VARIANT, not a
   breakpoint.** `CurriculumList` gains `rail`, and the lesson page's sidebar
   and its mobile Sheet both use it. In `rail` the reading time and the badges
   drop to their own line under the title, the section count sits under the
   section title, and the Accordion's hover underline is turned off. The
   caller says which surface it is and the component stops guessing from a
   media query it cannot see.
   - **`rail` renders no card of its own.** It is used bare inside a Sheet,
     where a second border would be a panel drawn inside a panel; the lesson
     page supplies the header band and the rule.
   - `--grid-rail-main` goes 16rem → **18rem**. It is read by the lesson page
     and its skeleton and nothing else.
   - `CurriculumLesson` gains `isCurrent`, which is **not** the same question
     as `state`. The progress island can mark several lessons `in-progress`,
     and exactly one row is the page the reader is on. It drives
     `aria-current="page"` plus a tint AND an inline-start edge bar — the
     screen reader and the glance, neither of them colour alone.

3. **The pager's two steps are not equal and the design says so.**
   `LessonNav` renders two cards rather than two `Button`s: back is an outline
   card on `bg-card` with a muted disc, forward is filled `bg-primary` with a
   `--primary-foreground` disc. Two lines of title in flow, one in the pinned
   mobile bar.
   - **The eyebrow separates from the title by SIZE, never by opacity.**
     `text-2xs` caps against `text-base` semibold, every string at full
     `--primary-foreground`. A dimmed label on a brand ground is banned on
     this surface, and `lesson-nav.test.tsx` fails on any `opacity-*` in the
     component — asserted structurally because it is the one failure mode
     neither axe nor the theme contrast property test can see.

## Consequences

- Three surfaces show a curriculum and all three still read one component, so
  a lesson's state marker, its external badge and its reading time cannot
  disagree between the course page, the rail and the Sheet.
- A fourth learning surface that needs a fourth density adds a variant here,
  not a set of `md:` overrides at the call site.
- The `full` variant's rows are now stretched links. Any control added inside
  one must be `relative z-10` or it is present, focusable, keyboard-operable —
  and dead to a pointer, the same rule `CourseCard` carries.
- `learn.lesson.previous` / `.next` read "Previous lesson" / "Next lesson".
  They are eyebrows now, not button labels, and "Next" alone above a lesson
  title read as a heading for it.
- Not done here: axe and Lighthouse over `/learn/**`, still owed to Module 14,
  and the RTL smoke pass that would prove the timeline connector and the
  pager's flipped chevrons in `ar`.
