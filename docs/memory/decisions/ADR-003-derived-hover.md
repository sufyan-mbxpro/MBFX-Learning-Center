# ADR-003: Hover/active states are derived, never admin-editable

**Status:** Accepted
**Date:** 2026-09-01
**Module:** 02 (`@repo/theme`)
**Supersedes:** —
**Superseded by:** —

## Context

plan.md A6's requirement-coverage table: "Hover/active colors — ✓ derived
(`--primary-hover`, `--primary-active`) — Keep **derived, not editable** —
record as ADR: admins set base colors; hover/active are computed so they can
never fail contrast. Expose a read-only preview in the theme editor instead
of inputs." The reference `theme-engine.ts` already implements this
(`shade(b.primary, -0.14)` / `shade(b.primary, -0.26)`) but never states it
as a locked decision — a future admin-UI change could "helpfully" add hover
color inputs without realizing that reopens a contrast-failure class of bug.

## Decision

`--primary-hover` and `--primary-active` (and any future interactive-state
variant) are always computed from the base brand color via `shade()` —
never stored, never an admin-editable field, never present in
`BRAND_FIELD_REGISTRY`. The admin sets exactly the seven `BrandColors`
swatches; every derived state (hover, active, and the `deriveInteractive`
text/ring variants) is a pure function of that base value plus the active
surface palette. Module 09's theme editor exposes derived values as a
read-only preview, not a form field.

## Consequences

- An admin cannot pick a hover color that clashes with or fails to read
  against the base fill — the whole class of "hover state is illegible" bug
  is structurally impossible, not just validated against.
- Rebranding (changing one swatch) automatically and correctly updates
  every interactive state derived from it — no stale hover color left
  behind after a primary-color change.
- A brand that wants a _specific_, non-derived hover treatment (a
  deliberately different hue on hover, not just a shade) has no escape
  hatch under this design. Accepted: no requirement asked for that, and it
  would reopen the exact contrast-failure risk this ADR closes.

## Alternatives considered

- **Admin-editable hover/active with contrast validation on save.**
  Rejected: validation catches a bad value after the admin picks it, but
  derivation makes a bad value impossible to pick in the first place — a
  strictly stronger guarantee for the same admin-facing outcome ("the site
  looks right"), per plan.md's own framing.

## Compliance

- `BRAND_FIELD_REGISTRY` (the data-driven admin form source, Module 09)
  contains no hover/active entries — reviewed whenever that registry
  changes.
- `tokensToCss`'s snapshot test asserts `--primary-hover`/`--primary-active`
  are present and computed, not sourced from any input field.
