# ADR-039: Outfit is the brand typeface, and the sans default is code-owned

**Status:** Accepted
**Date:** 2026-09-06
**Module:** 02 (`@repo/theme`) / 07 (`@repo/ui`)
**Supersedes:** —
**Superseded by:** —

## Context

The owner asked for the Outfit typeface across the entire platform —
public site and admin panel, headings, body, buttons, tables, forms and
menus alike.

Three facts make this more than a one-line default change:

1. **ADR-005** put fonts behind a curated registry: `CURATED_FONTS` in
   `@repo/theme` holds the keys, `@repo/ui/fonts` fulfils each non-`system`
   key with a `next/font/local` family whose CSS variable is
   `--font-{key}`. Outfit is not in that registry, so it cannot be selected
   or emitted today. `DEFAULT_LAYOUT.fontSans` is `"system"`.
2. **ADR-038** paused the theme editor's Layout & Display tab, which is
   where the font pickers live. There is currently no admin path to change
   `fontSans` at all — the stored value simply round-trips unedited on
   every theme save. So "make the site use Outfit" cannot be satisfied by
   an admin action; it has to be satisfied in code.
3. `loadActiveTheme` reads `layoutTokens` off the active `Theme` row and
   only falls back to `DEFAULT_LAYOUT` when the row is absent. A seeded
   database already carries `fontSans: "system"` as a stored value.
   Changing the default alone would therefore change nothing on any
   existing install — including the owner's.

The pre-launch database policy is reset-and-reseed, not backfill, so a
migration is not the tool here either; the seed is.

## Decision

- **Add `outfit` to `CURATED_FONTS`** (`category: "sans"`, label
  `"Outfit"`) and fulfil ADR-005's contract for it in `@repo/ui/fonts`: a
  `next/font/local` variable family named `--font-outfit`, sourced from
  `@fontsource-variable/outfit` like every other curated family.
- **`outfit` is the only curated family declared with `preload: true`.**
  Every other family keeps `preload: false` for ADR-005's stated reason
  (nine declared, one used). Outfit is the exception precisely because it
  is now the default — it is used on essentially every render, so
  preloading it is the correct call rather than a wasted download.
- **`DEFAULT_LAYOUT.fontSans` becomes `"outfit"`.**
- **The `"system"` fallback in `loadActiveTheme` becomes
  `DEFAULT_LAYOUT.fontSans`.** An unrecognized/removed key now falls back
  to the brand typeface rather than to the OS stack. `"system"` remains a
  valid, selectable registry key — it is no longer the _fallback_.
- **The seed writes `DEFAULT_LAYOUT` on update as well as create** (it
  already did), so `pnpm db:seed` moves an existing install onto Outfit.
  This is the supported path; there is no backfill migration.
- Fonts stay a _theme token_, not a hardcoded `font-family`. Nothing
  outside `@repo/ui/fonts` and `@repo/theme` names Outfit: the chain
  `--brand-font-sans → --font-sans → Tailwind's font-sans → body` is
  unchanged, so every surface inherits it with no call-site edits, and
  re-enabling the Layout & Display tab (ADR-038) restores admin choice
  with no code change.

## Consequences

- Someone who wants a different typeface after ADR-038's pause is lifted
  can pick one in the admin as before; while it is paused, changing the
  brand typeface means editing `DEFAULT_LAYOUT` and re-seeding. That is
  the deliberate trade ADR-038 made for every other layout token, applied
  consistently here.
- `preload: true` on Outfit adds one render-blocking font request to first
  paint on both surfaces. Accepted: it is the font the page is about to
  render in, so the alternative is a guaranteed FOUT on every cold visit,
  not a saved request. If a Module 14 Lighthouse budget on public routes
  regresses on this, the mitigation is `display: swap` tuning, not
  reverting the preload.
- An install whose `Theme.layoutTokens` was hand-edited to a non-default
  `fontSans` keeps that value — the change is to the default and the
  fallback, not an overwrite of a deliberate choice. Only re-seeding
  resets it.
- The registry grows to 12 keys (8 sans + 4 mono), at the top of plan.md
  A7's "8–12 families" guidance. Adding a 13th needs a reason.

## Alternatives considered

- **Hardcode `font-family: Outfit` in `globals.css`'s `body` rule.**
  Rejected: it severs the token indirection ADR-005 and the theme engine
  are built on, silently dead-ends the (paused, not deleted) font picker,
  and violates code-style.md #1's spirit — the same reason no component
  names a color.
- **Set `fontSans: "outfit"` directly on the `Theme` row via a migration.**
  Rejected: the pre-launch policy is reset-and-reseed; a data migration
  for a value the seed already owns is a second source of truth.
- **Leave the default at `"system"` and just add Outfit to the registry,
  telling the owner to pick it in the admin.** Rejected: the picker is
  behind ADR-038's pause, so there is no such action to take.
- **Un-pause the Layout & Display tab so the font is admin-selectable
  again.** Rejected: ADR-038 is one day old and was an explicit owner
  decision that site design is code-owned. Adding a font to the code-owned
  set is consistent with it; reversing it to satisfy a font request is not.

## Compliance

- `CuratedFontKey` is a string union, so `DEFAULT_LAYOUT.fontSans =
"outfit"` only typechecks once the registry entry exists — the two
  halves of ADR-005's contract cannot drift apart in the `@repo/theme`
  direction.
- `@repo/theme`'s snapshot test of the emitted stylesheet covers
  `--brand-font-sans`, so the default change is asserted, not assumed.
- The `@repo/ui` side of ADR-005's contract (a `--font-{key}` family per
  non-`system` key) stays review-enforced, as ADR-005 left it.
