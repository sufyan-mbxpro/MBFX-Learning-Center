# ADR-072: One design system from the reference UI; accessibility overrides visual copying

**Status:** Accepted
**Date:** 2026-09-11
**Module:** 02 (`@repo/theme`: defaults, ring source), 07 (`@repo/ui`: type
scale, radius, shadow, fonts, component anatomy), 09 (admin shell), 12 (public
site, by inheritance)
**Supersedes:** ADR-039 (Outfit as brand typeface), ADR-054 (split
reader/admin type scale). Also replaces the `#E8B98C` primary pin from
changes-03 §2.1, a plan decision rather than an ADR.
**Superseded by:** —

## Context

changes-20 asks for the whole UI, public and admin, to adopt a reference
site's design language as **one** shared system: colours, type, control sizes,
spacing, radius, shadow, icons, and the anatomy of every component. The
reference was captured as computed styles plus full-body HTML of four admin
pages (`docs/changes/changes-20-Ui.md`) and reverse-engineered in Phase 1 into
`docs/design-system/tokens.md`, which the owner approved on 2026-09-11 with the
decisions recorded below.

The reference turned out to be stock shadcn/ui new-york v3 (Tailwind v3,
Radix) in Inter, with lucide icons, slate neutrals, and an admin brand palette
injected at runtime. Six of its seven brand colours already equal our
`DEFAULT_BRAND`. The differences are neutrals, typeface, scale, control
dimensions, radius and elevation.

