# Design tokens — changes-20 (UI redesign), Phase 1

**Status:** APPROVED 2026-09-11, recorded in **ADR-072**. The owner's
decisions are in §9, and where they differ from the draft's recommendations
the tables below already carry the decided value. Specs marked
**provisional — shadcn defaults** wait on the owner's second capture (menu,
dialog, form controls, toast open). They are updated here **before** those
components are restyled in Phase 3.
**Date:** 2026-09-11
**Source:** `docs/changes/changes-20-Ui.md`, which contains inspected CSS, computed
styles and full-body HTML for four reference pages (admin sign-in, Users
Directory, System Announcements, Admin Dashboard), plus `image-28.png`.
**Governs:** Phases 2–6 of changes-20. Any value that changes after approval
changes here first.

---

## 0. What the reference actually is

The capture was analysed mechanically: every `class` attribute was tallied
(about 2,000 elements), and each page's DOM was outlined. Findings:

| Fact                                                                                                                 | Evidence                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shadcn/ui `default` style** (Tailwind v3, Radix) — "new-york" in the first draft; corrected by capture 2 (ADR-074) | `hsl(var(--x))` colour vars; `ring-offset-background`, `data-[state=…]` and `radix-_r_` ids                                                                      |
| Font is **Inter** (variable, 100–900), loaded via `next/font`                                                        | `.inter_…__className`, "Rendered Fonts: Inter / Inter-Bold"                                                                                                      |
| Icons are **lucide**, all at `stroke-width="2"`                                                                      | all 405 `<svg>` elements have class `lucide lucide-*`                                                                                                            |
| Palette = stock shadcn **slate** neutrals + a **brand override** on `<html style>`                                   | `:root` block (slate) and an inline style (`--primary: 29 46% 56%` …)                                                                                            |
| The brand override comes from an admin theme                                                                         | SSR payload `"colors":{"primary":"#C28D5A","secondary":"#2A2A29","success":"#3382E2","error":"#E23C36","warning":"#FFA310","info":"#004284","accent":"#EAE5DE"}` |
| **No dark palette was captured**                                                                                     | the `.dark` selector never appears; `html.light`, plus `dark:` utilities in the markup                                                                           |
| It is an **admin CRM**; there are no public/marketing pages in the capture                                           | the four pages above                                                                                                                                             |

**What we take:** dimensions, type, colour roles, radius, shadow, icon
conventions and layout rhythm.
**What we do not take:** Radix. We stay on Base UI (the shadcn `base-nova`
style), because the anatomy is portable and the primitive library is not the
look. We also do not take the reference's logos, text, images or brand assets
(task constraint 8).

**Our starting point is closer than it looks.** `DEFAULT_BRAND` in
`@repo/theme` already _is_ this brand palette: six of seven colours match.
Primary differs because changes-03 moved it. Success and error differ because
ours are the AA-safe siblings of the reference values (see §1.1). The real
gaps are elsewhere:

