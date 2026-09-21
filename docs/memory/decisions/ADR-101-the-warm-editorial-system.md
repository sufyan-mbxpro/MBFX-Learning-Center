# ADR-101: The neutral ramp is warm, and a public card is separated by air

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 02 (`@repo/theme` defaults), 07 (`@repo/ui` component anatomy),
12 (public site, by inheritance)
**Supersedes:** ADR-072 §4 (slate surfaces, both modes). Amends ADR-075 (the
card's resting anatomy) for the PUBLIC surface only.
**Superseded by:** —

## Context

changes-31 adopts a second reference (`docs/design-reference/extracted-design.md`)
for the public home page. The extraction found something that shortens the work
considerably: **the reference's brand colours are the ones we already ship.**
`DEFAULT_BRAND.primary` is `#C28D5A`, taken from changes-20's reference under
ADR-072 §3; the new reference's bronze is the same family within a couple of ΔE,
and its chip cream is our `accent #EAE5DE`.

The gap is entirely in the **neutrals, and it is temperature, not lightness.**
Our ramp is shadcn slate — `#F1F5F9`, `#64748B`, `#E2E8F0`, `#020817` — which is
blue-biased at every step. The reference's ramp is warm at every step. A bronze
primary on cool slate reads as _a brown button on a grey site_; the same bronze
on a warm ramp reads as one material. That is the whole colour delta, and it is
why the page currently looks like a product where the reference looks like a
brochure.

Two component-anatomy differences travel with it. The reference's cards carry
**no border and no shadow at rest** — they are separated by whitespace and a
hairline — and its CTAs are **tailored 6px rectangles, not pills**. Our public
`Card` renders a visible border at rest (ADR-075) and our home hero uses
`shape="pill"`.

Finally, the reference has **no glow, no dot grid and no ambient glyph field.**
Our home hero carries all three (`.bg-glow-primary`, `.bg-dot-grid`,
`AmbientMotif`) from changes-20.

## Decision

### 1. The colour scheme stays dynamic, and `DEFAULT_BRAND` is untouched

Unchanged from ADR-072 §2: every value here is a **default** of the
admin-editable theme, flowing `SurfacePalette` → `Theme` row → `tokensToCss` →
`<style id="brand-tokens">` → semantic tokens. Components never name a colour;
hex literals stay confined to `@repo/theme` (code-style #1). An admin's saved
theme still wins.

`primary`, `secondary`, `accent` and the four status colours are **not changed**.
The reference agrees with ADR-072 §3.

### 2. The neutral ramp rotates warm, both modes

**Light** (`DEFAULT_LIGHT_SURFACE`):

| Field         | Was (ADR-072 §4) | Now       |
| ------------- | ---------------- | --------- |
| background    | `#FFFFFF`        | `#F7F3ED` |
| surface       | `#FFFFFF`        | `#FFFFFF` |
| surfaceMuted  | `#F1F5F9`        | `#F0EBE3` |
| textPrimary   | `#020817`        | `#1E1B18` |
| textSecondary | `#64748B`        | `#6F6862` |
| textMuted     | `#94A3B8`        | `#8F877E` |
| borderLight   | `#E2E8F0`        | `#E6DFD4` |
| borderMedium  | `#7F8FA5`        | `#8C837A` |

`background` is the ivory ground and `surface` stays white **on purpose**: it is
what makes a card read as a card without a border, which §4 depends on.

**Dark** (`DEFAULT_DARK_SURFACE`) — derived, not invented. The reference has no
dark mode, and ADR-008 makes mode the user's, never the admin's, so the dark
ramp is the same warm rotation applied to a near-black espresso ground:

| Field         | Was       | Now       |
| ------------- | --------- | --------- |
| background    | `#020817` | `#14110F` |
| surface       | `#020817` | `#1B1714` |
| surfaceMuted  | `#1E293B` | `#241F1A` |
| textPrimary   | `#F8FAFC` | `#F7F3EE` |
| textSecondary | `#94A3B8` | `#A79E94` |
| textMuted     | `#64748B` | `#7E766C` |
| borderLight   | `#1E293B` | `#2B251F` |
| borderMedium  | `#4F5E73` | `#756B60` |

`DEFAULT_DARK_BRAND_OVERRIDES.accent` moves `#1E293B` → `#241F1A`, for the same
reason ADR-072 §4 gave: dark active/hover is the muted surface, and the muted
surface is now warm. `secondary` stays `#E8E6E3`.

**Every pair was verified against `validateMode`'s five blocking checks before
this ADR was written**, in both modes:

| Check                       | Light | Dark  | Floor |
| --------------------------- | ----- | ----- | ----- |
| textPrimary on background   | 15.51 | 17.02 | 4.5   |
| textSecondary on background | 4.96  | 7.13  | 4.5   |
| textPrimary on muted        | 14.45 | 14.78 | 4.5   |
| textSecondary on muted      | 4.62  | 6.19  | 4.5   |
| borderMedium on background  | 3.37  | 3.61  | 3.0   |
| borderMedium on **muted**   | 3.14  | 3.13  | 3.0   |

The last row is not in `validateMode`'s blocking list, and is held anyway:
ADR-072 §4 set that bar by hand so a field inside a muted panel also passes, and
dropping it silently would undo a decision nobody recorded a reason to reverse.

`textSecondary` is the value this constrained. The first warm candidate
(`#77706A`) cleared the background at 4.64:1 and **failed the muted surface at
4.32:1** — the exact pair ADR-072 §4's own note says had been missing from the
checks and quietly permitted everywhere. It was darkened to `#6F6862` rather
than the muted surface being lightened, because the panel tint is the thing the
reference is actually made of.

### 3. ADR-072 §1 still governs

Accessibility overrides visual copying. Where the reference's own pairing fails,
we keep the nearest passing point on the same warm ramp and record it. `textMuted`
is the standing example: at `#8F877E` it clears 3:1 on the background (3.20),
so it is usable for captions, and it remains — as it was under slate — never the
sole carrier of meaning. The slate value it replaces measured 2.60:1 on white,
i.e. the warm ramp made this one strictly better rather than trading it away.

### 4. A public card is separated by the GROUND, not by elevation

No resting shadow on the public surface. Separation comes from three things
the reference uses and we did not: the ivory ground against the white card
surface, the gap between cards, and hairlines _inside_ a card where it groups
(the new `MetricRow`). Hover keeps `.card-hover`'s ring lift, which is the one
moment elevation earns its keep.

**This is why `background` is `#F7F3ED` and not the lighter ivory the
extraction first proposed.** At `#FBF9F6` a white card sat at 1.04:1 against
its ground — a step too small to separate anything, which would have forced the
border back to do the work the ground is supposed to do. At `#F7F3ED` the step
is 1.11:1 and the card reads as an object on a surface. The ground's job here
is structural, not decorative, and that is what set its value.

So the rule is not "no line". A card on a ground it contrasts with needs none;
a card on a ground of its own tone still does. `Card` gains a **`plain`**
variant (no border, no shadow) for the first case — the testimonials band on a
muted ground is the worked example — and `CourseCard`/`QuizCard`/`VideoCard`
already satisfy the rule as written: a hairline ring, no resting shadow.

**The admin surface is unchanged.** `Card`'s default keeps its border and
`shadow-sm`. ADR-075 stands there: a dense screen of tables, trays and panels
needs its borders, and an admin card floating with no outline is a worse
screen, not a calmer one. This is the same public/admin split ADR-072 §7 draws
for spacing — one system, two densities — not a second design system.

### 5. The default CTA is a tailored rectangle

`Button`'s default shape already IS the 6px rectangle (`--radius-md`, which is
`radiusBase`) — ADR-072 set it from a reference with the same taste. What
changes is that the public CTAs stop opting out: `shape="pill"` comes off the
home hero, the video rail and the connect band.

It stays available and stays a deliberate choice. A pill reads friendly; a 6px
rectangle reads tailored, and tailored is what the rest of this ADR is for.

### 6. The home page drops its ambient devices

`.bg-glow-primary`, `.bg-dot-grid` and `AmbientMotif` come off **every home
band** — the hero, `explore_platform`, `connect`, `quotes` and
`learning_videos`. They are changes-20 devices and the reference has none of
them; a glow is the single loudest thing on a page whose whole argument is
restraint, and four bands each carrying their own wash is four arguments
against it.

The page keeps its band rhythm the way the reference does: by TONE. A muted
band, an inverted band and the default ground alternating down the page do the
separating that the washes were doing, without painting anything.

**The utilities are not deleted.** Other surfaces use them (the footer, the
About section fronts, the section mastheads), and deleting a utility because one
page stopped calling it is how a design system loses vocabulary it will want
back. They stay in `globals.css`, unreferenced by the home page.

## Consequences

- **Every surface changes colour**, public and admin, because this is the theme
  default. That is the intent — a design language that reached only the home
  page would be a page style, not a system.
- **An admin who has already saved a theme sees nothing change.** Their row
  wins. Only a fresh install, a reset, and the seeded default row move.
- `packages/db/prisma/default-theme-tokens.json` must be updated in the same
  commit; `seed-sync.test.ts` fails otherwise, by design.
- The fast-check theme contract (random palettes) is unaffected: it tests the
  engine's derivations, not these values. The values above are covered by
  `validateMode` and by the snapshot tests, which will need re-approval.
- **Reversible in one commit.** Two constants and a JSON file.