Three existing decisions stand in the way, which is why this ADR exists
before the code (Part F #10):

- **ADR-039** made Outfit the brand typeface.
- **ADR-054** gave the admin a separate, larger type scale.
- **changes-03** pinned the brand primary at `#E8B98C`.

Phase 1 also found that several of the reference's own colour pairings fail
WCAG: white labels on the bronze primary (2.77:1) and on warning (1.91:1), and
an input border at 1.23:1. Copying them would put the reference's
accessibility bugs into our theme-contract suite.

## Decision

### 1. The principle: accessibility overrides visual copying

Where a reference pairing fails our contrast rules (4.5:1 text, 3:1 non-text,
the theme-contract suite in testing.md), we **do not copy it**. We keep the
accessible variant that most closely matches the reference's look. This
applies to every later phase and every component, not just the cases listed
here. A reviewer who finds a reference value rejected on contrast grounds
should find that rejection recorded as a deviation, not as a bug.

### 2. The colour scheme stays dynamic

Every colour in this ADR is a **default** of the existing admin-editable
theme. The flow is unchanged:

`BrandColors` / `SurfacePalette` ×2 / `BrandOverrides` → `Theme` row →
`tokensToCss` → `<style id="brand-tokens">` → semantic Tailwind tokens.

The Colors & Branding, Modes and Presets tabs keep working. An admin's saved
theme still wins over every value here. Components never name a colour. Hex
literals stay confined to `@repo/theme` (code-style #1).

### 3. Brand defaults (`DEFAULT_BRAND`)

- **`primary` = `#C28D5A`** (reference), replacing the changes-03 pin
  `#E8B98C`.
- **Button and fill label ink stays engine-derived.** `readableOn` renders
  `#1A1A1A` on bronze (6.01:1); the reference's white label (2.77:1) is not
  used. Same rule for warning (`#1A1A1A` at 8.7:1, not white at 1.91:1).
- `success` `#2D72C7` and `error` `#D93A34` are **kept**. They are the
  AA-safe siblings of the reference's `#3382E2`/`#E23C36`: white labels at
  4.84/4.56:1 instead of 3.87/4.26:1.
- `secondary`, `warning`, `info` and `accent` are unchanged (they already
  match the reference).

### 4. Surfaces: slate, both modes

**Light** (`DEFAULT_LIGHT_SURFACE`):

| Field         | Value     |
| ------------- | --------- |
| background    | `#FFFFFF` |
| surface       | `#FFFFFF` |
| surfaceMuted  | `#F1F5F9` |
| textPrimary   | `#020817` |
| textSecondary | `#64748B` |
| textMuted     | `#94A3B8` |
| borderLight   | `#E2E8F0` |
| borderMedium  | `#7F8FA5` |

**Dark** (`DEFAULT_DARK_SURFACE`; shadcn slate dark, the canonical
counterpart, since the reference's dark palette was not captured):

| Field         | Value     |
| ------------- | --------- |
| background    | `#020817` |
| surface       | `#020817` |
| surfaceMuted  | `#1E293B` |
| textPrimary   | `#F8FAFC` |
| textSecondary | `#94A3B8` |
| textMuted     | `#64748B` |
| borderLight   | `#1E293B` |
| borderMedium  | `#4F5E73` |

**Dark brand overrides:** `accent` = `#1E293B` (dark active/hover = muted, as
the reference's own `dark:bg-muted` utilities specify); `secondary` stays
`#E8E6E3`.

**The input border (`borderMedium` → `--input`) follows §1, not the
reference.** The reference uses its divider colour (1.23:1). No named slate
step lands near 3:1: slate-400 is 2.56:1 and fails, and slate-500 is 4.76:1,
which is the secondary-text colour and reads as a heavy outline. So the value
is the nearest point on the slate ramp that passes:

- Light: `#7F8FA5`, 43% of the way from slate-400 to slate-500. 3.29:1 on
  background, 3.01:1 on the muted surface, so a field inside a muted panel
  also passes.
- Dark: `#4F5E73`, 28% of the way from slate-600 to slate-500. 3.03:1 on
  background.

### 5. Focus ring

`--ring` is derived from **primary** instead of success:
`deriveInteractive(primary, background, 3.0)`, which gives `#BA8756` light and
`#C28D5A` dark. The reference's ring is its primary. The 3:1 non-text
guarantee (the property-based contract) is unchanged: only the source hue
moves.

### 6. Typeface: Inter, both surfaces (supersedes ADR-039)

- `DEFAULT_LAYOUT.fontSans` = **`inter`**, already a curated key
  (`@fontsource-variable/inter`, self-hosted through `next/font/local`, ADR-005).
- Inter takes over `preload: true`, and Outfit drops to `preload: false`.
- Outfit **stays a curated key**. Nothing is deleted, and the fallback for an
  unknown key is still `DEFAULT_LAYOUT.fontSans`, so it is now Inter.
- The token chain ADR-039 insisted on (`--brand-font-sans → --font-sans →
body`) is unchanged, which is why the switch is a default change and not a
  stylesheet edit.

### 7. One type scale, both surfaces (supersedes ADR-054)

`.type-scale-admin`, `--ui-*` and `ADMIN_TYPE_SCALE_CLASS` are removed. There
is one scale: `--type-*` in `:root` stays the single source, and every
`--text-*` step in `@theme inline` is `var(--type-*)`.

| Step          | Size / line-height | Replaces                                                                                                            |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `3xs` _(new)_ | 10 / 14            | reference `text-[9px]` and `text-[10px]`                                                                            |
| `2xs` _(new)_ | 11 / 16            | `text-[11px]`                                                                                                       |
| `xs`          | 12 / 16            |                                                                                                                     |
| `nav` _(new)_ | 13 / 20            | the sidebar item's `text-[13px]`. It also replaces our unused `md` step (13px, zero call sites), so there is no gap |
| `sm`          | 14 / 20            |                                                                                                                     |
| `base`        | 16 / 24            |                                                                                                                     |
| `lg`          | 18 / 28            |                                                                                                                     |
| `xl`          | 20 / 28            |                                                                                                                     |
| `2xl`         | 24 / 32            |                                                                                                                     |
| `3xl`         | 30 / 36            |                                                                                                                     |
| `4xl`         | 36 / 40            |                                                                                                                     |
| `5xl`         | 48 / 48            |                                                                                                                     |

- 9px is not carried over; nothing renders below 10px.
- `DEFAULT_LAYOUT.baseFontSize` goes from 14px to **16px**.
- Public display type (`--text-display-*`, ADR-018) is untouched.

**The public site reflows** (`text-sm` 12 → 14px, body 14 → 16px). The owner
accepted this. A **post-Phase-5 visual pass** on public pages adjusts spacing.
Per-page scale exceptions are forbidden: a page that looks wrong at the new
scale gets its spacing fixed, never a private font size.

The article editor's `.ed-fs-*` classes keep reading `--type-*`. With one
scale, ADR-054 #5's reason for pinning them no longer applies, but the pin is
harmless and keeps them independent of any future surface override.

### 8. Shape, elevation, layout constants

- `DEFAULT_LAYOUT.radiusBase` 4px → **6px**, and `--radius-xl` becomes
  `r + 6px`. That gives sm 4 / md 6 / lg 8 / xl 12, exactly the reference.
- Shadows take the reference's (Tailwind v3) values: `sm`, `md`, `lg`, `xl`,
  `2xl`, plus a new `dock`. Public `shadow-card*` and `shadow-float` are
  unchanged.
- `--height-input` 36 → **40px**; `--width-sidebar` 240 → **256px**.
- Scrollbar: 8px, pill thumb in `muted-foreground` at 30%.

### 9. Components (Phase 3, recorded now so Phase 2 tokens serve them)

The anatomy in `tokens.md` §6 is binding. Specifically:

- **The destructive button is solid** (`bg-destructive`, derived label ink),
  replacing the 10% tint. The tinted success/warning/info intent variants
  (ADR-046) stay as an extension.
- **Admin `DataTable` defaults to the compact density**; `Table` inside a
  card defaults to `default`.
- **Pagination unifies on h-9.**
- **Progress tracks use `bg-muted`**, not `bg-secondary` (near-black with our
  brand secondary).
- **Base UI stays the primitive library.** The anatomy is restyled; there is
  no swap to Radix.
- **Provisional specs:** dropdown/menu content, dialog, sheet, tooltip,
  toast, checkbox, radio, switch, breadcrumbs, textarea, sortable headers and
  empty state are "provisional — shadcn defaults" until the owner's second
  capture lands. That capture updates `tokens.md` **before** those components
  are restyled in Phase 3. It does not block Phase 2.

### 10. Where it lives, and what is not adopted

- **Tokens have two homes, one per kind, nothing defined twice.** Brandable
  colours live in `@repo/theme` (DB-backed defaults, engine-derived states).
  Everything code-owned lives in `@repo/ui`'s `globals.css`.
- The seed's JSON mirror (`packages/db/prisma/default-theme-tokens.json`)
  must equal `@repo/theme`'s exports. That is now test-enforced (see
  Compliance).
- Arbitrary Tailwind values (`-[…]`) are banned in Phase 6.
  CSS-variable references (`h-(--height-input)`) are token references and
  stay allowed. Tailwind v4's multiplier spacing (`w-37.5` = 150px) covers
  every fixed width the reference hand-wrote.
- The `/design-system` catalogue is **`/admin/design-system`**: staff-only,
  English-only (ADR-043 #2), replacing `/admin/_dev/kitchen-sink`.
- **Not adopted from the reference:** shadcn's `--chart-1…5` ramp; icon
  stroke 1.75 (it is 2 everywhere); raw `yellow-400` (it becomes `warning`);
  a second toast system (Sonner stays).

## Consequences

- Every surface changes appearance on the next reseed or theme edit.
  **An existing install keeps its stored `Theme` row**, so the new defaults
  appear only after `pnpm db:seed` (which overwrites the default theme row's
  tokens, as it always has) or when an admin edits the theme. This is the
  reset-and-reseed policy working as designed. A customised theme is not
  silently repainted by a deploy.
- A developer reading `text-sm` in any file can again assume one value
  (14px). ADR-054's documented cost ("an admin `text-sm` is not 12px") goes
  away.
- Admin density changes: controls grow from 32px to 40px and cells gain
  padding. The compact table density keeps list screens dense on purpose.
- Contrast on the shipped defaults tightens: the input border now clears 3:1
  on both background and muted surfaces in light mode (the reference's is
  1.23:1).
- ADR-018 rule 5 (raw `--primary` for fills and large shapes only) is
  **still load-bearing**. `#C28D5A` on white is 2.89:1, better than
  `#E8B98C`'s 1.79:1 but still under both floors.
- ADR-003 (derived hover) holds. The reference's `hover:bg-primary/90` maps
  to the derived `--primary-hover`.

## Alternatives considered

- **Copy the reference exactly, including white-on-bronze and the 1.23:1
  input border.** Rejected by §1. Both fail rules this repo enforces, and
  the owner chose accessibility explicitly.
- **Keep `#E8B98C`.** Rejected by the owner. The reference is the newer,
  more specific brief.
- **Keep ADR-054's split, with reference values for the admin only.**
  Rejected: two scales contradict "one design system", and the reason for the
  split (Outfit illegible at 11px in a dense admin) disappears with Inter and
  a 10px floor.
- **Swap to Radix to match the reference's internals.** Rejected: a rewrite
  of every primitive for zero visual difference.
- **Hardcode the palette in `globals.css`.** Rejected by §2: it would sever
  the admin-editable theme, which the owner restated as a constraint.

## Compliance

- `pnpm governance:check`: this ADR lands before the Phase 2 code. ADR-039 and
  ADR-054 change only their Status and Superseded-by header lines.
- `@repo/theme` tests pin the following:
  - the new defaults
  - label ink on bronze is dark and ≥ 4.5:1
  - the input border ≥ 3:1 on background (and on muted, light mode)
  - `--ring` derives from primary
  - the random-palette property contract (unchanged)
  - the default font emits `var(--font-inter)`
  - the seed JSON mirror equals the exported defaults
- `@repo/ui` `type-scale.test.ts` is rewritten for the single scale:
  - every `--text-*` step is `var(--type-*)`
  - no `--ui-*` anywhere
  - the scale is strictly monotonic
  - no step is below 10px
  - `3xs`/`2xs`/`nav` exist
- `apps/web`: no root layout carries a type-scale class.
- The DEVLOG entry records test results per phase (testing.md #6).
