# ADR-013: Base UI (not Radix) as the design system's primitive layer

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 07 (`@repo/ui`)
**Supersedes:** —
**Superseded by:** —

## Context

shadcn CLI 4.x's `init` requires choosing a headless component library for
the generated components: Base UI (`@base-ui/react`, the CLI's own
"Recommended" default), React Aria, or Radix UI. plan.md/SKILL.md predate
this fork in the road — they say "shadcn components" generically, and the
plan's component list (dialog, dropdown, tabs, …) exists in every one of
the three registries. This is a real, lasting choice: every component's
primitive API (`render` composition instead of Radix's `asChild`,
`MenuPrimitive.CheckboxItem.Props` typing style, positioner/popup
structure) flows from it, and switching later means regenerating and
re-diffing every component.

## Decision

Base UI, via `--base base` (registry style `base-nova`). Reasons, in order:

1. **It's the tool's own current recommendation.** The repo's Day-1-sweep
   precedent (stack.md: "plan said CLI 3.x; 4.x is current — same
   approach") is to follow the current, maintained line rather than the
   one that was current when the plan was written. shadcn marking Base UI
   "Recommended" in the very CLI this module is required to use is that
   same signal one level down.
2. **Radix's maintenance trajectory.** Base UI is the successor project
   from the same lineage (ex-Radix + MUI people); the ecosystem's center
   of gravity for new shadcn work has moved there.
3. **RTL support is first-class** in the CLI's Base UI flow (`--rtl` flag
   generated logical-property utilities throughout — `ps-`/`pe-`/`ms-`/
   `me-`, `data-[side=inline-start]` animations), which this repo's
   code-style.md #3 mandates and would otherwise have required hand-editing
   every generated file.

## Consequences

- Component composition uses Base UI's `render` prop, not `asChild`:
  `<DialogTrigger render={<Button/>} />`. Every future module adding
  components (09/10/11) follows this idiom.
- `@base-ui/react@^1.7.0` is the primitive dependency; Radix packages must
  not be added alongside it (two primitive layers means double bundle
  weight and inconsistent a11y behavior).
- Registry style is `base-nova` in BOTH components.json files
  (packages/ui + apps/web) — the CLI requires them to match for
  cross-workspace routing, so changing style later touches both.

## Alternatives considered

- **Radix UI** — the historical shadcn default, larger corpus of existing
  examples. Rejected: choosing the predecessor at day one of a new design
  system just imports a future migration.
- **React Aria** — excellent a11y pedigree. Rejected: the smallest of the
  three shadcn registries today, and no repo-specific reason to prefer it
  over the recommended default.

## Compliance

- `pnpm check:phantom-deps` keeps primitive imports honest; a Radix import
  appearing anywhere should fail review on sight per this ADR.
