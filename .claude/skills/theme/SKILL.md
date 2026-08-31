# SKILL — Module 02: @repo/theme (theme engine)

Reference: `docs/reference/theme-engine.ts` (port with fixes),
`docs/reference/globals.css`, plan.md A5 + Module 02. ADRs: 003 (derived
hover/active), 004 (Cache Components), 005 (curated fonts), 008 (user mode).

## Token vocabulary

`BrandColors` (7 fields, mode-independent) + `SurfacePalette` (per mode) +
`LayoutTokens` (+ **add `baseFontSize`**, 13–16px) + `BrandOverrides`
(dark-mode escape hatch, sparse). Registry-driven admin form via
`BRAND_FIELD_REGISTRY`.

## Fixes to apply while porting (do NOT port verbatim)

1. **A5.1 scope resolution:** `orderBy: { scope: "asc" }` is wrong for web
   ("both" < "web" alphabetically). Exact scope must beat "both"
   deterministically — pick in code, and write the regression test FIRST.
2. **A5.3 full hex values:** delete `rgbChannels()`; emit `--background:
#ffffff` style values. Tailwind v4 handles opacity via color-mix.
3. **A5.2 font vars:** engine emits `--brand-font-sans/--brand-font-mono`;
   `@theme inline` maps `--font-sans: var(--brand-font-sans)` — no
   self-reference.
4. Caching: `"use cache"` + `cacheTag("theme")` (ADR-004), NOT
   `unstable_cache`. Tag name `theme` is frozen.
5. Curated font registry (ADR-005): font keys → `next/font/local` families
   defined in `@repo/ui`. No arbitrary font URLs, ever.

## Derivation rules (frozen)

- `deriveInteractive`: same-hue sibling pushed away from background until
  ≥ target ratio (4.5 text, 3.0 ring); guaranteed-legible fallback when out
  of headroom. Hover/active are derived (`shade`), never editable.
- `readableOn` picks white/near-black foreground; validation blocks save on
  load-bearing failures (body text, button labels, input borders); raw-swatch
  link-text failures are advisory with remedy text.
- Engine is pure functions + one cached loader; no React. Loader returns
  branded defaults on empty DB.

## Required tests (90% floor — heaviest unit suite in the repo)

Known WCAG pairs (#C28D5A/#FFFFFF ≈ 2.90); shade clamping; 3-digit hex;
deriveInteractive table incl. fallback; **scope regression test** (both+web
active → web wins; admin loader with only both → both); validateTheme per
blocking/advisory rule, canSave flip, dark overrides pre-validation;
fast-check property: random valid palettes → all _-foreground ≥ 4.5, ring
≥ 3.0; CSS snapshot asserting hex output + --brand-font-_ naming.
