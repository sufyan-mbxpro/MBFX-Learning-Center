# ADR-112: The tools strip is dropped; a section bar is for surfaces, not for siblings

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 12 (public site), 13 (tools)
**Supersedes:** ADR-086 §9's section bar. ADR-076 §1 — the ONE `SectionNav` —
stands, and this ADR narrows what it applies to.
**Superseded by:** —

## Context

> when we click on any tools then its appearing the submenu for the tools —
> remove that

ADR-086 §9 gave `/tools/*` a `SectionNav` listing every enabled tool, pinned
at `top-(--header-offset)` under the header, following ADR-076 §1's rule that
there is exactly one section-bar component and every area uses it.

At 1440px, eight tool names do not fit. The bar scrolled sideways, with a
scrollbar under it. So opening one calculator put a second navigation bar
across the page — wider than the header, horizontally scrolling — whose only
information was which of the eight the reader had just chosen.

## Decision

**1. `tools/layout.tsx` renders no bar.** The eight tools are already listed
twice: in the Tools mega panel, grouped by what a reader is trying to DO, and
on `/tools` itself. `RelatedStrip` at the foot of each tool page offers the
neighbours in context, which is the placement that actually gets used. A
third list, permanently on screen, was the one to remove.

**2. ADR-076 §1 is not repealed — it is narrowed to what it was for.** The
learn area and the glossary keep their bars, and the distinction is this: a
section bar is for surfaces that are DIFFERENT KINDS of thing, which a reader
moves between while doing one task. `/learn/forex`'s bar offers courses,
videos, quizzes and a glossary — four different activities, four at a time,
and a learner genuinely moves between them. Eight calculators are the same
kind of thing, used one at a time, and nobody sizing a position needs the pip
calculator pinned above it.

The test that used to assert the tools layout renders a `SectionNav` now
asserts the inverse, and it is there for the revert rather than for a
deliberate re-add: a strip of tabs is the obvious thing to reach for the next
time somebody decides the tools need navigation.

**3. The layout survives, because the `<main>` landmark is why it exists.**
The index and the eight tool pages open no landmark of their own, which axe
reports as a MODERATE `region` violation — under the serious/critical gate the
suite runs, so it would fail silently.

## Consequences

- One fewer `getEnabledTools` call per tool page render. The layout now takes
  no data at all.
- **A latent bug surfaced while writing the test for this and is fixed here.**
  The Tools mega panel declared `viewAll: "tools"` from ADR-086 §9 and the
  footer has never once rendered: `resolveMegaMenuPanel` resolves that key
  against the panel's own CHILD ROWS, and the seeded tools tree has eight
  children, none of them `tools`. The About panel worked because its seed
  listed `about` as its own first child. Nothing failed, because `viewAll` is
  optional and an unresolvable one is indistinguishable from an absent one.

  Fixed by DELETING the declaration rather than by seeding a ninth row: the
  three columns already list every tool there is, so "View all" would lead to
  an index of the same eight. A school's panel is different — its footer goes
  to a page with courses on it that the panel does not name.
  `mega-menu.test.ts` now pins both halves, so the next person to add a
  `viewAll` is told what it needs.

- `tools.nav.sectionLabel` is now read by nothing. Left in the catalog rather
  than deleted: it is a single `en`-only string, and the bar is one line away
  from coming back if the owner disagrees. This is the one place in changes-33
  where code-style.md #28's "a setting nothing reads does not ship" is
  knowingly not applied, because a catalog key is not a control an admin can
  save and believe in.
