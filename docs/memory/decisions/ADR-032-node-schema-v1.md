# ADR-032: Node schema v1 — admin essentials, bounded responsive values, token-only backgrounds with an overlay gate, and page-model amendments

**Status:** Accepted
**Date:** 2026-09-04
**Module:** 16 (Website Builder / CMS)
**Supersedes:** ADR-024 **in part** (§1's style vocabulary is extended — still token-only; §2–4 stand) · ADR-021 **in part** (adds columns to `Page` and `PageVersion`; the model shape otherwise stands)
**Superseded by:** —

## Context

Plan v2 §6.1 defines the stored node as
`{ type, version, id, props, translations?, children? }` and ADR-024 §1
limits authored styling to five token choices (`background`, `textTone`,
`padding`, `radius`, `width`). The owner's brief
(`docs/changes/dynamic-site-plan-v2-review.md` §3) lists things every
builder needs that this schema cannot express:

- hide a block without deleting it; give it an admin label; give a section
  an anchor;
- **responsive** settings — columns, spacing, alignment and visibility per
  device — with nothing in the plan and only the 375/768/1440 preview
  widths implied;
- **backgrounds** beyond a flat token: gradient, image, video, overlay;
- shadow, border, gap.

Two implementation facts the plan does not state and that the schema must
respect: **Tailwind v4 emits only classes it finds statically in source**,
so a renderer that concatenates `bg-${token}` produces classes that do not
exist; and the `@repo/blocks/definitions` subpath ADR-020 rule 4 promises
for a native renderer only works if it never imports `@repo/ui`.

Finally, plan §8 promises autosave "with an optimistic-lock conflict
toast" but `PageVersion` (ADR-021) has no `updatedAt` or revision counter
to compare, and it is unstated whether an autosave creates a new version
row (history explodes) or writes the draft in place.

## Decision

### 1. The node envelope

```ts
StoredNode = {
  type: string; version: number; id: string;
  props: unknown;                          // per-block Zod schema
  label?: string;                          // admin-only name; never rendered
  hidden?: boolean;                        // renderer skips; composer dims. Distinct from visibility (audience)
  anchor?: string;                         // slug; rendered as the section's `id`; targetable by LinkTarget{ANCHOR|PAGE.anchor}
  style?: { presetId?: string; overrides?: StyleChoices };   // ADR-033 for presetId
  motion?: MotionChoices;                  // ADR-024 §2, unchanged
  visibility?: FeatureVisibility; requiresFeature?: string;  // unchanged
  responsive?: ResponsiveOverrides;        // §3
  translations?: Record<Locale, Record<string, unknown>>;    // unchanged
  children?: StoredNode[];
}
```

`label`, `hidden` and `anchor` are envelope fields so every block gets them
without per-block schema work; `anchor` is unique per page (a publish
warning, not a block).

### 2. Style choices — still token-only, now complete

```ts
StyleChoices = {
  background?:
    | { kind: "token";    token: "none" | "surface-1" | "surface-2" | "primary" | "secondary" | "accent" }
    | { kind: "gradient"; from: BrandToken; to: BrandToken; direction: "to-b" | "to-r" | "to-br" | "radial" }
    | { kind: "image";    assetId: string; fit: "cover" | "contain"; position: "center" | "top" | "bottom";
                          overlay: Overlay; fixed?: boolean }
    | { kind: "video";    assetId: string; posterAssetId: string; overlay: Overlay };   // self-hosted only
  textTone?: "default" | "muted" | "on-primary" | "on-image";
  padding?:  "none" | "sm" | "md" | "lg" | "xl";
  gap?:      "none" | "sm" | "md" | "lg";
  radius?:   "none" | "sm" | "md" | "lg";
  shadow?:   "none" | "sm" | "md" | "lg";
  border?:   "none" | "hairline" | "strong";
  width?:    "narrow" | "default" | "wide" | "full";
}
Overlay = { tone: "none" | "light" | "dark" | "brand"; strength: "sm" | "md" | "lg" }
```

- **No hex, no arbitrary values, no `style={}` from data, no class
  passthrough** — ADR-024 §1 unchanged. Gradients are pairs of brand
  tokens; image and video backgrounds are `MediaAsset` ids.
- **The overlay gate.** When `background.kind` is `image` or `video` and
  the node has any text-rendering descendant, `overlay.tone` must not be
  `none` and `textTone` resolves to `on-image`, whose foreground the engine
  pairs with the overlay (`dark`/`brand` → light text, `light` → dark
  text). `publishPage()` refuses the combination `image|video` +
  `overlay.tone: none` + text descendants, naming the block. The
  `@repo/theme` contrast property test is extended over every legal
  `(overlay, textTone)` pair at every strength, which is what keeps ADR-024's
  guarantee true for authored imagery.
- **Video backgrounds** are self-hosted `MediaAsset`s only (never an
  embed), rendered `muted playsinline loop` with `preload="none"` and
  `loading="lazy"`, **poster mandatory**, and replaced by the poster under
  `prefers-reduced-motion: reduce` (ADR-018). The Lighthouse
  "worst realistic page" fixture gains a video-background section.
- `fixed` (background-attachment) is ignored on touch devices and under
  reduced motion.

### 3. Responsive values — three breakpoints, a bounded prop set

```ts
ResponsiveValue<T> = T | { base: T; md?: T; lg?: T }     // 0 / 768 / 1440 — the preview widths
ResponsiveOverrides = {
  hiddenOn?: ("mobile" | "tablet" | "desktop")[];
  // per-block responsive props are declared by the block: e.g. columns.count, grid.columns,
  // section.padding, heading.align, columns.order — each a ResponsiveValue over its own enum
}
```

Only props a block's definition marks `responsive: true` accept a
`ResponsiveValue`; the composer shows a device toggle on exactly those.
Three breakpoints are fixed by this ADR; adding a fourth is a new ADR
because it changes every lookup table.

### 4. Class emission is a lookup, never a template

Every enum → class mapping in `@repo/blocks` and `@repo/ui` is a **literal
table** (`{ padding: { sm: "py-4", md: "py-8 md:py-12", … } }`), including
the responsive variants (`{ base: "grid-cols-1", md: "md:grid-cols-2", lg:
"lg:grid-cols-3" }`). A test renders every enum value of every table and
asserts each emitted class exists in the built CSS. A `bg-${x}` template
anywhere under `packages/blocks` fails lint (`no-restricted-syntax` on
template literals inside `className`).

### 5. The definitions subpath is pure

`@repo/blocks/definitions` (and `@repo/widgets/*/definition`, ADR-030)
import only `@repo/contracts` and catalog **keys** from `@repo/i18n`.
Never `react-dom`, never `@repo/ui`. A test asserts it; this is what lets a
native renderer reuse the schemas.

### 6. Page-model amendments (ADR-021)

```prisma
model Page        { … updatedById String?  parentId String?  group String? … }
model PageVersion { … updatedAt DateTime @updatedAt  revision Int @default(0)
                      gateResult Json?   templateKey String? … }
```

- **The draft version is mutable in place.** Autosave writes
  `PageVersion(draftVersionId)` with `revision + 1`, refusing when the
  client's `revision` is behind (the optimistic lock). **Publish snapshots**
  the draft into a new immutable `PageVersion` row and points
  `publishedVersionId` at it; the draft continues from that snapshot.
  History = publishes, not keystrokes.
- `gateResult` stores the last publish-gate run (gates run on autosave,
  debounced, so the composer and the Overview can show failures before
  publish); `templateKey` records which `LayoutTemplate` the version was
  started from (ADR-033), for usage reporting.
- `parentId` gives breadcrumbs and **nested paths**: a translation's `path`
  is derived from the ancestor chain's slugs per locale
  (`/tools/pip-calculator`) and re-derived for descendants on a parent slug
  change, writing `Redirect` rows for each old path (ADR-015 #1). Depth is
  a publish warning above 3. `group` is an admin-only label for the list
  screens.
- "Unpublished changes" is `draft.revision > publishedSnapshot.revision`;
  the composer shows it and the Overview counts it.

## Consequences

- **The node schema is larger and frozen earlier.** Every field here has a
  Zod default, so v1 fixtures without them validate; adding a field later
  is additive. Renaming one is an ADR.
- **Overlay is a hard gate.** An admin who wants white text on an
  un-overlaid photo will be refused with the block named. Deliberate; the
  fix is a `light`/`dark` overlay at `sm`.
- **Video backgrounds cost bytes.** Poster-first, lazy, one per page by
  budget default (`cms.dataBudget.page.videoBackgrounds: { warn: 1,
block: 2 }`, ADR-029 §5 pattern), and a Lighthouse fixture.
- **Lookup tables are boilerplate.** They are also the only reason the
  classes exist in the CSS; the test makes forgetting one loud.
- **Nested paths add a derivation step** to slug changes. It runs in the
  same transaction as the slug write and reuses the `Redirect` path already
  exercised by articles.

## Alternatives considered

- **Free `className`/`style` for "advanced" admins.** Rejected — ADR-024
  §Alternatives; nothing changed.
- **Arbitrary CSS gradients / colour stops.** Rejected: two brand tokens
  and a direction cover every on-brand gradient; free stops reintroduce
  hex.
- **Background video via YouTube/Vimeo embeds.** Rejected: uncontrollable
  autoplay policies, third-party scripts in a static shell, and no poster
  under reduced motion.
- **Per-breakpoint everything.** Rejected: an unbounded responsive matrix
  makes the class tables and the contrast fixture explode; a declared prop
  set is enough for layout, spacing, alignment and visibility.
- **New `PageVersion` row per autosave.** Rejected: thousands of rows per
  page, meaningless history, and every usage scan multiplied.

## Compliance

- Contract tests: every node envelope field has a default; no block schema
  accepts `/^#[0-9a-f]{3,8}$/i` (unchanged); `image|video` background
  requires `overlay` and `posterAssetId` (video).
- `@repo/theme` property test extended over `(overlay.tone, overlay.strength,
textTone)`.
- `publishPage()` test: image background + heading + `overlay: none` →
  refused with the block id; same with `overlay: dark` → publishes.
- Class-table test: every emitted class exists in the built CSS; lint rule
  against template literals in `className` under `packages/blocks`.
- Definitions-subpath import test (no `react-dom`, no `@repo/ui`).
- Reduced-motion test: video background renders the poster only.
- Optimistic-lock test: two autosaves with the same base `revision` → the
  second is refused; publish creates a new row and leaves the draft
  editable.
- Nested-path test: parent slug change re-derives child paths and writes a
  `Redirect` per old path.