- neutral surfaces (warm grays vs slate)
- typeface (Outfit vs Inter)
- type scale
- control heights (our buttons are 32px, the reference's 40px)
- radius and elevation (our cards use rings, the reference's use borders)

---

## 1. Colour

All colour values below are **defaults** for the existing admin-editable theme
(`BrandColors`, `SurfacePalette` ×2, `BrandOverrides`). Hex literals live only
in `@repo/theme` (code-style #1), components consume semantic tokens only, and
admin theming keeps working unchanged (task constraint 2).

### 1.1 Brand (7 admin-editable swatches) — `DEFAULT_BRAND`

| Theme field | Reference (hex) | Today     | **Proposed**       | Notes                                                                          |
| ----------- | --------------- | --------- | ------------------ | ------------------------------------------------------------------------------ |
| `primary`   | `#C28D5A`       | `#E8B98C` | **`#C28D5A`** ⚠ Q1 | changes-03 pinned `#E8B98C`, and the reference contradicts it                  |
| `secondary` | `#2A2A29`       | `#2A2A29` | `#2A2A29`          | no change                                                                      |
| `success`   | `#3382E2`       | `#2D72C7` | **`#2D72C7`** ⚠ Q2 | white label: `#3382E2` 3.87:1 ✗, `#2D72C7` 4.84:1 ✓                            |
| `error`     | `#E23C36`       | `#D93A34` | **`#D93A34`** ⚠ Q2 | white label: 4.26:1 ✗ vs 4.56:1 ✓                                              |
| `warning`   | `#FFA310`       | `#FFA310` | `#FFA310`          | no change                                                                      |
| `info`      | `#004284`       | `#004284` | `#004284`          | no change                                                                      |
| `accent`    | `#EAE5DE`       | `#EAE5DE` | `#EAE5DE`          | no change. The warm beige of hover and active nav is the reference's signature |

Blue "success" is the brand's own choice (the reference's stock `:root` has a
green success that its brand override replaces). We keep it.

### 1.2 Surfaces, light — `DEFAULT_LIGHT_SURFACE`

The reference uses stock shadcn slate. Mapped onto our eight fields:

| Theme field → CSS var                  | Reference            | Today     | **Proposed**       | Contrast                                                                                                                                                                                                            |
| -------------------------------------- | -------------------- | --------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background` → `--background`          | `#FFFFFF`            | `#FFFFFF` | `#FFFFFF`          | —                                                                                                                                                                                                                   |
| `surface` → `--card`, `--popover`      | `#FFFFFF`            | `#FFFFFF` | `#FFFFFF`          | —                                                                                                                                                                                                                   |
| `surfaceMuted` → `--muted`             | `#F1F5F9`            | `#F8F8F8` | **`#F1F5F9`**      | —                                                                                                                                                                                                                   |
| `textPrimary` → `--foreground`         | `#020817`            | `#1A1A1A` | **`#020817`**      | 20.0:1                                                                                                                                                                                                              |
| `textSecondary` → `--muted-foreground` | `#64748B`            | `#666666` | **`#64748B`**      | 4.76:1 on white, 4.34:1 on muted                                                                                                                                                                                    |
| `textMuted` → `--text-muted`           | — (not in ref)       | `#999999` | **`#94A3B8`**      | decorative only (placeholder art, disabled glyphs). Never body text                                                                                                                                                 |
| `borderLight` → `--border`             | `#E2E8F0`            | `#E5E5E5` | **`#E2E8F0`**      | 1.23:1 (dividers; no contrast requirement)                                                                                                                                                                          |
| `borderMedium` → `--input`             | `#E2E8F0` (= border) | `#8F8F8F` | **`#7F8FA5`** (Q4) | 3.29:1 on background, 3.01:1 on muted. The reference's 1.23:1 is rejected (ADR-072 §1). No named slate step lands near 3:1 (400 = 2.56, 500 = 4.76), so this sits on the slate ramp, 43% of the way from 400 to 500 |

`--card-foreground`, `--popover-foreground` and `--accent-foreground` all
resolve to `--foreground` (`#020817`), which is what the reference does.

### 1.3 Surfaces, dark (derived) — `DEFAULT_DARK_SURFACE` ⚠ Q5

The reference has user-controlled dark mode but its palette was not captured.
The principled derivation is **shadcn slate dark**, the canonical partner of
the slate-light values in §1.2:

| Theme field     | Today (warm) | **Proposed (slate)**                                       | Contrast on bg |
| --------------- | ------------ | ---------------------------------------------------------- | -------------- |
| `background`    | `#141413`    | `#020817`                                                  | —              |
| `surface`       | `#1C1C1A`    | `#020817` (cards separate by border, as in shadcn)         | —              |
| `surfaceMuted`  | `#252523`    | `#1E293B`                                                  | —              |
| `textPrimary`   | `#F5F4F2`    | `#F8FAFC`                                                  | 19.1:1         |
| `textSecondary` | `#A8A6A2`    | `#94A3B8`                                                  | 7.8:1          |
| `textMuted`     | `#78766F`    | `#64748B`                                                  | decorative     |
| `borderLight`   | `#2E2E2B`    | `#1E293B`                                                  | 1.37:1         |
| `borderMedium`  | `#6B6B67`    | **`#4F5E73`** (slate ramp, 28% of the way from 600 to 500) | 3.03:1         |

**`DEFAULT_DARK_BRAND_OVERRIDES`** (the escape hatch for swatches that break
in dark mode):

| Field       | Today     | **Proposed**  | Why                                                                                                                                                  |
| ----------- | --------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accent`    | `#332E27` | **`#1E293B`** | The reference's markup says it directly: active nav is `dark:bg-muted dark:text-foreground`, and hover is `dark:hover:bg-muted`. Dark accent = muted |
| `secondary` | `#E8E6E3` | `#E8E6E3`     | unchanged. `#2A2A29` is 1.37:1 on a dark background and disappears                                                                                   |

### 1.4 Derived tokens (engine-owned, ADR-003; never admin-editable)

These are computed by `tokensToCss`. Values shown are for the proposed palette
(`primary #C28D5A`), light / dark:

| Token                       | Rule                                                                                | Light                                                                         | Dark      |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------- |
| `--primary-foreground`      | `readableOn(primary)`                                                               | **`#1A1A1A`** (6.01:1). The reference paints `#F8FAFC` at **2.77:1** — see Q1 | `#1A1A1A` |
| `--primary-interactive`     | `deriveTonalInk(primary, bg)` → 4.5:1 on page **and** on its own 15% tint (ADR-073) | `#84603D`                                                                     | `#C28D5A` |
| `--primary-hover`           | `shade(primary, −14%)`                                                              | `#A7794E`                                                                     | same      |
| `--primary-active`          | `shade(primary, −26%)`                                                              | derived                                                                       | derived   |
| `--primary-subtle`          | `shade(primary, +85%)`                                                              | `#F6EEE6`                                                                     | derived   |
| `--success-interactive`     | tint-aware 4.5:1 (ADR-073)                                                          | `#2969B7`                                                                     | `#4683CE` |
| `--destructive-interactive` | tint-aware 4.5:1 (ADR-073)                                                          | `#BF332E`                                                                     | `#DE524C` |
| `--warning-interactive`     | tint-aware 4.5:1 (ADR-073)                                                          | `#99620A`                                                                     | `#FFA310` |
| `--info-interactive`        | tint-aware 4.5:1 (ADR-073)                                                          | `#004284`                                                                     | `#5C86B0` |
| `--warning-foreground`      | `readableOn(warning)`                                                               | `#1A1A1A` (8.7:1). The reference paints white at 1.91:1                       | same      |
| **`--ring`** ⚠ Q8           | today: `deriveInteractive(success, bg, 3)` (blue)                                   | **proposed: `deriveInteractive(primary, bg, 3)` = `#BA8756`**                 | `#C28D5A` |

The ring change is an **engine change**, so it needs an ADR. The reference's
focus ring _is_ the primary (`--ring: 29 46% 56%`), and a bronze ring on
bronze-accented UI is part of its look.

### 1.5 State recipes — how the reference's states map onto our tokens

The reference expresses hover as an opacity (`hover:bg-primary/90`). ADR-003
says hover is **derived by the engine**, so opacity recipes on brand fills map
to derived tokens. Opacity on _neutral_ surfaces (`bg-muted/50`) is kept as
written: it is a tint of a token, not a colour literal.

| State                      | Reference                                                                         | **Our recipe**                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Primary fill hover         | `hover:bg-primary/90`                                                             | `hover:bg-primary-hover` (derived)                                                                                           |
| Secondary fill hover       | `hover:bg-secondary/80`                                                           | `hover:bg-secondary/80`                                                                                                      |
| Destructive fill hover     | `hover:bg-destructive/90`                                                         | `hover:bg-destructive/90`                                                                                                    |
| Outline / ghost hover      | `hover:bg-accent hover:text-accent-foreground`                                    | same. **Today we use `bg-muted`; this changes to beige accent**                                                              |
| Nav item hover             | `hover:bg-accent` (dark: `hover:bg-muted`)                                        | `hover:bg-accent` (dark handled by the accent override in §1.3, so there is no `dark:` class)                                |
| Nav item active            | `bg-accent text-accent-foreground`                                                | same                                                                                                                         |
| Menu / select item focus   | `focus:bg-accent` (inferred, Q12)                                                 | same                                                                                                                         |
| Table row hover            | `hover:bg-muted/50`                                                               | same                                                                                                                         |
| Table row selected         | `data-[state=selected]:bg-muted`                                                  | `data-selected:bg-muted`                                                                                                     |
| Pinned / highlighted row   | `bg-primary/5`                                                                    | same                                                                                                                         |
| Focus (every control)      | `ring-2 ring-ring ring-offset-2 ring-offset-background`, no outline               | same. **Today components use `ring-3 ring-ring/50` + `border-ring`; this becomes the reference's 2px ring with 2px offset**  |
| Disabled                   | `disabled:opacity-50 disabled:pointer-events-none` (inputs: `cursor-not-allowed`) | same                                                                                                                         |
| Invalid                    | (not captured)                                                                    | keep ours: `aria-invalid:border-destructive aria-invalid:ring-destructive/20`                                                |
| Status tint (badge / tile) | `bg-{status}/10 text-{status} border-{status}/20`                                 | `bg-{status}/10 text-{status}-interactive border-{status}/20`. The `-interactive` ink is what makes 10px status text legible |
| Scrollbar                  | 8px; thumb `muted-foreground/30`, pill; track `muted/30`                          | same, in `@repo/ui` base layer                                                                                               |

### 1.6 Charts

The reference declares shadcn's default `--chart-1…5` but none of the captured
pages use them (its bar charts use `bg-success` / `bg-destructive`). **Decided
without asking:** we do not adopt the shadcn chart ramp. Series colours derive
from brand and status tokens when a chart needs them (dataviz, later module).

---

## 2. Typography

### 2.1 Family ⚠ Q6

| Role                               | Family                                                    | Notes                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sans (everything)                  | **Inter** variable, 100–900, `display: swap`, self-hosted | already a curated key (`inter`, `@fontsource-variable/inter` 5.3.0). Becomes `DEFAULT_LAYOUT.fontSans` and takes over `preload: true` from Outfit |
| Mono (IDs, account numbers, codes) | `systemmono` (unchanged)                                  | the reference uses Tailwind's default `ui-monospace` stack for `font-mono`, which is the same idea                                                |

This **supersedes ADR-039** (Outfit as brand typeface). Outfit stays a
selectable curated key, so this does not delete anything.

**Weights in use:** 400 (inputs, body), **500** (the default for controls:
494 of about 2,000 class strings), 600 (badges, card titles, table headers in
dense lists), 700 (page titles, stat values).

### 2.2 Scale ⚠ Q7

The reference is Tailwind's **default** scale, plus four arbitrary sizes
(`text-[9px]` ×71, `text-[10px]` ×186, `text-[11px]` ×135, `text-[13px]` ×85,
the last one the sidebar item only). Task constraint 5 bans arbitrary values,
so each one becomes a **named step**:

| Utility                      | Size / line-height | Replaces in ref                    | Used for                                                                                            |
| ---------------------------- | ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `text-3xs` _(new)_           | **10px / 14px**    | `text-[10px]` **and** `text-[9px]` | count pills, compact badges, kbd hints, table sub-lines, dock labels                                |
| `text-2xs` _(new)_           | **11px / 16px**    | `text-[11px]`                      | compact table cells and headers, stat detail line                                                   |
| `text-xs`                    | 12px / 16px        | `text-xs`                          | helper text, filter controls, small badges, meta                                                    |
| `text-nav` _(new, semantic)_ | **13px / 20px**    | `text-[13px]`                      | sidebar nav items (its only consumer)                                                               |
| `text-sm`                    | 14px / 20px        | `text-sm`                          | **the control default**: buttons, inputs (≥ md), labels, table cells, menu items, card descriptions |
| `text-base`                  | 16px / 24px        | `text-base`                        | page description, body, mobile input text (prevents iOS zoom)                                       |
| `text-lg`                    | 18px / 28px        | —                                  | dialog title                                                                                        |
| `text-xl`                    | 20px / 28px        | —                                  | —                                                                                                   |
| `text-2xl`                   | 24px / 32px        | `text-2xl`                         | stat value, card title, compact page title, auth title                                              |
| `text-3xl`                   | 30px / 36px        | `text-3xl`                         | **page title**                                                                                      |
| `text-4xl`                   | 36px / 40px        | —                                  | —                                                                                                   |
| `text-5xl`                   | 48px / 1           | —                                  | —                                                                                                   |

- **9px is not carried over.** It is below any legibility floor, and the one
  place it appears (status badges) sits on a 10% tint. Folded into 10px (Q7).
- Public display type (`--text-display-sm/md/lg`, ADR-018) is **unchanged**.
  It is fluid, public-only and has no reference counterpart.
- `--brand-base-font-size` default: **14px → 16px** (the reference's `<body>`
  inherits 16px; an unsized `<p class="text-muted-foreground">` computes to 16/24).
- Letter-spacing: `tracking-tight` (−0.025em) on page, card and stat titles
  (computed: −0.75px at 30px, −0.35px at 14px). `tracking-wider` only on the
  uppercase micro-header.
- Numbers: `tabular-nums` on every amount, count and pagination figure.

### 2.3 Semantic typography components (task constraint 7)

These replace repeated utility strings. Each is one component in `@repo/ui`:

| Component                    | Recipe                                                                                                                                   | Reference instance                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `PageTitle`                  | `text-3xl font-bold tracking-tight` · `size="compact"`: `text-2xl` + leading icon `size-6`, `gap-2`                                      | "Users Directory", "System Announcements"             |
| `PageDescription`            | `text-base text-muted-foreground` (compact: `text-sm`)                                                                                   | "Comprehensive overview of…"                          |
| `SectionTitle` (card title)  | `text-2xl font-semibold leading-none tracking-tight` · `size="sm"`: `text-base font-bold` + icon `size-4 text-muted-foreground`, `gap-2` | "Live Activity Feed" / "Deposit vs Withdrawal Trends" |
| `SubText` (card description) | `text-sm text-muted-foreground`                                                                                                          | card descriptions                                     |
| `StatLabel`                  | `text-sm font-medium tracking-tight text-muted-foreground`                                                                               | "Total Users"                                         |
| `StatValue`                  | `text-2xl font-bold` (+ unit `text-sm font-medium text-muted-foreground ms-1`)                                                           | "42.9K lots"                                          |
| `MetaText`                   | `text-xs text-muted-foreground` · `size="2xs"`                                                                                           | "new · Last month"                                    |
| `MicroHeading`               | `text-3xs font-semibold uppercase tracking-wider text-muted-foreground`                                                                  | sticky activity-table header                          |
| `Label` (exists)             | `text-sm font-medium leading-none`                                                                                                       | form labels                                           |

The existing `SectionHeading` (public, ADR-018) keeps its role on public
sections. Its type inherits the new scale.

---

## 3. Spacing and layout rhythm

The base is Tailwind's 4px spacing scale, unchanged. **Tailwind v4 spacing is
multiplier-based**, so every fixed width the reference hand-wrote as
`w-[150px]` is a _scale_ value here: `w-37.5` (150), `w-27.5` (110), `w-30`
(120), `w-45` (180), `w-50` (200), `min-w-60` (240), `w-70` (280), `w-75`
(300), `max-w-105` (420). Constraint 5 is satisfiable without new tokens.

### 3.1 App shell (admin)

| Region              | Spec                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sidebar             | fixed, **`w-64` (256px)** (today `--width-sidebar` is 240px), `border-e bg-background`, collapse via `transition-[transform,width] duration-200 ease-in-out` |
| Sidebar logo band   | `min-h-16 px-4 border-b`, logo box `h-12`                                                                                                                    |
| Sidebar scroll area | `px-3 py-2`, item stack `space-y-1 pb-4`                                                                                                                     |
| Sidebar footer      | `p-4 border-t`: user name `text-sm font-medium`, role `text-xs text-muted-foreground`, Sign out = outline button `h-9 w-full`                                |
| Top bar             | **`h-16`** (unchanged), `sticky top-0 z-30 bg-background border-b px-2 sm:px-4`, clusters `gap-1 sm:gap-2 md:gap-3/4`                                        |
| Main                | **`p-4 md:p-6 lg:p-8`** (+ `pb-24` below `md` for the dock)                                                                                                  |
| Page stack          | `space-y-6` between blocks, `space-y-4` inside a block                                                                                                       |
| Stat grid           | `grid gap-4 md:grid-cols-2 lg:grid-cols-4`                                                                                                                   |
| Content grid        | `grid gap-6 lg:grid-cols-2` / `lg:grid-cols-3` (+ `lg:col-span-2`)                                                                                           |
| Mobile dock         | `md:hidden fixed inset-x-0 bottom-0 px-3 pb-safe`, bar `max-w-md mx-auto rounded-full border border-border/60 bg-card p-1.5 shadow-dock`                     |

### 3.2 Components

| Context               | Spacing                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Card                  | header `p-6` + `space-y-1.5`; content `p-6 pt-0`; stat card header `pb-2`; chart card header `pb-3`; table-in-card content `p-0` |
| Inset panel in a card | `rounded-lg border p-3`                                                                                                          |
| Form                  | fields `space-y-4`; label → control `space-y-2`                                                                                  |
| Filter toolbar        | row `flex flex-wrap gap-2`; next row `mt-2`; view-chip row `mt-4`; table card `mt-4`. Compact (inside a card): `gap-1.5 mb-3`    |
| Page header           | `flex flex-wrap items-start justify-between gap-3`; actions `flex gap-2`                                                         |
| Pagination footer     | `px-4 py-3 border-t`, `gap-4` between summary and controls, controls `gap-2`, page list `gap-1`                                  |
| Icon + label          | `gap-2` at h-10, `gap-1.5` at h-8/h-9 (never `me-2` on the icon; the reference's legacy `mr-2` becomes `gap`)                    |
| Auth card             | `max-w-md`, header `p-6 pb-2 text-center`, logo `mb-4`                                                                           |

Layout constants in `@theme`: `--height-header: 64px` (unchanged), **`--height-input: 40px`** (was 36),
**`--width-sidebar: 256px`** (was 240).

---

## 4. Radius, shadow, borders

### 4.1 Radius

The reference uses `--radius: .5rem` with shadcn's mapping (lg = r, md = r−2,
sm = r−4). Ours derives from one admin-set base with sm = r−2, md = r,
lg = r+2. Setting **`DEFAULT_LAYOUT.radiusBase` 4px → 6px** reproduces the
reference exactly, with one formula change for `xl`:

| Token          | Formula               | Value   | Reference | Used by                                                                                                    |
| -------------- | --------------------- | ------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `rounded-sm`   | r − 2                 | 4px     | 4px       | tab trigger, kbd, menu item, copy button                                                                   |
| `rounded-md`   | r                     | **6px** | 6px       | **button, input, select, textarea, table wrapper, tooltip, popover/menu content, tabs list, date trigger** |
| `rounded-lg`   | r + 2                 | 8px     | 8px       | **card, dialog, sheet corners, inset panel, header search trigger**                                        |
| `rounded-xl`   | r + **6** (was r + 4) | 12px    | 12px      | avatar tile (initials square)                                                                              |
| `rounded-full` | —                     | pill    | pill      | badge, count pill, view chip, avatar, progress, dock, live dot                                             |

Today cards and dialogs are `rounded-xl`, buttons `rounded-lg`. Both drop one
step.

### 4.2 Shadows (Tailwind v3 values, which is what the reference renders)

| Token                 | Value                                                              | Used by                                                     |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `shadow-sm`           | `0 1px 2px 0 rgb(0 0 0 / .05)`                                     | **card at rest**, active tab                                |
| `shadow-md`           | `0 4px 6px -1px rgb(0 0 0 / .1), 0 2px 4px -2px rgb(0 0 0 / .1)`   | dropdown, select, popover, tooltip, card hover, auth submit |
| `shadow-lg`           | `0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1)` | dialog, sheet, toast                                        |
| `shadow-2xl`          | `0 25px 50px -12px rgb(0 0 0 / .25)`                               | auth card                                                   |
| `shadow-dock` _(new)_ | `0 6px 24px -8px rgb(0 0 0 / .25)`                                 | mobile dock (the reference's one arbitrary shadow)          |

Today `shadow-md` lacks the second layer and `sm` lacks the spread term; both
are redefined. The public tiers `shadow-card`, `shadow-card-hover` and
`shadow-float` are unchanged.

### 4.3 Borders

- One weight: **1px**. The capture's computed 0.8px is 1px at 125% zoom.
- Default colour `--border` on every element (base layer, already ours).
- **Cards are drawn by a border plus `shadow-sm`, not a ring.** Today:
  `ring-1 ring-foreground/10`. That changes, along with `.card-hover`, which
  becomes `hover:shadow-md` plus a border lift.
- Inputs, selects and outline buttons use `border-input` (Q4 decides its value).
- Tables: wrapper `rounded-md border` (or the card's border); rows `border-b`,
  and the last row has none.
- Sections within a panel use `border-t` / `border-b` dividers, not gaps.

---

## 5. Icons

- **Library: lucide-react**, which is already the only icon library in the
  repo (verified: 0 imports of any other icon package across `apps/**` and
  `packages/**`; `components.json` → `"iconLibrary": "lucide"`). Nothing to
  migrate. Constraint 6 holds today and becomes lint-enforced in Phase 6.
- **Stroke width: 2**, everywhere. The reference's one exception (`1.75` in the
  mobile dock) is dropped for uniformity (decided without asking).
- Colour: `currentColor`. Decorative leading icons get `text-muted-foreground`;
  dropdown chevrons get `opacity-50`; semantic glyphs use a status colour
  (`text-success`, `text-warning`, `text-primary`).

| Size       | px  | Where                                                                                                                       |
| ---------- | --- | --------------------------------------------------------------------------------------------------------------------------- |
| `size-2.5` | 10  | stepper chevrons in a reorder cell                                                                                          |
| `size-3`   | 12  | inline trend/meta glyphs inside `text-xs` (trending-up, clock), icon in a badge                                             |
| `size-3.5` | 14  | **compact controls** (h-8/h-9): view chips, filter triggers, row actions in dense tables, copy buttons, card-header refresh |
| `size-4`   | 16  | **default**: buttons at h-10, nav items, menu items, input leading icon, select chevron, pagination, table row action       |
| `size-5`   | 20  | top-bar icon buttons (theme, docs, bell), sheet/dialog close on mobile, dock                                                |
| `size-6`   | 24  | compact `PageTitle` icon                                                                                                    |

Buttons already size child SVGs by default (`[&_svg:not([class*='size-'])]`).
That default becomes `size-4` at h-10/h-9 and `size-3.5` at h-8 and below.

---

## 6. Component anatomy

**Confirmed 2026-09-11 (ADR-074).** Rows marked **(inferred)**, and all of
§6.4, §6.5 and the checkbox/radio/switch rows of §6.7, were provisional. They
are now **superseded by §6.14**, the second capture (`capture-2.md`). That
capture proved the reference is shadcn/ui's **`default`** style, not
"new-york" as first written, and took the unseen components from that
registry. Where §6.14 and an earlier row disagree, §6.14 wins.

**Accessibility overrides visual copying** (ADR-072 §1). Wherever a
reference pairing fails our contrast rules, the spec below already carries the
accessible variant closest to the reference look.

**Build status (Phase 3):**

- **Group 1 (primitives), built 2026-09-11:**
  - Button, including `size="2xs"`/`"icon-2xs"`, `icon-lg` = `size-11`, and
    an `emphasis` prop
  - Input (`size` default/sm/xs)
  - `SearchInput` (new)
  - Select and Combobox **triggers**, via a shared `selectTriggerVariants`
  - Badge (`size`, `outline-*` variants, `live` prop; `destructive` is solid,
    the tonal status is `danger`)
  - `CountBadge` (new)
  - Avatar (`shape="square"`)
- **Group 1 completion and group 2 (overlays)**, unblocked by capture 2:
  - Checkbox, Switch, RadioGroup (new), Textarea, Tooltip (new)
  - the Select and Combobox popups and items
  - DropdownMenu, Popover (new), Dialog, AlertDialog, Sheet, Command, Toast
    (Sonner)
  - All per §6.14.
- Tonal ink follows **ADR-073**: every `*-interactive` holds 4.5:1 on its own
  tint up to /15.

### 6.1 Button

Base: `inline-flex items-center justify-center gap-2 whitespace-nowrap
rounded-md text-sm font-medium transition-colors` + the focus and disabled
recipes (§1.5).

| Size          | Spec                                                            | Reference use                                   | Today      |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| `default`     | **h-10 px-4 py-2**, icon 16                                     | primary page actions, auth submit               | h-8 px-2.5 |
| `sm`          | **h-9 px-3**                                                    | top-bar, pagination prev/next, sidebar Sign out | h-7        |
| `xs`          | **h-8 px-3 text-xs**, icon 14                                   | card-header controls                            | h-6        |
| `2xs` _(new)_ | **h-7 px-2 text-xs**                                            | small inline actions                            | —          |
| `lg`          | h-11 px-8 (inferred)                                            | —                                               | h-9        |
| `xl` (public) | **h-12 px-6 text-base**, icon 20 (ADR-018; one step above `lg`) | hero/CTA bands                                  | h-11       |
| `icon`        | **size-10**                                                     | pagination page, avatar trigger                 | size-8     |
| `icon-sm`     | **size-9**                                                      | refresh beside a filter                         | size-7     |
| `icon-xs`     | **size-8**                                                      | row action (default table), sidebar collapse    | size-6     |
| `icon-2xs`    | **size-6**, icon 14                                             | row action (dense table)                        | —          |

| Variant                        | Spec                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `default`                      | `bg-primary text-primary-foreground hover:bg-primary-hover`                                         |
| `secondary`                    | `bg-secondary text-secondary-foreground hover:bg-secondary/80`                                      |
| `outline`                      | `border border-input bg-background hover:bg-accent hover:text-accent-foreground`                    |
| `ghost`                        | `hover:bg-accent hover:text-accent-foreground`                                                      |
| `destructive` ⚠ Q9             | **solid**: `bg-destructive text-destructive-foreground hover:bg-destructive/90` (today: tinted 10%) |
| `success` / `warning` / `info` | kept from ADR-046 (tinted intents). There is no reference counterpart; they are an extension        |
| `link`                         | `text-primary-interactive underline-offset-4 hover:underline`                                       |
| `shape="pill"`                 | kept (public, ADR-018)                                                                              |

Auth submit adds `shadow-md ring-1 ring-primary/40 hover:ring-primary/60`
(an `emphasis` prop, not a one-off class).

### 6.2 Input, Textarea, Search

| Part                          | Spec                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Input `default`               | **h-10** w-full rounded-md border border-input bg-background px-3 py-2 **text-base md:text-sm**, `placeholder:text-muted-foreground`, file-input reset |
| Input `sm`                    | **h-9** (toolbar search)                                                                                                                               |
| Input `xs`                    | **h-8 text-xs** (in-card compact search)                                                                                                               |
| Leading icon                  | absolute `start-3` (default) / `start-2.5` (sm) / `start-2` (xs), icon 16 / 16 / 14, `text-muted-foreground`; input `ps-10` / `ps-8` / `ps-7`          |
| Trailing action               | ghost button `absolute end-0 inset-y-0 px-3 hover:bg-transparent` (password eye); input `pe-10`                                                        |
| Textarea                      | min-h-20, same padding, border and focus recipe as Input (inferred)                                                                                    |
| **SearchInput** _(component)_ | Input + leading `search` icon, one component in three sizes                                                                                            |
| **Global search trigger**     | `flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground hover:bg-muted/70`, label `text-xs`, kbd hint; width `w-50 lg:w-75`       |
| Kbd                           | `rounded-sm border bg-background px-1.5 py-0.5 text-3xs font-medium`                                                                                   |

### 6.3 Select, Combobox, date trigger (the dropdown family)

| Part                   | Spec                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger                | identical box to Input: `flex items-center justify-between rounded-md border border-input bg-background px-3 py-2`, value `truncate`                                                      |
| Sizes                  | `default` h-10 text-sm · `sm` **h-9 text-xs** (toolbar filters) · `xs` h-8 text-xs (in-card)                                                                                              |
| Select indicator       | `chevron-down` size-4 `opacity-50`                                                                                                                                                        |
| **Combobox indicator** | **`chevrons-up-down`** size-3.5 `opacity-50`. The reference uses it for its searchable pickers (Country), which is exactly our ADR-057 split, so the icon tells the user which kind it is |
| Placeholder            | `text-muted-foreground font-normal`                                                                                                                                                       |
| Date trigger           | outline Button `h-9 justify-start px-2 text-xs font-normal text-muted-foreground`, `calendar` size-4                                                                                      |
| Content (inferred)     | `min-w-(--anchor-width) rounded-md border bg-popover text-popover-foreground shadow-md p-1`                                                                                               |
| Item (inferred)        | `rounded-sm py-1.5 ps-2 pe-8 text-sm`, `focus:bg-accent focus:text-accent-foreground`, check indicator at `end-2` size-4                                                                  |
| Toolbar-filter width   | stays an explicit width class (ADR-057). Reference widths: `w-37.5`, `w-27.5`, `w-30`; filter rows use `flex-1 min-w-37.5`                                                                |

### 6.4 DropdownMenu, Popover, Tooltip (inferred unless noted)

| Part         | Spec                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Menu content | `min-w-32 rounded-md border bg-popover p-1 shadow-md` (today `rounded-lg ring-1 shadow-lg`)                                            |
| Menu item    | `gap-2 rounded-sm px-2 py-1.5 text-sm focus:bg-accent`, icon 16                                                                        |
| Menu label   | `px-2 py-1.5 text-sm font-semibold`                                                                                                    |
| Separator    | `-mx-1 my-1 h-px bg-muted`                                                                                                             |
| Shortcut     | `ms-auto text-xs tracking-widest opacity-60`                                                                                           |
| Popover      | `w-72 rounded-md border bg-popover p-4 shadow-md`                                                                                      |
| Tooltip      | `rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md`. The **observed** chart tooltip is the compact form: `px-2 py-1 text-3xs` |

### 6.5 Dialog, Sheet, Toast (inferred)

| Part                 | Spec                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog               | `max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-lg` (today `rounded-xl p-4 ring-1 sm:max-w-sm`)                                                                                           |
| Dialog header        | `space-y-1.5 text-center sm:text-start`; title `text-lg font-semibold leading-none tracking-tight`; description `text-sm text-muted-foreground` (ADR-057 #5's title + description rule is unchanged) |
| Dialog footer        | `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`                                                                                                                                             |
| Close                | `absolute top-4 end-4 rounded-sm opacity-70 hover:opacity-100`, `x` size-4                                                                                                                           |
| Overlay              | shadcn v3 is `bg-black/80`; ours is `--color-overlay` at 10% ⚠ Q12                                                                                                                                   |
| Sheet                | side panel `w-3/4 sm:max-w-sm gap-4 border bg-background p-6 shadow-lg`                                                                                                                              |
| Toast (Sonner, kept) | viewport `bottom-end`, `max-w-105`; toast `rounded-md border bg-background p-4 text-sm shadow-lg`. The reference runs both Radix Toast and Sonner; we keep one                                       |

### 6.6 Badge and count pill

Base: `inline-flex items-center rounded-full border font-semibold transition-colors`.

| Size      | Spec                               | Reference                                     |
| --------- | ---------------------------------- | --------------------------------------------- |
| `default` | `px-2.5 py-0.5 text-xs`            | "Market Live", "Net $4.6M"                    |
| `sm`      | `h-5 px-1.5 text-3xs font-medium`  | "Live" beside the page description            |
| `xs`      | `h-4 px-1.5 text-3xs leading-none` | status in dense tables (reference 9px → 10px) |

| Variant                                              | Spec                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`                                            | `border-transparent bg-primary text-primary-foreground`                                                                                                                                                                |
| `secondary`                                          | `border-transparent bg-secondary text-secondary-foreground`. The screenshot's dark "N/A" / "PK" country pills                                                                                                          |
| `outline`                                            | `text-foreground`                                                                                                                                                                                                      |
| `destructive`                                        | `border-transparent bg-destructive text-destructive-foreground`                                                                                                                                                        |
| `success` / `warning` / `info` / `danger` (tonal)    | `bg-{s}/10 text-{s}-interactive border-{s}/20`. Tonal surfaces rest at /10 and never exceed /15 — the tint the ink is contracted against (ADR-073)                                                                     |
| `outline-success` / `-warning` / `-info` / `-danger` | `border-{s}-interactive text-{s}-interactive` — the LINE is the -interactive value too (raw warning is 2:1 as a border). Pulsing **live dot** via the `live` prop (`bg-current`, `size-2` default / `size-1.5` sm, xs) |
| `eyebrow`, `pill` (public)                           | kept                                                                                                                                                                                                                   |

**Count pill** (a nav-badge component, not a badge variant):
`rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 text-3xs
min-w-5 text-center tabular-nums`. The top-bar bell variant is `absolute
-top-1.5 -end-1.5 h-4 min-w-4 px-1 font-semibold leading-none`. "99+" and
"999+" capping is display logic in the component.

### 6.7 Avatar, Checkbox, Radio, Switch, Progress

| Part                | Spec                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avatar              | **size-10** rounded-full (today default size-8); fallback **`bg-primary text-primary-foreground text-sm font-semibold`** initials (today `bg-muted`). Sizes: `sm` 8, `lg` 12 |
| Avatar tile         | `size-10 rounded-xl bg-primary text-primary-foreground` (mobile sidebar identity)                                                                                            |
| Checkbox (inferred) | `size-4 rounded-sm border border-primary`, checked `bg-primary text-primary-foreground`, check icon size-4                                                                   |
| Radio (inferred)    | `size-4 rounded-full border border-primary`, dot `size-2.5 fill-current`                                                                                                     |
| Switch (inferred)   | track `h-6 w-11 rounded-full border-2 border-transparent`, checked `bg-primary`, unchecked `bg-input`; thumb `size-5 bg-background shadow-lg`                                |
| Progress            | `h-1` (stat card) / `h-1.5` (list), `rounded-full`, indicator `bg-primary`; **track `bg-muted`** (see Q15)                                                                   |

### 6.8 Tabs and view chips

| Part                            | Spec                                                                                                                                                                                                                                                                                                                                           | Today                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Tabs list                       | `h-10 inline-flex items-center rounded-md bg-muted p-1 text-muted-foreground`; full-width form `w-full justify-start gap-1 overflow-x-auto`                                                                                                                                                                                                    | `h-9 rounded-lg border border-border/60` |
| Tab trigger                     | `rounded-sm px-3 py-1.5 text-sm font-medium`, active `bg-background text-foreground shadow-sm`; mobile `min-h-10`                                                                                                                                                                                                                              | similar                                  |
| `line` variant (ours)           | kept                                                                                                                                                                                                                                                                                                                                           |
| **ViewChips** _(new component)_ | segmented pill row: `flex w-full gap-2 overflow-x-auto` (scrollbar hidden); chip `inline-flex flex-1 min-w-27.5 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground`, icon 14; **selected `bg-primary text-primary-foreground border-primary font-medium`** | —                                        |

### 6.9 Table and DataTable

| Part            | `default` density                                                                                         | `compact` density ⚠ Q10                         |
| --------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Container       | inside a Card (`p-0`) or standalone `rounded-md border`; `overflow-auto`                                  | same                                            |
| `<table>`       | `w-full caption-bottom text-sm`                                                                           | `text-sm` with cell overrides below             |
| Header row      | `border-b`, **no fill** (today `bg-muted/60`)                                                             | same; the dense-list variant adds `bg-muted/50` |
| `th`            | **h-12 px-4 text-start align-middle font-medium text-muted-foreground** (today h-10 px-2 text-foreground) | h-12 **px-2.5 py-2 text-2xs**                   |
| Body row        | `border-b transition-colors hover:bg-muted/50`, selected `bg-muted`, last row borderless                  | same                                            |
| `td`            | **p-4 align-middle** (today p-2)                                                                          | **px-2.5 py-2**, content `text-2xs`             |
| Checkbox column | `[&:has([role=checkbox])]:pe-0`                                                                           | same                                            |
| Sticky header   | `sticky top-0 z-10 bg-muted/95 backdrop-blur` + `MicroHeading` cells                                      | —                                               |

Cell content conventions (these become cell renderers, so no call site
restyles):

| Content                | Recipe                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Primary text           | `font-medium`, `truncate max-w-45`, hover `text-primary-interactive` when it opens a record                      |
| Secondary line         | `text-3xs text-muted-foreground truncate max-w-70`                                                               |
| Identifier             | `font-mono text-2xs` (+ copy button `rounded-sm p-0.5 text-muted-foreground hover:bg-muted`, icon 14)            |
| Amount                 | `font-semibold tabular-nums`, end-aligned where it is a column of figures                                        |
| Date / time            | `text-muted-foreground whitespace-nowrap`                                                                        |
| Status                 | Badge `xs`, tonal                                                                                                |
| Row actions            | ghost `icon-xs` (default) / `icon-2xs` (compact) with `ellipsis` icon, end-aligned column header "Actions"       |
| Pin / star             | `star` size-3.5, pinned `fill-warning text-warning` (the reference uses raw `yellow-400`, which becomes a token) |
| Sort header (inferred) | ghost button `-ms-3 h-8` with `arrow-up-down` size-4. Not visible in the capture; see Q12                        |
| Empty state            | not captured; keep the existing `Empty` component, restyled via tokens (Q12)                                     |

### 6.10 Pagination

`px-4 py-3 border-t` footer, `flex flex-col sm:flex-row items-center
justify-between gap-4`:

- Start: summary `text-sm text-muted-foreground` ("Showing 1 to 15 of N results", from a catalog key).
- End: `flex items-center gap-2`:
  - First and last (`chevrons-left`/`-right`): outline `sm`, `hidden sm:flex`.
  - Prev and next: outline `sm` with label `hidden sm:inline`.
  - Page list `gap-1`: page = ghost `icon`, **current = outline**.
  - Ellipsis: `size-9` with `ellipsis` icon + sr-only label.
- The reference mixes h-9 (prev/next) with h-10 (page numbers). See Q11.

### 6.11 Card and stat card

| Part                | Spec                                                                                                                       | Today                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Card                | `rounded-lg border bg-card text-card-foreground shadow-sm`                                                                 | `rounded-xl ring-1 ring-foreground/10`, 16px spacing |
| Header              | `flex flex-col space-y-1.5 p-6`                                                                                            | `px-4`, muted fill when followed                     |
| Title / description | `SectionTitle` / `SubText` (§2.3)                                                                                          | `text-base font-medium`                              |
| Content             | `p-6 pt-0`                                                                                                                 | `px-4`                                               |
| Footer              | `flex items-center p-6 pt-0` (pagination footer: §6.10)                                                                    | muted fill + border-t                                |
| Header action       | end-aligned `flex items-center gap-2` (badge + icon button `xs`)                                                           | card-action slot, kept                               |
| Interactive card    | `transition-all hover:shadow-md hover:bg-muted/50 cursor-pointer`                                                          | `.card-hover` (restyled)                             |
| Inset panel         | `rounded-lg border bg-muted/10 p-3` · tinted tile `bg-{status}/5` · callout row `rounded-lg border bg-primary/5 px-4 py-3` | —                                                    |

**StatCard** anatomy (restyles the existing `StatCard` / `dashboard-stat-card`):
header `p-6 pb-2 flex-row items-center justify-between` → `StatLabel` + icon
`size-4` (muted, or a status/primary tint); content `p-6 pt-0 flex flex-1
flex-col` → `StatValue`, meta line `text-xs text-muted-foreground` (trend icon
`size-3` + `text-success`/`text-destructive` delta), optional `text-2xs` detail,
and a `mt-auto pt-2` footer with Progress `h-1` + `text-xs` caption and an
optional `link`-style action.

### 6.12 Page header, sidebar, top bar, breadcrumbs

| Part                                     | Spec                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PageHeader**                           | `flex flex-wrap items-start justify-between gap-3`. Start: `PageTitle`, then `PageDescription` (+ optional inline `Badge sm`, `gap-2`). End: actions `flex flex-wrap gap-2` (primary `default` with leading `plus`, outline `icon` for refresh). ADR-044 #8's title + description rule is unchanged                     |
| **Sidebar item**                         | `h-10 w-full justify-start gap-2 rounded-md px-4 py-2 text-nav font-medium`, icon 16, hover and active per §1.5. Group trigger: `justify-between`, trailing count pill + `chevron-right` (rotates 90° open, inferred). Children: `ps-4 mt-1 space-y-1`, same item component                                             |
| Top bar                                  | start: sidebar toggle ghost `icon-xs` (`panel-left-close`), global search trigger. End: market status `Badge status-outline` + live dot, icon buttons ghost `sm` with icon 20 (docs, locale + `text-xs uppercase` code, theme, bell + count pill), avatar `icon`                                                        |
| Breadcrumbs (inferred, not in reference) | `flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground`; separator `chevron-right` size-3.5 (RTL-flipped); link `hover:text-foreground`; current `text-foreground font-normal`                                                                                                                              |
| Auth screen                              | `min-h-screen grid place-items-center bg-linear-to-br from-background to-muted p-4`; card `max-w-md border-0 shadow-2xl bg-card/95 backdrop-blur`; title `text-2xl font-bold tracking-tight`; inputs with leading icons; full-width `default` submit with `emphasis`; locale and theme utilities `absolute top-4 end-4` |

### 6.13 Motion

| Use                       | Value                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Colour changes (controls) | `transition-colors` 150ms `cubic-bezier(.4,0,.2,1)` (Tailwind default, = `--duration-fast`) |
| Sidebar collapse          | 200ms `ease-in-out`                                                                         |
| Theme switch              | `body` background/colour 300ms                                                              |
| Live dot                  | `animate-pulse`                                                                             |

All of it is subject to the existing reduced-motion reset.

### 6.14 Capture 2 — the confirmed specs (ADR-074)

These are the shadcn `default` recipes (verbatim in `capture-2.md`),
translated as follows:

- Radix `data-[state=open|checked]` becomes Base UI's `data-open` /
  `data-checked`.
- Physical `left`/`right`/`pl`/`pr` become logical `start`/`end`/`ps`/`pe`
  (code-style #3).
- Arbitrary lengths become scale values: `min-w-[8rem]` → `min-w-32`,
  `max-h-[300px]` → `max-h-75`, `min-h-[80px]` → `min-h-20`,
  `max-w-[420px]` → `max-w-105`.
- **⚑** marks an accessible deviation from the reference (ADR-072 §1).

**Form controls**

| Component  | Spec                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checkbox   | `size-4 rounded-sm border` + focus ring; ⚑ boundary `border-primary-interactive` in every state (raw bronze is 2.9:1, under the 3:1 a control boundary needs); checked `bg-primary text-primary-foreground`; `Check` icon `size-4` (reference: `h-4 w-4`, on a 16px box) |
| RadioGroup | group `grid gap-2`; item `aspect-square size-4 rounded-full border`, ⚑ `border-primary-interactive text-primary-interactive`; indicator `Circle` `size-2.5 fill-current`                                                                                                 |
| Switch     | track `h-6 w-11 rounded-full border-2 border-transparent`, unchecked `bg-input` (3:1), checked ⚑ `bg-primary-interactive`; thumb `size-5 rounded-full bg-background shadow-lg`, `translate-x-5` checked (RTL mirrored)                                                   |
| Textarea   | `min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground` + the Input focus ring                                                                                                                   |

**Popups and items (Select, DropdownMenu, Combobox, Command)**

| Part                                     | Spec                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Popup surface                            | `min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md` (dropdown sub-menu: `shadow-lg`); Select keeps `min-w-(--anchor-width)` (ADR-057)                                                                                                                                      |
| Item                                     | `relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none` · highlight `bg-accent text-accent-foreground` · disabled `pointer-events-none opacity-50` · icons `size-4`                                                                                               |
| Select item / checkbox item / radio item | **indicator at the START**: `ps-8 pe-2`, indicator box `absolute start-2 size-3.5` holding `Check size-4` (radio: `Circle size-2 fill-current`)                                                                                                                                                      |
| Label                                    | `px-2 py-1.5 text-sm font-semibold` (Select: `ps-8 pe-2`)                                                                                                                                                                                                                                            |
| Separator                                | `-mx-1 my-1 h-px bg-muted` (Command: `bg-border`)                                                                                                                                                                                                                                                    |
| Shortcut                                 | `ms-auto text-xs tracking-widest opacity-60`                                                                                                                                                                                                                                                         |
| Sub-trigger                              | item recipe + `ChevronRight` at `ms-auto` (RTL-flipped)                                                                                                                                                                                                                                              |
| Command / Combobox search                | wrapper `flex items-center border-b px-3`; `Search` `me-2 size-4 shrink-0 opacity-50`; input `h-11 w-full bg-transparent py-3 text-sm outline-none`; list `max-h-75 overflow-y-auto`; empty `py-6 text-center text-sm`; group `p-1`, heading `px-2 py-1.5 text-xs font-medium text-muted-foreground` |

**Overlays**

| Component      | Spec                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scrim          | **`--color-overlay` = `rgb(0 0 0 / 0.8)`** (was 10%) — dialog, alert-dialog and sheet                                                                                                                                                                                                                                                                                                                       |
| Dialog         | `grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg`, centred; close `absolute top-4 end-4 rounded-sm opacity-70 hover:opacity-100`, `X size-4`; header `flex flex-col gap-1.5 text-center sm:text-start`; title `text-lg font-semibold leading-none tracking-tight`; description `text-sm text-muted-foreground`; footer `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end` |
| AlertDialog    | the Dialog anatomy; actions are Buttons (`destructive` solid for the destroying action, `outline` for cancel)                                                                                                                                                                                                                                                                                               |
| Sheet          | `fixed z-50 flex flex-col gap-4 bg-background p-6 shadow-lg`; start/end `inset-y-0 h-full w-3/4 sm:max-w-sm` with `border-e`/`border-s`; top/bottom `inset-x-0` with `border-b`/`border-t`; close as Dialog; title `text-lg font-semibold text-foreground`; header `gap-2`                                                                                                                                  |
| Popover        | `w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none`                                                                                                                                                                                                                                                                                                                      |
| Tooltip        | `rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md`                                                                                                                                                                                                                                                                                                                        |
| Toast (Sonner) | card `rounded-md border border-border bg-background p-4 text-foreground shadow-lg`; title `text-sm font-semibold`; description `text-sm text-muted-foreground`; action `bg-primary text-primary-foreground`; cancel `bg-muted text-muted-foreground`; `position="bottom-right"` (mirrors in RTL), width `max-w-105`                                                                                         |

**Navigation and feedback**

| Component  | Spec                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Breadcrumb | list `flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5`; item `inline-flex items-center gap-1.5`; link `transition-colors hover:text-foreground`; page `font-normal text-foreground`; separator `ChevronRight size-3.5` (RTL-flipped); ellipsis `size-9` |
| Alert      | `relative w-full rounded-lg border p-4`, icon `absolute start-4 top-4`, content `ps-7`; default `bg-background text-foreground`; ⚑ destructive `border-destructive/50 text-destructive-interactive` (raw red fails 4.5:1)                                                                        |

---

## 7. How this lands in our system

| Kind                                                  | Where it lives                                                                          | Admin-editable?                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 7 brand colours, 2×8 surface colours, dark overrides  | `@repo/theme` defaults → Theme row (seed) → `tokensToCss` → `<style id="brand-tokens">` | **yes** (Colors & Branding, Modes). Unchanged            |
| Derived states, ring                                  | `@repo/theme` engine                                                                    | no (ADR-003)                                             |
| Font key, radius base, base font size                 | `DEFAULT_LAYOUT` → Theme row                                                            | yes in principle (the Layout tab is paused, ADR-038/042) |
| Type scale, shadows, layout constants, radius formula | `@repo/ui` `globals.css` `@theme` / base layer                                          | no, code-owned                                           |
| Component anatomy                                     | `@repo/ui` components (cva)                                                             | no, code-owned                                           |

**On task constraint 1 ("all tokens in one location"):** tokens live in two
places, **each owning a different kind, with no value defined twice**.
`@repo/theme` owns every brandable colour. It has to: code-style #1 allows hex
literals only there, and the values are DB-backed so an admin can rebrand
without a deploy. `@repo/ui` owns everything code-owned. Both surfaces consume
the one `@repo/ui` stylesheet (ADR-006). There is no `apps/admin`: one Next.js
app, two surfaces. See Q14.

Existing installs pick up new defaults through the reset-and-reseed policy
(the seed writes theme defaults on update, as ADR-039 relies on). There is no
backfill migration.

### ADRs required before Phase 2 code (Part F #10)

1. **ADR-072, changes-20 design system**: adopts §1–§6 and records Q1–Q17 as decided.
2. It **supersedes ADR-039** (typeface → Inter) if Q6 is approved as recommended.
3. It **supersedes ADR-054** (split reader/admin scale → one scale, retire
   `.type-scale-admin` / `--ui-*`) if Q7 is approved as recommended.
4. Engine changes (ring source, surface/dark defaults, `radiusBase`,
   `baseFontSize`) are recorded in the same ADR. ADR-003 (derived hover) and
   ADR-018 rule 5 (`--primary` for fills, `-interactive` for thin/text) **stay
   in force**, and this doc was written to satisfy both.

---

## 8. What changes, at a glance

| Area                  | Today                                     | Proposed                                                   |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| Neutrals              | warm grays                                | slate                                                      |
| Primary               | `#E8B98C`                                 | `#C28D5A` (Q1)                                             |
| Focus ring            | blue (from success), 3px /50              | bronze (from primary), 2px + 2px offset                    |
| Font                  | Outfit                                    | Inter                                                      |
| Body / control text   | 14px (public 12px `sm`)                   | 16px body / 14px controls                                  |
| Button default        | 32px, `rounded-lg`                        | 40px, `rounded-md` (6px)                                   |
| Input / select        | 36px                                      | 40px (toolbar 36px)                                        |
| Card                  | `rounded-xl`, ring, 16px padding          | `rounded-lg` (8px), border + `shadow-sm`, 24px padding     |
| Table                 | h-10 header, p-2 cells, muted header fill | h-12 header, p-4 cells (compact: 10px/8px), no header fill |
| Ghost / outline hover | muted gray                                | beige accent                                               |
| Sidebar               | 240px                                     | 256px, 40px items at 13px                                  |
| Arbitrary type sizes  | several                                   | none; 3 new named steps (`3xs`, `2xs`, `nav`)              |

---

## 9. Decisions (owner, 2026-09-11) and the questions they answer

| Q                | Decision                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1               | `#C28D5A` adopted. **Dark label ink** on bronze (and warning); the reference's failing white is not copied. General rule: accessibility overrides visual copying       |
| Q2               | Keep `#2D72C7` / `#D93A34`                                                                                                                                             |
| Q3               | Slate neutrals (as recommended)                                                                                                                                        |
| Q4               | Input border = nearest slate-ramp value passing about 3:1: `#7F8FA5` light / `#4F5E73` dark                                                                            |
| Q5               | Slate dark palette accepted                                                                                                                                            |
| Q6               | Inter on both surfaces, self-hosted. Supersedes ADR-039                                                                                                                |
| Q7               | One type scale on both surfaces. Supersedes ADR-054. Public reflow accepted, with a **post-Phase-5 visual pass** that adjusts spacing, never per-page scale exceptions |
| Q8               | Ring from primary (as recommended)                                                                                                                                     |
| Q9               | Solid red destructive buttons                                                                                                                                          |
| Q10–Q11, Q14–Q17 | As recommended                                                                                                                                                         |
| Q12              | The owner supplies a second capture. Affected specs stay "provisional — shadcn defaults" and are updated before Phase 3 restyles them. Does not block Phase 2          |
| Q13              | `/admin/design-system`, admin-only, untranslated                                                                                                                       |

The original questions follow, unchanged, for the record.

**Q1: Primary colour and its label ink.** The reference primary is `#C28D5A`.
changes-03 (2026-09-03) deliberately pinned `#E8B98C` from an earlier brief.
Separately, the reference paints **white** labels on bronze at **2.77:1**,
which fails AA. testing.md's theme-contract suite would reject it, and our
engine's `readableOn` renders `#1A1A1A` (6.01:1) instead.
**Rec:** `#C28D5A` with engine-derived dark ink. The one visible departure
from the reference is dark text on bronze buttons and selected chips. If you
want the exact white-on-bronze look, that is an explicit accessibility
exception and needs its own line in the ADR.

**Q2: Success and error hex.** Reference `#3382E2`/`#E23C36` vs our
`#2D72C7`/`#D93A34`, which differ by a few percent of lightness and are the
reason white labels pass (4.84 / 4.56 vs 3.87 / 4.26). **Rec:** keep ours.

**Q3: Cool slate neutrals** replacing today's warm grays, on both surfaces.
**Rec:** yes. It is the most visible part of the reference's look.

**Q4: Input border.** The reference uses the divider colour (`#E2E8F0`,
1.23:1), which fails WCAG 1.4.11 for identifying a control. The alternative is
the engine-derived 3:1 sibling `#91949A` (dark `#5D6572`). **Rec:** 3:1. It
is visibly a touch firmer than the reference. Choose `#E2E8F0` if exact
fidelity matters more; theme validation stays advisory either way.

**Q5: Dark palette.** None was captured. **Rec:** shadcn slate dark (§1.3),
with dark accent = muted, which the reference's own `dark:` classes specify.
The alternative is keeping today's warm dark set.

**Q6: Inter everywhere** (admin + public, superseding ADR-039), or admin only?
**Rec:** everywhere. The task is one design system for the whole UI.

**Q7: One type scale for both surfaces.** Adopting the reference (Tailwind
default) makes ADR-054's admin/reader split pointless for the admin, and a
second scale for public would contradict "one system". **Rec:** one scale,
supersede ADR-054. Public `text-sm` grows 12 → 14px and body 14 → 16px, so
public pages will reflow. Their display type (`text-display-*`) is untouched.
Also approve dropping 9px (folded into 10px).

**Q8: Focus ring from primary** instead of success. This is an engine change.
**Rec:** yes.

**Q9: Solid destructive button** (reference/shadcn) replacing today's 10%
tint. This affects every confirm-delete. **Rec:** solid. Keep the tinted
success/warning/info intent variants (ADR-046).

**Q10: Default table density for admin list screens.** Users Directory uses
compact (11px cells, 10/8px padding); simpler tables use default (14px, 16px
padding). **Rec:** `DataTable` defaults to **compact** for admin lists;
`Table` inside cards defaults to `default`.

**Q11: Pagination heights.** The reference mixes h-9 and h-10 in one footer.
**Rec:** unify on h-9 (page numbers `size-9`).

**Q12: Components the capture does not show open:** dropdown/select content,
dialog, sheet (incl. overlay darkness: shadcn `black/80` vs ours 10%),
tooltip, toast, checkbox/radio/switch, breadcrumbs, textarea, sortable table
headers, empty state. **Rec:** use shadcn new-york v3 defaults as specified
(overlay `black/50` as a middle ground), or send one more capture with a menu,
a dialog and a form open and they will be matched exactly.

**Q13: Where the Phase 4 `/design-system` page lives.** A public route must be
translated into every active locale (ADR-043) and would publish our internal
component catalogue. **Rec:** `/admin/design-system`, staff-gated,
English-only, replacing `/admin/_dev/kitchen-sink`.

**Q14: Constraint 1 interpretation** (§7), plus one lint detail: CSS-variable
references like `h-(--height-input)` are token references, not arbitrary
values. **Rec:** accept the two-home split, and have the Phase 6 lint ban
`-[` arbitrary values but allow `(--token)` references.

**Q15: Progress track.** The reference uses `bg-secondary`, which with our
brand secondary (`#2A2A29`) is a near-black track (in the reference too).
**Rec:** `bg-muted`, as its own list progress bars already do.

**Q16: Public-site scope.** The reference has no public pages. **Rec:** public
inherits tokens, type, radius and every shared primitive. Public-only
compositions (PageHero, CourseCard, QuizCard, VideoCard, mega menu, ADR-018
motion) keep their layout and pick up the new look through tokens only, with
no per-page redesign.

**Q17: Primitive library.** **Rec:** stay on Base UI (base-nova) and restyle
to this anatomy, rather than swapping to Radix to match the reference's
internals. A swap would rewrite every component with no visual gain.

### Decided without asking (reversible, flag if wrong)

- Charts don't adopt shadcn's `--chart-1…5` (§1.6).
- Icon stroke is 2 everywhere; the dock's 1.75 is dropped (§5).
- `yellow-400` for pinned stars becomes `warning` (§6.9).
- Status tint border is `/20` everywhere; the reference also uses `border-none` (§6.6).
- Sonner is the one toast (§6.5).
