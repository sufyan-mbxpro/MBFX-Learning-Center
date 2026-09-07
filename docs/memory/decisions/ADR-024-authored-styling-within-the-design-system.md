# ADR-024: Admin-authored pages stay inside the locked design system — tokens only, bounded motion, and the quality gates extended to authored content

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** — (rejects v1 §9.2's custom per-block hex colours and
§5.2/§9.3's `CmsEffectPreset` builder)
**Superseded by:** ADR-032 (in part — §1 style vocabulary extended, still token-only), ADR-029 (in part — the §4 "Query cost" row becomes a
configurable data budget; every other gate here stands)

## Context

v1 §9.2 lets a block store `{ background: { mode: "custom", light: "#…",
dark: "#…" } }` and render it as scoped CSS variables; §8.2's `colorField`
gives the admin two hex pickers; §9.1 shows the theme emitting a
hand-authored `--color-primary-hover`; §9.3 adds a `CmsEffectPreset` table
plus a preset builder with sliders.

Every one of those collides with a decision this repo has already made and
tested:

- **ADR-003** — interactive colours (`hover`, `active`) are _derived_ by the
  theme engine precisely so an admin can never produce a failing pair. v1
  emits them as data.
- **code-style.md #1** — a hex literal outside `@repo/theme` fails lint.
  Authored hex in page JSON evades lint entirely: it is data, not source.
- **`@repo/theme`'s property-based contrast contract test** — proves that
  _every_ emitted (text, surface) pair meets its WCAG threshold, over
  randomly generated palettes. A per-block custom background is outside the
  set of pairs that test covers, so the guarantee silently stops being true.
- **ADR-018** — public motion is CSS-first with no animation library,
  because the public surface carries a blocking Lighthouse budget that is
  also the admin-bundle-leak backstop under ADR-006. `Reveal`, `Counter`,
  `Marquee`, `ImageReveal` and `PageLoader` already exist as bounded
  components.
- **CSP** — public pages are static shells with a nonce-less `style-src`;
  authored inline styles survive only on `style-src-attr 'unsafe-inline'`,
  which is a concession to React's `style={}` usage, not a licence to build
  a styling system on it.

The deeper problem is structural: **every quality gate in this repo runs
against source code, and admin-authored layout is data.** Contrast tests,
axe, Lighthouse budgets, the logical-property lint rule and catalog
completeness all stop at the boundary of the builder. v1 answers with §18
bullets. A builder that can defeat five gates needs gates, not bullets.

## Decision

### 1. Authored styling is token-only

A block's `supports.styleOverrides` may offer **only enumerated token
choices**, never free colour input:

```ts
background: "none" | "surface-1" | "surface-2" | "primary" | "secondary" | "accent";
textTone: "default" | "muted" | "on-primary"; // resolved by the engine
padding: "none" | "sm" | "md" | "lg" | "xl"; // spacing scale keys
radius: "none" | "sm" | "md" | "lg"; // radius scale keys
width: "narrow" | "default" | "wide" | "full";
```

The renderer maps each choice to the semantic Tailwind class that already
consumes the theme variable (`bg-surface-1`, `text-muted-foreground`, …).
**No hex, no arbitrary values, no `style={}` from authored data, no
`class` passthrough.** Consequently: rebranding still re-skins authored
pages; the contrast contract still covers every pair that can appear; and
dark mode keeps working with no per-block dark value to author, because the
tokens already carry both modes.

Text/background pairings are constrained at the schema level — a block
offering `background: "primary"` resolves its foreground to
`--primary-foreground`, the engine's derived, contrast-checked partner. An
admin cannot pair arbitrary tone with arbitrary surface.

### 2. Motion is a bounded enum over shipped components

`entrance: "none" | "fade" | "fade-up" | "stagger"` maps to the existing
`Reveal` component; `hover: "none" | "lift" | "zoom"` maps to existing
utility classes; counters and marquees are blocks, not effects. There is no
`CmsEffectPreset` table and no slider-based preset builder. All motion stays
under `@media (prefers-reduced-motion: no-preference)`, as ADR-018 requires.

### 3. Authored text is translatable or it is not shipped

Every user-facing string a block renders is either (a) an i18n catalog key
chosen from a list, or (b) a `translatableText` prop stored per locale in
the node. There is no third option. A page published with a locale missing
a translatable prop shows the base locale's value **and** is flagged in the
admin translation status — matching the existing `TranslationStatus` /
`sourceHash` flow.

### 4. The gates extend to authored content — as gates

| Gate                 | Extension                                                                                                                                        | Blocking?                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Contrast contract    | Property test over **every legal `(background, textTone)` combination the block schemas can express**, not just theme pairs                      | yes                             |
| axe                  | Renders a fixture page containing **every registered block** (light/dark, ltr/rtl) and scans it; plus an axe scan of each seeded CMS page in E2E | yes, serious/critical           |
| Heading order        | A renderer-level validation: a page whose rendered heading levels skip a level fails **publish**, with the offending block named                 | yes, at publish                 |
| Lighthouse budget    | The seeded CMS home + a "worst realistic page" fixture (max blocks, max collections) are added to the budget run                                 | yes                             |
| Logical properties   | Block renderers are source, so the existing lint covers them; authored props expose no physical direction at all                                 | yes                             |
| Catalog completeness | Extended to report translatable props with no value in an active locale                                                                          | warn (matching today's posture) |
| Query cost           | Renderer caps: `limit ≤ 24` per collection block, **≤ 6 provider-backed blocks per page**, refused at publish                                    | yes, at publish                 |

Publish is the enforcement point for the page-level checks: `publishPage()`
runs them and refuses with a named list, exactly as the theme editor's
`validateTheme` blocks a failing save today.

## Consequences

- **Admins cannot express an arbitrary design.** They compose approved
  blocks with token choices. This is a deliberate reduction from v1's
  "Elementor-like" framing, and it is the only version of the feature that
  keeps ADR-003, ADR-018 and the contrast contract true. The mitigation for
  a genuinely needed design is a code change: a new block or a new card
  template variant, shipped through review.
- **A "make this section brand-orange" request needs a token, not a picker.**
  The theme editor already gives admins the brand palette; adding a
  `accent-2` token is a schema change with a contrast test, which is the
  right amount of friction.
- **Publish can fail.** Editors will hit "heading order" and "too many
  collections" errors. The error text must name the block and the fix, or
  this becomes the most hated screen in the product.
- **The fixture page becomes maintenance.** Every new block must be added
  to it; a CI check asserts every registered block type appears in the
  fixture, so forgetting fails the build rather than silently shrinking
  coverage.

## Alternatives considered

- **v1's custom hex with an editor-side contrast warning.** Rejected: a
  warning is not a gate, the value still lands in data outside every test,
  and it reopens the exact class of bug ADR-018 documents (a primary at
  1.79:1 that no lint rule catches).
- **Allow a `className` passthrough for "power users".** Rejected: it is
  arbitrary CSS with extra steps, it defeats the logical-property rule, and
  it makes every future Tailwind upgrade a content migration.
- **Per-block dark-mode overrides (v1 §9.2).** Rejected: tokens already
  carry both modes; authoring a dark value per block is how sites end up
  with one section that ignores the user's mode choice (ADR-008).
- **Run the gates only in CI, not at publish.** Rejected: CI does not run
  when an admin publishes; the check has to be where the action is.

## Compliance

- The combination-contrast property test and the all-blocks axe fixture are
  new suites in `@repo/blocks`, both blocking.
- `scripts/check-block-fixtures.mjs` — every registered block type appears
  in the render fixture and in the axe fixture page.
- `publishPage()` unit tests: heading-skip refused, 7-collection page
  refused, `limit: 50` refused, each with the block id in the message.
- Schema-level: `@repo/contracts` block prop schemas contain **no `string`
  colour fields**; a test asserts no block schema accepts a value matching
  `/^#[0-9a-f]{3,8}$/i`.
