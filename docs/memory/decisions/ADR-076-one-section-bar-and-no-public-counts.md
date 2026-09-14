# ADR-076: One section bar, About-shaped track panels, and no counted figures on public pages

**Status:** Accepted
**Date:** 2026-09-11
**Module:** 08 (navigation), 12 (public site)
**Supersedes:** ADR-065 §4 (the track panel's one-column shape and its
refusal of a "view all" footer) and ADR-065 §5 (the bar's own look —
its track scoping, flag rule and pinning are **not** superseded). The
counted stat strip under the learn, quiz, video and glossary mastheads
(learn design pass 2026-09-09 and ADR-069's public half).
**Superseded by:** —

## Context

The owner reviewed the public site after changes-20 and asked for three
things:

1. Learn Forex and Learn Crypto should navigate the way About does.
2. The stat cards (total courses, lessons, quizzes, terms…) should go. They
   are admin numbers, not reader content.
3. The second menu bar should be clearer and look different from the header.

What the code had:

- **Two copies of one bar.** About's `section-nav.tsx` was a muted,
  unpinned strip. Learn's `learn-section-nav.tsx` was a copy of it that had
  since become pinned and `bg-background/95`. The header is also
  `bg-background/95`, so the Learn bar read as the bottom half of the header.
- **Two panel shapes in one header.** About opens a three-column panel with
  headings and a "view all" footer. Each school opened a one-column
  `compact` list (ADR-065 §4).
- **Four copies of a stat strip.** A `StatStrip` sat under the learn, quiz,
  video and glossary mastheads, counting rows from the page's own data.

## Decision

1. **One `SectionNav`** in `app/(public)/[locale]/_components/section-nav.tsx`
   is used by About's layout and by `learn/[track]/layout.tsx`. The two old
   copies are deleted. Its active-entry rule, `activeSectionHref`
   (longest-prefix), moves to `_nav/active-section.ts` and serves both
   sections unchanged.
   - **Look.** A `bg-primary/10` tint laid over an opaque `bg-background`,
     with a `border-primary/20` rule, so it is visibly not the header. The
     active entry is a solid `bg-primary text-primary-foreground` pill.
     Inactive entries are `text-foreground` with `--primary-interactive`
     glyphs.
   - **Contrast.** /10 is inside `TONAL_TINT_CONTRACT` (0.15), which is the
     tint `--primary-interactive` is derived to stay legible on (ADR-073).
     `--primary-foreground` is derived readable on `--primary` (ADR-003).
     Colours stay admin-dynamic; no literal is introduced.
   - **Pinned in both sections.** ADR-065 §5's `top-(--header-offset)` and
     z-30 now apply to About too. One bar, one behaviour.
2. **The track panels take About's shape:**
   - Three headed columns: **Study** (Courses, Videos), **Practise & look
     up** (Quizzes, Glossary) and **More learning** (All learning).
   - A "view all" footer that lands on the school's **own** index.
   - ADR-065 §4 refused a footer because it would have pointed at the
     umbrella `/learn`, and that reason still holds. So the umbrella stays a
     labelled row, and the footer points at `learn-<track>`. With several
     columns, `site-nav.tsx`'s existing rule renders the panel `wide`.
   - The panel is built per track by `trackPanel()` from
     `LEARN_TRACK_ROUTE_KEYS`, so the two schools cannot drift apart.
3. **No counted-figures strip on public pages.** `StatStrip` is deleted.
   The four mastheads take no `stats`, and their skeletons no longer reserve
   the band.
   - The catalog keys `learn.index.stat*`, `learn.quizzes.stat*`,
     `learn.videos.stat*` and `glossary.stat*` are removed.
   - About's facts band (`StatBand`) is **not** affected. Its figures are
     owner-supplied company facts gated by ADR-047 §2, not row counts, and
     it renders nothing while `ABOUT_FACTS.stats` is empty.

## Consequences

- A reader sees one sub-nav design across About and both schools. It is
  distinct from the header and from the brand-filled hero below it: a light
  tint, not a fill.
- The header's mega panels are all one kind of object. A future section
  panel copies About's shape, and `compact` stays available but has no
  caller today.
- Mastheads are shorter by one band on every learn page and on `/glossary`.
- Adding a fifth track surface still fails a registry-driven test. The
  resolver appends an unclaimed row to the last column, so nothing
  disappears.

## Compliance

- `_components/public-chrome.test.ts` enforces three things:
  - **The strip is gone.** `StatStrip` no longer exists, no masthead takes
    `stats`, and only About's facts band imports `StatCard`/`StatBand`.
  - **There is one bar.** Both layouts import the shared `SectionNav`, the
    old copies are gone, and the bar keeps its tint and its solid active
    pill.
  - **The header's "Sign in" link stays on one line.** This guard is carried
    over from the deleted stat-strip test.
- `_nav/mega-menu.test.ts` covers the panels: the track panels have About's
  column count, the view-all footer lands on the track index (never the
  umbrella), and the live rows resolve into the three columns.
- `learn/_nav/learn-sections.test.ts` still pins the bar's sticky offset and
  z-order, now against the shared file.
