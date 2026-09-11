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

## The design system is the reference UI's (changes-20, ADR-072/073)

`docs/design-system/tokens.md` is binding: sizes, radius, elevation and
anatomy for every component. Read it before touching a component's classes.

**Accessibility overrides visual copying.** A reference pairing that fails
contrast ships as the closest accessible variant, recorded as a deviation.

**Tonal surfaces** (a status hue at /10 behind that hue's `*-interactive`
ink) rest at /10 and hover at /15, never stronger. ADR-073 derives the ink to
hold 4.5:1 exactly up to that tint.

**Size names are stable; values follow the reference:**

| Component        | Sizes                                               |
| ---------------- | --------------------------------------------------- |
| Button           | default 40 · sm 36 · xs 32 · 2xs 28 · lg 44 · xl 48 |
| Input            | default 40 · sm 36 · xs 32                          |
| Dropdown trigger | default 40 · sm 36 · xs 32                          |
| Avatar           | sm 32 · default 40 · lg 48                          |

- **Use the component, not a recipe:** `SearchInput`, not an Input with a
  hand-placed magnifier; `CountBadge`, not a red span. Dropdown triggers share
  `selectTriggerVariants`.
- **Badge meanings:** `destructive` is the SOLID alert pill; a destructive
  STATUS is `danger` (tonal).
- **Provisional components** (checkbox, switch, radio, textarea, tooltip,
  dropdown popups/items) are not restyled until their spec is confirmed from
  the owner's second capture.

## Admin-surface conventions the primitives carry (ADR-044/045)

- `Badge` centres its own text (flex centring in every size; `leading-none`
  on the fixed-height `sm`/`xs` sizes).
- `Table`'s header row never takes the row hover — a header must never read
  as a row. A plain `Table` header is unfilled (the reference's simple
  tables); `DataTable` fills it `bg-muted/50` (the reference's dense admin
  lists), so an admin list's header is still its own surface (changes-08 #7).
- `Table` has one `density` for the whole table (`default` p-4 / `compact`
  px-2.5 py-2 11px) set on `<table>`; `DataTable` defaults to `compact`
  (ADR-072 §9). Never pad an individual cell to fake a density.
- **Type is a component, not a class string** (task constraint 7): page and
  section headings, descriptions, metric labels and values, meta lines and
  micro-headings come from `typography.tsx`. `render` swaps the tag, never
  the recipe.
- **Card has no header band** (ADR-075, superseding ADR-050's). Compose
  Header/Content/Footer and let `--card-spacing` pad them; never pad a card
  part by hand. A screen header is `PageHeader` (description required), a
  dashboard metric is `MetricCard`, a sidebar row is `NavItem`.
- A view switcher above a list is `ViewChips` (a toggle group), not Tabs —
  nothing there owns a panel. Filters above something other than a
  DataTable use `FilterBar`; inside a DataTable they go in `filters`.
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
