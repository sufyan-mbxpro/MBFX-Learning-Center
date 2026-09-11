# ADR-073: `*-interactive` inks hold 4.5:1 on their own tint, not just on the page

**Status:** Accepted
**Date:** 2026-09-11
**Module:** 02 (`@repo/theme`, `tokensToCss` / `validateMode`), 07 (`@repo/ui`,
tonal Badge and Button recipes)
**Supersedes:** —
**Superseded by:** —

## Context

The reference UI (changes-20) draws every status chip as tonal text on a 10%
tint of the same hue: `bg-success/10 text-success`. ADR-072 §1 already rejects
the raw-hue ink and substitutes `text-success-interactive`. That is our
engine's derivation, and it is guaranteed at 4.5:1.

It is guaranteed against the **page background only**. Measured with the
engine's own maths, the default palette on a 10% tint of its own hue:

| Ink on its 10% tint | Light  | Dark   |
| ------------------- | ------ | ------ |
| success             | 4.25:1 | 4.41:1 |
| warning             | 4.31:1 | 8.83:1 |
| destructive         | 3.95:1 | 4.37:1 |
| primary             | 4.34:1 | 6.26:1 |
| info                | 8.36:1 | 4.53:1 |

Tonal text renders at 10–12px, so the 4.5:1 small-text floor applies. This
was already shipping. It affects:

- the tinted Button intents (ADR-046, `bg-x/10`, hover `/20`)
- the public `eyebrow` badge (`bg-primary/10 text-primary-interactive`)
- the course-card level chips (`bg-x/12`, `/15`)

The property-based theme contract never saw it, because it only measures
`*-interactive` against `--background`.

ADR-072 §1 says accessibility overrides visual copying. This ADR is that
principle applied to a derivation rather than a single value.

## Decision

1. **`*-interactive` is derived against the hardest surface it is contracted
   to sit on:** its own hue at **15%** over the background
   (`TONAL_TINT_CONTRACT = 0.15`), not the bare background.
   - In light mode the tint is darker than the page. In dark mode it is
     lighter than the page. Either way it is the harder case, so an ink that
     clears 4.5:1 on the tint clears it on the page too.
   - One derivation covers both surfaces.
2. **Tonal surfaces are capped at the contract.** A tonal chip or intent
   button rests at `/10` and hovers at `/15`. The previous dark-mode
   `/20`–`/30` steps and the `/12` and `/15` chip tints fold into that pair.
   A tint above 15% under an `-interactive` ink is outside the contract and is
   a bug.
3. **The admin's link-text advisory reports the same value the engine
   emits.** `validateMode`'s remedy uses the same tint-aware derivation, so the
   editor never recommends a colour the renderer does not use.
4. **Nothing is admin-editable here** (ADR-003: derived states stay derived).
   A custom palette gets the same guarantee automatically.

## Consequences

- Default inks darken slightly in light mode: success `#2969B7` (was
  `#2D72C7`), destructive `#BF332E` (was `#D93A34`), warning `#99620A` (was
  `#A3680A`), primary `#84603D` (was `#936B44`). In dark mode they lighten:
  success `#4683CE`, destructive `#DE524C`, info `#5C86B0`. The raw fills and
  the `--primary` swatch are unchanged, so this is a text-only shift.
- Link text and `.ed-tx-*` (they read `*-interactive`) get the same
  darkening. Accepted: it is the same guarantee, applied once.
- The property-based contract gains a clause: random palettes produce
  `*-interactive` ≥ 4.5:1 on their 15% tint.

## Alternatives considered

- **New `*-on-tint` tokens next to `*-interactive`.** Rejected: two inks per
  hue that differ by a few percent is a choice every call site would get
  wrong. The stricter value is correct everywhere the looser one is.
- **Drop tinted surfaces for solid fills.** Rejected: the reference's status
  language is tonal. This keeps its look and fixes the contrast.
- **Contract at 20%** (to cover the old `/20` hover). Rejected: it darkens
  every ink further to protect a hover state that §2 removes instead.

## Compliance

- `@repo/theme` tests cover:
  - every default `*-interactive` ≥ 4.5:1 on its 15% tint, both modes
  - the fast-check contract extended to the tint
  - the `validateMode` remedy equals the emitted value
- `@repo/ui`: Badge and Button tonal recipes rest at `/10`, hover at `/15`,
  and never use a raw-hue ink (tested).
