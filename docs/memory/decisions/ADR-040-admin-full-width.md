# ADR-040: The admin surface is full-width; `AdminPage`'s `width` prop is retired

**Status:** Accepted
**Date:** 2026-09-06
**Module:** 09 (Admin shell)

**Supersedes:** —
**Superseded by:** —

## Context

`AdminPage` (`apps/web/app/(admin)/admin/_components/admin-page.tsx`) is
the layout primitive every admin screen composes. It takes a `width` prop
—`sm | md | lg | full` → `max-w-2xl | max-w-3xl | max-w-5xl | ""` — and
defaults to `md`, i.e. **768px**.

The result, on the 1440px+ displays the admin is actually used on: most
screens (settings, theme editor, roles, employees, profile, glossary,
every `lg` and `md` page — 24 of the 29 call sites) render in a narrow
column against the sidebar with several hundred pixels of dead space on
the inline-end side. Individual controls compound it: settings inputs are
`max-w-md`, selects `max-w-xs`, theme-editor tab panels `max-w-md`, so
even the `full` screens have a narrow column inside them.

The owner asked for the full available page width everywhere — cards,
data tables, CRUD pages, forms, content sections — with the empty right-
hand side removed, and for it to stay responsive.

The tension worth naming: a 2000px-wide single-column text input is not
"using the width", it is the same design failure mirrored. Removing a cap
is only half the decision; the other half is what fills the space.

## Decision

- **`AdminPage` renders full-width, always. The `width` prop is removed**
  — not accepted-and-ignored, removed, so no call site can express a
  constraint the design no longer honours. All 29 call sites drop it.
  The `AdminSkeleton` variants lose their matching `max-w-*` caps.
- **Width is filled by columns, not by stretching single controls.**
  Form-shaped screens (settings groups, the theme editor's tab panels,
  profile) become responsive grids — one column below `xl`, two above —
  with a `field-wide` escape for controls that genuinely want the full
  row (textareas, JSON editors, image uploads, structured list/object
  editors). Per-control `max-w-md`/`max-w-xs` caps are replaced by
  `w-full` inside a grid cell that is itself bounded.
- **The grid breakpoint is `xl` (1280px), not `lg`.** Below it the admin
  is single-column, which is what keeps tablet and the collapsed-sidebar
  case honest.
- **Data tables, cards and content sections simply lose their caps** —
  they were already width-hungry and needed no column treatment.
- **The public surface is unaffected.** `.container-page` and its
  `--container-width` token stay exactly as they are; long-form reading
  measure is a separate concern from admin density, and
  `--container-width` is a theme token this decision has no business
  reaching into.

## Consequences

- Two-column forms need a deliberate call on which fields span the row.
  Getting it wrong looks worse than the old narrow column did. Mitigation:
  the span rule is derived from the settings _type_ (TEXT/JSON/IMAGE and
  the structured editors span; scalars don't), not hand-tagged per field,
  so it cannot drift as settings are added.
- Screens are no longer visually consistent in width with each other —
  a 3-field screen and a 30-field screen now look very different at
  1920px. Accepted: that is the point of the request, and the page header
  rhythm still anchors them.
- Removing the prop is a breaking change to a shared primitive, so every
  admin screen is touched in one pass. That is preferable to leaving a
  dead prop that reads as a live option to the next person.
- Ultra-wide (>2560px) admin sessions will have long horizontal scan
  distances in two-column forms. Not solved here; if it becomes a real
  complaint, a `2xl:max-w-[1800px]` on the shell's `<main>` is the
  one-line answer, and it belongs there rather than back in `AdminPage`.

## Alternatives considered

- **Keep `width` but change the default to `full`.** Rejected: it leaves
  24 call sites explicitly asking for a cap that no longer exists in the
  design, which is exactly the "slightly-diverging copies" problem
  `AdminPage` was extracted to end.
- **Widen the scale (`md` → `max-w-5xl`, `lg` → `max-w-7xl`) instead of
  removing it.** Rejected: it still leaves dead space on a 1920px display
  and does not answer the request, only softens it.
- **Cap the shell's `<main>` and leave `AdminPage` alone.** Rejected:
  the cap is per-screen, so a global cap cannot remove a 768px column.
- **Full-width without the column treatment.** Rejected for the reason in
  Context — a full-width single-column form is not an improvement.

## Compliance

- The `width` prop's removal is enforced by TypeScript: a leftover
  `width="lg"` is a compile error, so `pnpm typecheck` is the gate.
- No lint rule can assert "uses the available width"; this one is review-
  enforced beyond the type error, and Module 09's per-screen E2E is where
  a regression would surface visually.
