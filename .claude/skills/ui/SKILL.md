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
- **Pending, empty and error states are components** (changes-21 Phase A,
  tokens.md §6 build status):
  - `Button loading` goes on the button that STARTED the work; siblings stay
    `disabled`. Never hand-place `{pending && <Spinner />}`.
  - A route loader is a `page-skeletons.tsx` archetype, and a card's skeleton
    is exported beside the card. Never an app-local copy.
  - "Nothing here" is `EmptyState` and "this failed" is `ErrorState`, never a
    muted `<p>` or red text.
  - A loader announces once (`label`) or not at all.
  - `apps/web/app/loading-states.test.ts` fails on any of the old patterns.
- **A `Field` wires its control** (changes-21 Phase B, ADR-077):
  - `Field` holds the ids and the `invalid`/`required` state.
    `FieldLabel`, `FieldDescription`, `FieldError` and every control read it
    through `useFieldControl`.
  - A control inside a Field never sets its own `id`. Pass `controlId` to the
    Field instead.
  - A new control component must call `useFieldControl`. Use
    `requiredAs: "aria"` when its DOM node is a button, and strip
    `aria-required` entirely on a plain button role.
  - `FieldError` uses `-interactive` ink and has no live region. The form
    moves focus to the first invalid control instead.
  - Guarded by `field.test.tsx` and `apps/web/app/admin-form-conventions.test.ts`.
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
- **A toolbar is 36px throughout; a form is 40px.** A container that is a
  toolbar wraps its controls in `ControlSizeProvider size="sm"`
  (`components/control-size.tsx`) instead of passing `size="sm"` to each one.
  `DataTable`'s filter slot already does; an explicit `size` still wins.
- **A dropdown's value truncates with an ellipsis.** `SelectValue` and the
  Combobox value are truncating blocks and option content is inline. Never
  put `flex` back on the value slot: it disables `line-clamp`/ellipsis and
  clips the text mid-letter.
- **A tab tray scrolls when it outgrows the screen**
  (`max-w-full overflow-x-auto`, start-justified). Don't cap tab counts to
  make a phone fit.
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
axe on `/admin/design-system` (light/dark × ltr/rtl); DataTable interaction
tests (sort/filter/select/export hit server callbacks); visual snapshot under
default + one alternate theme (proves token indirection); keyboard-tab
focus-ring test.

## DoD

The design-system reference at `/admin/design-system` (changes-20 Phase 4,
Q13) is the permanent specimen board: every shared component in every
variant, size and state, with a dark pane alongside and an RTL switch. A new
component or variant is added THERE in the same change, and every string it
shows is an `admin.designSystem.*` key (`admin-design-system.test.ts` fails on
a missing one). It replaced the dev-only kitchen sink, which is deleted. Zero
physical-property utilities in the repo.

## A reveal replays (changes-33, ADR-111 — supersedes ADR-104 §1)

The observer no longer unobserves, and `.is-visible` comes off again when the
element is gone.

- **Two thresholds, and the asymmetry is the design.** Arriving needs the
  element's own threshold; leaving needs `intersectionRatio === 0`. A single
  threshold has a failure run-once could never reach: an element taller than
  the viewport can never show 15% of itself and would fade out from under a
  reader still in the middle of it. Both ratios must be in the `threshold`
  ARRAY — that array is the set of ratios that fire a callback, not a filter.
- `rootMargin` is symmetric (`-10% 0px -10% 0px`). One-way, an element
  re-entering through the top snapped in at the viewport edge.
- **The header's entrance is `.header-enter`, an animation, not a `.reveal`.**
  A sticky header never leaves the viewport, so the observer would mark it on
  the first frame and never unmark it. It goes on the `<header>` INSIDE
  `StickyHeaderShell` — a transform on the sticky element's own wrapper is how
  a sticky bar stops sticking.
- A `delay` is a `transition-delay`, so it applies in BOTH directions now.
  `RevealGroup`'s `maxDelay` cap matters more than it did.
- The `timeline` opt-in is unchanged and is still a DIFFERENT effect:
  progress-driven means part-way faded at every point in between.

## CurriculumList's section header (changes-33)

The header carries the section's **ordinal**, the title at
`text-base font-semibold`, and the count as `Badge variant="pill"`.

**One accent, never a hue per section.** Cycling `success`/`warning`/`info`
would be decoration that looks like meaning — those three already carry
difficulty and lesson state on the same pages. The count is `pill` (neutral
card metadata) for the same reason: a lesson count is not a status.
`curriculum-list.test.tsx` fails on any of the three tonal backgrounds
appearing in a section header.

ADR-082's two structural rules are untouched and still guarded: the timeline
marker stays OUTSIDE the anchor, and nothing between the title and the `<li>`
may be positioned.

## A masthead shows its photograph (changes-36, ADR-117)

`PageHero`'s `tone` is OPTIONAL. It resolves to **`photo` when a `backdrop`
is supplied** and `brand` when one is not; an explicit `tone` always wins.

A default that keys off another prop, deliberately: a masthead that was given
artwork is a masthead whose job is to show it, and nine call sites that each
have to remember a tone name is nine chances to add the tenth photographic
masthead under a fill again.

**`photo` is `--secondary` / `--secondary-foreground`** — the pair the
homepage hero and the footer already run on. Not because it is neutral (it is
light in light mode, dark in dark mode) but because it is a fill the engine
has derived an ink AGAINST, which is the only property that matters when the
thing actually behind the words is a photograph.

- The backdrop renders at **full strength** under `photo`. The `opacity-25`
  ceiling stays for every other tone, where art sits under a fill.
- **The scrim carries the contrast**, built from `--secondary` at varying
  alpha. Two shapes, and the asymmetry is the design: a start-aligned band's
  scrim is opaque at the inline start and clears COMPLETELY on the other side
  (so the reader sees the picture, not a tint of it); a centred band gets a
  vertical one, softest through the middle. Flipped by hand under
  `[dir="rtl"]`, like `.reveal-start`.
- The start-aligned copy column is capped `md:max-w-3xl` so a headline cannot
  walk out of the opaque half.
- **The brand colour moved to the button.** A masthead's primary action is the
  default filled `Button` (small element, own paired ink — ADR-018 rule 5's
  allowed case); the second takes `Button variant="inverted"`.
- A band with **no artwork keeps `brand`** — `/sitemap`,
  `/economic-calendar`, `ComingSoon`, the eight tool pages.
- **A missing piece of art now yields a plain `--secondary` band**, not the
  brand gradient: `backdrop={<XBackdrop …/>}` is a JSX element, so it is
  truthy even when the component returns `null`.

Guarded by the `PageHero — the photo tone` block in
`about-primitives.test.tsx` and the `inverted` block in `button.test.tsx`.

## `Button variant="inverted"` (changes-36)

The button for a band that IS `--secondary`: the homepage hero, a photographic
masthead, the footer, the connect band. `outline` is a pale chip there
(`border-input bg-background`) and `secondary` is a control the same colour as
the surface under it. This is opacities of `--secondary-foreground`, readable
on `--secondary` by construction — the 200-character class string four call
sites had each written out, once.
