# SKILL — Module 07: @repo/ui + design system

plan.md Module 07 + config doc §4. shadcn current CLI (4.x) with native
monorepo support — init against this package, do NOT hand-copy stale
component source.

## Setup

- `shadcn@latest init` into `packages/ui` (monorepo flow); components.json
  with `cssVariables: true` (this is what makes theming dynamic).
- globals.css ported with fixes A5.2/A5.3/A5.5: map `--color-*` to
  full-value vars, `--font-sans: var(--brand-font-sans)`, add
  `--text-*--line-height` pairs; keep the global focus-visible ring.
- Curated `next/font/local` families defined here (ADR-005) — the theme
  engine maps admin font picks to these preloaded families.
- **Granular exports** (`"./*": "./src/components/*.tsx"` style) so Button
  doesn't pull TanStack. Load-bearing under the single-app dependency graph.

## Components (initial set)

button, input, dialog, dropdown, table, tabs, toast/sonner, form primitives
wired to Zod v4 via react-hook-form resolver; `DataTable` on TanStack Table
v8 (server pagination/sort/filter, column visibility, selection, bulk
actions, CSV export).

## Admin-surface conventions the primitives carry (ADR-044/045)

- `Badge` centres its own text (`leading-none` + flex centring).
- `Table`'s header band is its own surface (`bg-muted/60`), with the row
  hover tint cancelled inside it — a header must never read as a row.
- `DataTable` takes a `filters` slot rendered in its own toolbar beside
  the search box. Screens pass their Selects there rather than stacking a
  filter bar above the table.
- `SocialGlyph` owns the brand marks. `lucide-react` v1 removed every
  brand icon, so looking one up by name silently rendered nothing —
  an unresolvable name here draws the generic link mark instead (ADR-045).

## A11y + RTL checklist (every component)

- Semantic tokens only — hex literal here fails lint.
- Logical properties only (`ps-/pe-/ms-/me-/text-start`).
- Keyboard operable; focus-visible ring present; axe-clean both modes, both
  directions.

## Required tests

RTL rendering per layout-bearing component (dir=rtl → start/end alignment);
axe on the kitchen-sink page (light/dark × ltr/rtl); DataTable interaction
tests (sort/filter/select/export hit server callbacks); visual snapshot under
default + one alternate theme (proves token indirection); keyboard-tab
focus-ring test.

## DoD

Kitchen-sink at `/admin/_dev/kitchen-sink` (dev-only, staff-gated); zero
physical-property utilities in the repo.
