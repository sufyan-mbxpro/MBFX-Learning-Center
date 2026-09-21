# changes-31 — The warm editorial home page

**Module:** 02 (`@repo/theme` defaults + a third font slot), 07 (`@repo/ui`
component anatomy, reveal presets), 12 (public site — the home page)
**Date opened:** 2026-09-15
**Extraction:** `docs/design-reference/extracted-design.md`
**ADRs:** ADR-101 (warm editorial system), ADR-102 (display typeface),
ADR-103 (owner-supplied home bands), ADR-104 (a reveal plays once)
**Owner decisions (2026-09-15, in-session):** add the display font slot ·
**skip** the framed-sheet device · build **all three** owner-supplied bands ·
reveals run **once**.

---

## 1. What this is

The home page adopts the reference's design language — warm neutrals, a serif
display face, borderless cards, hairline structure, restrained shadow — and the
language reaches every surface because it lands in `@repo/theme` defaults and
`@repo/ui` components, not in page markup.

**What it is not:** a pixel copy, a colour-hardcoding exercise, or a new motion
library. Three constraints from the extraction bound the work:

- Our brand colours **already match** the reference (ADR-072 took its bronze
  from the same lineage). `DEFAULT_BRAND` is untouched.
- The reveal system **already exists** (ADR-018 rule 2). This extends it.
- The bands already **stream band-by-band** behind `<Suspense>` (ADR-095).
  `next/dynamic` applies only to client leaves.

## 2. Phases and PRs

### Phase A — tokens (`@repo/theme`, `@repo/db`)

| PR  | What                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `DEFAULT_LIGHT_SURFACE` / `DEFAULT_DARK_SURFACE` → the warm ramp (ADR-101 §2). `borderMedium` derived to clear 3:1 on background **and** muted, both modes, per ADR-072 §4's method. Mirror into `packages/db/prisma/default-theme-tokens.json`.                                                                 |
| A2  | `LayoutTokens.fontDisplay` (ADR-102): a third curated slot; `CURATED_FONTS` gains a `serif` category and the display faces; `resolveFontValue` and `buildThemeStyleSheet` emit `--brand-font-display`; `loadActiveThemeTokens` falls back to `fontSans` when the key is absent or unknown.                       |
| A3  | `@repo/ui/fonts` declares the serif families; `curatedFontVariables` carries them. `@theme` gains `--font-display: var(--brand-font-display)`. Contracts' `layoutTokensSchema` gains an **optional** `fontDisplay`; `saveThemeAction` resolves it; the (paused) Layout tab and its catalog label gain the field. |

**Gate for Phase A:** `packages/theme` contrast suite + the fast-check theme
contract + `seed-sync.test.ts` green before a single component changes.

### Phase B — the design language (`@repo/ui`)

