# ADR-102: A display typeface, and the third font slot

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 02 (`@repo/theme`: `LayoutTokens`, `CURATED_FONTS`, emission),
07 (`@repo/ui`: the font declarations, `--font-display`), 09 (the theme
editor's paused Layout tab), 12 (public site, by use)
**Supersedes:** ADR-072 §6 in part — Inter remains the brand **sans** and the
admin's one typeface; it is no longer the only family the system can express.
**Superseded by:** —

## Context

The changes-31 reference runs **two typefaces split by job**: a high-contrast
serif for anything _said_ (the hero line, section headings, stat numerals, the
wordmark, the CTA banner) and a neutral sans for anything _operated_ (nav,
buttons, labels, meta, captions, form controls). The extraction's finding is
that this duality is not decoration — it **is** the typographic system, and it
is the single largest reason the reference reads editorial where our public
surface reads product.

Our system cannot express it. `LayoutTokens` has exactly `fontSans` and
`fontMono`; `CURATED_FONTS` has nine sans and four mono faces and **no serif**;
`tokensToCss` emits `--brand-font-sans` and `--brand-font-mono` and nothing else.

Three ways to get a serif headline, two of them wrong:

1. Import a serif in the home page and set `font-family` on the headings —
   a hardcoded typeface, which is code-style #1's sibling rule and exactly what
   ADR-072 §2 exists to prevent.
2. Repoint `fontSans` at a serif — the whole UI becomes serif, including every
   button and table.
3. Add a third slot. Chosen.

## Decision

### 1. `LayoutTokens.fontDisplay`, a third curated slot

A curated font key (ADR-005), not a raw CSS stack, exactly like its two
siblings. `CURATED_FONTS` gains a `"serif"` category and the display faces;
`tokensToCss`/`buildThemeStyleSheet` emit `--brand-font-display`; `@repo/ui`'s
`@theme` block maps `--font-display: var(--brand-font-display)`, which makes
`font-display` an ordinary Tailwind utility.

**Default: Fraunces**, with **Playfair Display** and **Cormorant Garamond** as
the alternatives. The reference's headline is visibly a display cut rather than
a body serif scaled up — a text serif at 64px looks thin and wide in exactly the
way that headline does not — and Fraunces is drawn for that size.

Three, not more. Each entry costs a declared family, and a registry option with
no declaration behind it would emit `var(--font-…)` pointing at nothing, which
`isCuratedFontKey` cannot catch because the key IS curated. Three covers the
range a serif choice actually spans: a display cut, a high-contrast classic, and
a light elegant one.

**The weight-axis subset, not the full-axis file.** Fraunces also ships an
optical-size axis, which browsers would apply for free (`font-optical-sizing` is
`auto` by default) — but only from the 121 KB all-axes file, against 36.6 KB for
weight alone. That is 84 KB on a public route, more than Inter's entire face,
for an effect a reader cannot name. Declined; the same judgement applies to any
future axis.

### 2. Absent means `fontSans`

`fontDisplay` is **optional** in `layoutTokensSchema` and falls back to the
resolved `fontSans` when it is missing or names an unknown key. This is not
defensive tidiness, it is the compatibility guarantee: every `Theme` row that
exists today predates the field, and a required token would break every one of
their saves — the same reasoning `baseFontSize` is already optional for, and the
same fallback `loadActiveThemeTokens` already applies to an invalid curated key.

A site that never sets it renders exactly as it does today.

### 3. Display type is a PUBLIC device; the admin keeps one typeface

`font-display` is used on public display type — the hero line, section headings,
stat numerals, pull quotes. **code-style #6 is unchanged**: the admin renders in
the brand sans. An admin screen is a tool, its density is its virtue, and a
serif heading over a data table is costume.

This is the same public/admin split ADR-101 §4 draws for the card and ADR-072 §7
draws for spacing — one system, two densities — and it is why this ADR supersedes
only _part_ of ADR-072 §6.

### 4. The picker ships into a paused tab, and stays there

The theme editor's Layout & Display tab is hidden (`THEME_LAYOUT_TAB_ENABLED =
false`, ADR-038, made permanent by ADR-042). `fontDisplay` gets its field, its
catalog label and its `AdminCombobox` beside `fontSans`/`fontMono` — **behind
that same flag.**

So the honest statement of what an admin controls today: **colour is fully
admin-editable** (Colors, Modes, Presets and Logos are live); **typography is a
theme-row token whose picker is paused**, precisely as `fontSans` has been since
ADR-038. Un-pausing the tab is ADR-042's decision to reverse and needs its own
ADR. Building the field now means that reversal is a one-line flag flip rather
than a second round of plumbing.

### 5. Weight, not a second file, for emphasis

The serif is declared as a **variable** family (`@fontsource-variable`) with a
full weight axis and `preload: false`, like every curated face except Inter. No
italic file: the reference uses none, and an unpreloaded second file for an
effect nobody asked for is weight on a public route (architecture.md #5).

## Consequences

- One more font family in the `node_modules` declaration list. **Zero cost to a
  visitor whose theme doesn't reference it** — `preload: false` means the file
  is requested only if a rendered `--brand-font-display` points at it, which is
  the arrangement ADR-072 already established for the other nine.
- Inter is still preloaded and still the sans; the display face is the second
  requested font on a public page that uses it. It renders headings, so it is on
  the LCP path: `fallback: ["serif"]` and the variable file keep the swap cheap,
  and the hero's `font-display` heading is a text LCP candidate that must not
  wait on it.
- `SaveThemeInput`, `layoutTokensSchema`, the theme editor, `en.json` and the
  seeded default row all gain a field. The mirrored
  `default-theme-tokens.json` must move with it (`seed-sync.test.ts`).
- **ADR-039's principle holds a second time:** superseding a default deletes
  nothing an admin may have picked. Outfit stayed selectable when Inter replaced
  it; Inter stays the sans, and a site that wants no serif sets `fontDisplay` to
  a sans key and is done.