| PR  | What                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `Button`: nothing to add. Its default shape is ALREADY the 6px rectangle and `size="icon"` + `shape="pill"` + `variant="outline"` is already the reference's circular action — what changes is that the public CTAs stop passing `shape="pill"` (ADR-101 §5). A variant added speculatively is a variant nobody calls. |
| B2  | `Card`: borderless at rest on the public surface (`variant="plain"`), hairline + whitespace separation, image flush at the card radius. Admin cards keep their current anatomy (ADR-075 holds there).                                                                                                                  |
| B3  | `Badge`: the two-fill chip system — `3xs` uppercase at `tracking-caps`, ~4px radius, a bronze and a near-black fill.                                                                                                                                                                                                   |
| B4  | New `MetricRow` primitive: the hairline-divided 3- and 4-cell group the reference uses inside cards and inside panels. One component, two densities.                                                                                                                                                                   |
| B5  | `SectionHeading`: flush-start heading, end-aligned circular action on one baseline; serif via `font-display`.                                                                                                                                                                                                          |
| B6  | `StatBand` gains a `columns` prop (the facts band is 4-up, About's is 3-up) and `StatCard` an optional `icon` — reuse over a second component, since the band IS its rhythm and dividers.                                                                                                                              |

### Phase C — motion (`@repo/ui`, ADR-104)

| PR  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `RevealObserver` becomes the primary path (run-once, `unobserve` after firing); the native view-timeline path is retained behind an opt-in for bands that want re-play. Both stay inside `prefers-reduced-motion: no-preference`; content stays visible with no JS.                                                                                                                                                                                                                 |
| C2  | `Reveal` presets: `up` (fade-up), `fade`, `start`/`end` (logical slide), `scale` (zoom-in), plus `delay`, `duration`, `threshold`. `RevealGroup` wraps a grid and staggers children by index — the "loading effect" vocabulary a future page builder can expose per section.                                                                                                                                                                                                        |
| C3  | `next/dynamic` on ONE client leaf — `VideoTile` in the `connect` band, the heaviest below-the-fold island. `Carousel` is deliberately excluded: it serves `learning_videos`, the FIRST band, and deferring above-the-fold JS makes a page slower to become interactive. `Counter` and `NewsletterForm` are too small for a lazy boundary to pay for itself. No `ssr: false` anywhere — copy has to be in the HTML. The reasoning is recorded beside the one call, in `connect.tsx`. |

### Phase D — the home page (`apps/web`)

One PR per band, in seeded order, each keeping its existing data path, variants
and permissions untouched:

`learning_videos` (now the full-height hero SLIDER) · `hero` (back to copy + panel) · **`trust_strip`** (new) · **`facts`** (new) ·
`explore_platform` · `feature_highlights` · `latest_news` · `latest_analysis` ·
`glossary_spotlight` · `popular_tools` · **`testimonials`** (new) · `connect` ·
`newsletter` · `faq` · `quotes` · `risk_disclaimer`, then the header/footer
chrome pass.

The three new keys join `HOME_SECTION_VARIANTS`, `HOME_SECTION_BUILT_KEYS`, the
seed's `home.sections` and `SECTION_PENDING` in the same PR that builds them —
`check:home-sections` fails otherwise.

### Phase E — quality

Tests per rule (§4), the DEVLOG entry, and the Module 14 items this hands on.

## 3. The three new bands (ADR-103)

Each is an **owner-supplied content module** on the ADR-047 §3 pattern, with the
ADR-051 §1 two-state switch: a `real` dataset that starts empty and a `demo`
dataset that is visibly invented, chosen by one env-read constant. An empty
`real` collection renders **nothing** — not a heading over an empty grid.

- **`trust_strip`** — partner/accreditation logos. A row of invented logos is a
  false claim about third parties, so `real` ships empty.
- **`facts`** — the hairline 4-cell figure grid. **Owner-supplied facts only,
  never row counts** (ADR-076 bans counted totals on public pages; ADR-047 §2 is
  the carve-out this rides on). `public-chrome.test.ts` is amended to allow this
  one additional `StatCard`/`StatBand` call site, and to assert the band reads
  no counting service.
- **`testimonials`** — the 3-up quote / video / offer band. Quotes are real
  attributed statements or nothing.

## 4. Test obligations

| Guard                                           | What it holds                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/theme` contrast + fast-check contract | every emitted pair clears its WCAG floor on the warm ramp, both modes                 |
| `seed-sync.test.ts`                             | the mirrored default-theme JSON matches the engine                                    |
| `type-scale.test.ts`                            | one scale, still strictly ascending; no private font sizes                            |
| `public-chrome.test.ts` (amended)               | the facts band is the only new `StatCard`/`StatBand` site and counts nothing          |
| `grid-base.test.ts`                             | every new responsive grid states `grid-cols-1`                                        |
| `rtl.test.ts` + RTL smoke                       | logical properties only; no horizontal overflow in `ar`                               |
| new `reveal.test.tsx`                           | a reveal fires once; reduced motion renders the finished state; no-JS renders visible |
| new `home-bands.test.ts`                        | an empty owner dataset renders no band, no heading, no zero                           |
| axe (Module 14)                                 | the home page at both modes                                                           |

**CLS/LCP:** reveals animate `opacity`/`transform` only and reserve their space;
the hero stays inside `EAGER_SECTIONS` with `priority` on its image and is never
wrapped in a hiding animation (extraction §8.6).

## 5. Known limits, recorded rather than discovered

1. **The theme editor's Layout & Display tab is paused** (ADR-038/042,
   `THEME_LAYOUT_TAB_ENABLED = false`). `fontDisplay` is therefore a theme-row
   token whose _picker_ is hidden, exactly like `fontSans` today. Colour stays
   fully admin-editable (Colors/Modes/Presets are live). Un-pausing the tab is
   ADR-042's to reverse, not this change's.
2. **The framed-sheet device is skipped** (owner, 2026-09-15) — it fights the
   pinned header offset, the sticky section bar and the escaping mega menu.
3. **`AmbientMotif`, `.bg-glow-primary` and `.bg-dot-grid` leave the home hero.**
   They are changes-20 devices and absent from this reference. The utilities stay
   in `globals.css` for the surfaces that still use them.
4. **`next/dynamic` is not applied to server components.** ADR-095's per-band
   `<Suspense>` already does that job.
