# Extracted design language — "Luxora" reference

**Date:** 2026-09-15
**Source:** the reference image supplied in-session (a luxury real-estate
landing page, Pinterest pin `1126603663112147495`). Expected on disk at
`docs/design-reference/reference.png` — **the file is not in the repo yet**;
the image was attached to the conversation, not committed. Drop it at that
path so this document has its subject beside it.
**Status:** Step 1 of the changes-31 brief. Extraction only — no code follows
from this document until the owner approves the plan in
`docs/changes/changes-31-*.md`.

This is a **design-language extraction**, not a spec to pixel-copy. Values are
read off a single 736×1104 capture, so they are ratios and intents, not
measurements: where the reference and our accessibility rules disagree, ADR-072
§1 already decides it (accessibility overrides visual copying) and this document
records the deviation rather than the reference value.

---

## 0. One-line read

**Warm editorial luxury.** An ivory page, one bronze accent, a high-contrast
serif for anything that is _said_ and a neutral sans for anything that is
_operated_, hairline dividers instead of boxes, photography carrying the weight,
and shadows so restrained that whitespace does the separating. Its opposite is
the dark fintech dashboard: nothing glows, nothing is neon, nothing is glassy
except one search bar.

Three devices give it the premium read, and all three are structural rather
than decorative:

1. **The framed page.** The whole document is a rounded white sheet inset over
   a fixed marble photograph, with a large soft shadow. The site is presented
   as an object on a surface.
2. **Serif/sans duality.** Every heading, price and statistic is serif; every
   label, nav item, button and metric caption is sans at 11–14px. The contrast
   between the two IS the typographic system.
3. **Hairlines over containers.** Metrics, stats and FAQ rows are separated by
   1px rules, not by cards inside cards.

---

## 1. Colour palette

Read off the capture, quantised. Hex values are the _observed_ colour; the
"ours" column is the token that owns the role, and §6 carries the proposal.

| Role in the reference                                                | Observed                       | Our token (`@repo/theme`)      | Emits                 |
| -------------------------------------------------------------------- | ------------------------------ | ------------------------------ | --------------------- |
| Page ground (the sheet)                                              | `#FFFFFF`                      | `SurfacePalette.background`    | `--background`        |
| Outer ground (marble photo)                                          | warm beige `#D8CDBF`±          | — (not a token; decorative)    | —                     |
| Card / panel                                                         | `#FFFFFF`                      | `SurfacePalette.surface`       | `--card`, `--popover` |
| Tinted panel (search bar, agent band, stat grid, FAQ rows, map card) | `#F6F3EF`                      | `SurfacePalette.surfaceMuted`  | `--muted`             |
| Brand bronze (CTAs, prices, crest, chips, CTA banner, "as of" marks) | `#B98A4B` – `#C08F52`          | `BrandColors.primary`          | `--primary` + derived |
| Chip cream / soft fill                                               | `#EDE7DF`                      | `BrandColors.accent`           | `--accent`            |
| Heading & body ink                                                   | `#1E1B18` (warm near-black)    | `SurfacePalette.textPrimary`   | `--foreground`        |
| Secondary copy                                                       | `#7A736B`                      | `SurfacePalette.textSecondary` | `--muted-foreground`  |
| Tertiary / captions                                                  | `#A49C93`                      | `SurfacePalette.textMuted`     | `--text-muted`        |
| Hairline / divider                                                   | `#EAE4DC`                      | `SurfacePalette.borderLight`   | `--border`            |
| Field outline                                                        | (reference reuses the divider) | `SurfacePalette.borderMedium`  | `--input`             |
| Dark chip ("FEATURED", "EXCLUSIVE")                                  | `#211E1A`                      | `BrandColors.secondary`        | `--secondary`         |

**Findings that matter more than the hexes:**

- **The reference's bronze is the bronze we already ship.** `DEFAULT_BRAND.primary`
  is `#C28D5A` (ADR-072 §3, taken from the changes-20 reference). The new
  reference's accent is the same family within a couple of ΔE. **No brand-colour
  change is required by this redesign** — which is the single most useful thing
  this extraction establishes.
- **`accent` is already the reference's cream.** `#EAE5DE` vs the observed
  `#EDE7DF`. Also unchanged.
- **The gap is the neutrals, and it is a temperature gap, not a lightness gap.**
  Our slate ramp (`#F1F5F9`, `#64748B`, `#E2E8F0`, `#020817`) is blue-biased;
  the reference's ramp is warm-biased throughout. A bronze primary on cool slate
  reads as "a brown button on a grey site"; on a warm ramp it reads as one
  material. This is the whole colour delta.
- **Exactly one accent hue.** No secondary brand colour appears anywhere in the
  capture. Status colours (success/warning/info/error) are absent from the
  reference entirely and stay ours.
- **Colour is never load-bearing.** Badges differ by _fill_ (bronze vs near-black)
  but each also carries its own word; the stat icons are bronze but each has a
  caption. Nothing in the design needs a colour to be understood.

### Dark mode

The reference has no dark mode. Per ADR-008 the user controls mode and the
admin never does, so a dark counterpart must be **derived**, not invented: the
same warm rotation applied to a near-black ramp (espresso ground, warm
off-white ink), keeping the bronze — which survives a mode flip unchanged, as
ADR-072 §4 already found for `primary`. See §6 for the proposed values.

---

## 2. Typography

| Element                                    | Reference           | Size (est.)       | Weight  | Tracking    | Case            |
| ------------------------------------------ | ------------------- | ----------------- | ------- | ----------- | --------------- |
| Hero headline                              | high-contrast serif | ~52–64px, 2 lines | 400     | ~-0.01em    | sentence        |
| Section heading                            | serif               | ~28–32px          | 400–500 | normal      | sentence        |
| Card title                                 | sans                | 14–15px           | 500–600 | normal      | sentence        |
| Stat numeral                               | serif               | ~30–34px          | 400–500 | normal      | —               |
| Price                                      | sans (tabular)      | 13–14px           | 600     | normal      | —               |
| Nav item                                   | sans                | 13px              | 400–500 | normal      | sentence        |
| Button label                               | sans                | 13px              | 500     | ~0.01em     | sentence        |
| Eyebrow / trust label / footer column head | sans                | 10–11px           | 500–600 | **~0.14em** | UPPERCASE       |
| Badge chip                                 | sans                | 9–10px            | 600     | ~0.1em      | UPPERCASE       |
| Body / card meta                           | sans                | 12–13px           | 400     | normal      | sentence        |
| Wordmark                                   | serif               | ~20px             | 400     | ~0.18em     | small caps feel |

**The one structural finding:** the reference runs **two families**, split by
job — serif for _statements_ (headline, section headings, stat numerals, the
wordmark, the CTA banner line) and sans for _operation_ (nav, buttons, labels,
meta, captions, form controls). Our system has one family (Inter, ADR-072),
which is why our headings read "product" where the reference's read "editorial".

Everything else in the table we already have:

- `--tracking-caps: 0.14em` is exactly the reference's eyebrow tracking.
- `--text-display-lg` (`clamp(2.75rem, …, 4.5rem)`) covers the hero.
- `--type-3xs: 10px` / `2xs: 11px` / `nav: 13px` are the named homes of the
  reference's 10/11/13px — they already exist because changes-20's reference
  used the same three sizes.
- Line-height is generous everywhere: ~1.1 on the display line, ~1.6 on body.
- Nothing renders below 10px (ADR-072); the reference's 9px badge folds into
  `3xs`.

---

## 3. Spacing, layout and rhythm

- **The frame.** The sheet is inset from the viewport on all sides (~24–32px at
  this width), rounded (~16–20px at the top corners), over a fixed photographic
  ground. Content then has its own gutter inside that.
- **Container:** content column ≈ 1140–1200px inside a ~1280px sheet. Ours is
  `--container-width: 1400px` (admin-set) with `--container-narrow: 768px` for
  prose — the reference is narrower and airier.
- **Section rhythm:** ~72–96px between bands; heading to content ~24–32px. Our
  `--section-space-md: clamp(3rem, 6vw, 5rem)` and `-lg: clamp(4rem, 8vw, 7rem)`
  already bracket this.
- **Grid patterns observed, in order of frequency:**
  - 4-up card row (featured properties, neighbourhoods, footer link columns)
  - 3-up panel row (testimonials band: quote / video / offer)
  - 2-up asymmetric split (agent band; intro-left + tiles-right; FAQ in two
    columns of stacked rows)
  - 4-cell hairline-divided metric grid inside one panel (the stats)
  - 3-cell hairline-divided metric row inside a card footer (beds/baths/sqft)
- **Card gaps:** ~20–24px. **Card padding:** ~16–20px, tighter than the section
  rhythm by design — the air lives _between_ cards, not inside them.
- **Alignment:** section heading flush start, action flush end, on one baseline.
  Every band in the capture does this; none centres its heading except the FAQ.

---

## 4. Component styling

**Card.** White, radius ~12px, **no shadow at rest** — separated by whitespace
and a hairline, not elevation. Image on top at the card's own radius, flush to
its edges. Hover (inferred, not visible in a still): the image scales, the
title takes the bronze. Our `Card` + `.card-hover` + `.media-zoom` already
express this; the delta is that our default card carries a visible border where
the reference carries almost none.

**Buttons.**

| Variant           | Reference treatment                                                                  |
| ----------------- | ------------------------------------------------------------------------------------ |
| Primary           | bronze fill, white/near-black label, radius ~6px, ~40px tall, 20–24px inline padding |
| Secondary         | transparent with a hairline outline, ink label                                       |
| On-image          | translucent white over the photo, ink label                                          |
| Icon / "view all" | 32–36px **circle**, hairline outline, arrow glyph                                    |
| Inline link       | ink label + arrow, underline on hover                                                |

Note: the CTAs are **softly rounded rectangles, not pills.** Our homepage hero
currently uses `shape="pill"`. That is a real difference in read — a pill is
friendly, a 6px rectangle is tailored.

**Badges / chips.** Two fills (bronze, near-black), white label, ~4px radius,
uppercase 9–10px, tracking ~0.1em, sitting over the image's top-start corner
with an ~8px inset.

**Inputs.** The floating search bar is one white panel divided by **vertical
hairlines** into four fields — each field is icon + label-above + value, with no
individual box. The newsletter input is a hairline-outlined rounded rect with a
bronze square arrow button fused to its end.

**Image treatment.** Radius 10–12px, `object-fit: cover`, occasional bottom or
start-edge dark gradient for text legibility, greyscale for the trust logos, and
a circular white play button centred on video thumbnails.

**Dividers.** 1px hairlines doing real structural work — between stat cells,
between a card's body and its metric row, above the footer's bottom bar.

---

## 5. Visual effects

- **Gradients:** two only — a dark scrim on the hero image (start-edge, ~0→60%)
  and a soft vertical wash under the video thumbnail. No decorative colour
  gradients anywhere.
- **Glass / blur:** one instance, the favourite button on each card (translucent
  white circle over the photo). Not a system-wide device.
- **Glow:** none. There is no glow in this reference at all.
- **Shadows:** the sheet's own large soft drop shadow, and a lifted shadow under
  the floating search bar. Cards have none.
- **Decorative shapes:** a dotted world map with bronze pins; a large serif quote
  glyph; small numbered circles overlapping the neighbourhood tiles. All
  content-bearing, none purely ornamental.
- **What is absent is diagnostic:** no dot grid, no ambient glyph field, no
  brand wash behind bands, no animated marquee. Our public surface currently
  carries `.bg-glow-primary`, `.bg-dot-grid` and `AmbientMotif` on the hero.
  Those are changes-20 devices, not this reference's.

---

## 6. Token mapping (proposal — nothing is applied yet)

Everything below is a change to **`@repo/theme` defaults**, mirrored into
`packages/db/prisma/default-theme-tokens.json` (`seed-sync.test.ts` fails if
they drift). An admin's saved theme still wins; no component learns a colour.

### 6.1 `DEFAULT_BRAND` — unchanged

`primary #C28D5A`, `accent #EAE5DE`, `secondary #2A2A29`, and the four status
colours all stay. The reference agrees with ADR-072 §3.

### 6.2 `DEFAULT_LIGHT_SURFACE` — slate → warm neutral

| Field           | Now       | Proposed      | Why                                                                                                                                                                                                      |
| --------------- | --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background`    | `#FFFFFF` | **`#F7F3ED`** | the ivory ground; white stays for cards so a card _reads_ as a card. Deepened from the `#FBF9F6` first proposed: at that value a white card sat 1.04:1 against it, too small a step to separate anything |
| `surface`       | `#FFFFFF` | `#FFFFFF`     | unchanged                                                                                                                                                                                                |
| `surfaceMuted`  | `#F1F5F9` | **`#F0EBE3`** | the warm tinted panel                                                                                                                                                                                    |
| `textPrimary`   | `#020817` | `#1E1B18`     | warm near-black; ≥16:1 on both grounds                                                                                                                                                                   |
| `textSecondary` | `#64748B` | **`#6F6862`** | must clear 4.5:1 on background **and** on muted — `#77706A` cleared the first at 4.64 and failed the second at 4.32                                                                                      |
| `textMuted`     | `#94A3B8` | **`#8F877E`** | captions only; never sole carrier of meaning                                                                                                                                                             |
| `borderLight`   | `#E2E8F0` | **`#E6DFD4`** | the hairline                                                                                                                                                                                             |
| `borderMedium`  | `#7F8FA5` | **`#8C837A`** | ADR-072 §4's rule, re-run on the warm ramp: 3.37 on background, 3.14 on muted                                                                                                                            |

### 6.3 `DEFAULT_DARK_SURFACE` — derived, not invented

| Field           | Now       | Proposed                    |
| --------------- | --------- | --------------------------- |
| `background`    | `#020817` | `#14110F`                   |
| `surface`       | `#020817` | `#1B1714`                   |
| `surfaceMuted`  | `#1E293B` | `#241F1A`                   |
| `textPrimary`   | `#F8FAFC` | `#F7F3EE`                   |
| `textSecondary` | `#94A3B8` | `#A79E94`                   |
| `textMuted`     | `#64748B` | `#7E766C`                   |
| `borderLight`   | `#1E293B` | `#2B251F`                   |
| `borderMedium`  | `#4F5E73` | **`#756B60`** (3.61 / 3.13) |

`DEFAULT_DARK_BRAND_OVERRIDES.accent` moves from `#1E293B` to the warm muted
surface for the same reason it was the cool one (dark active/hover = muted).

**These were candidates when this was written; they are now ADR-101's decided values**, with the bold ones changed during verification. The theme-contract suite
(`testing.md` §4, fast-check over random palettes) and `packages/theme`'s own
contrast tests are the arbiter; any pair that fails is replaced by the nearest
passing point on the same warm ramp and the deviation recorded, exactly as
ADR-072 §4 did for `borderMedium`.

### 6.4 Typography — one new token, and it is the whole redesign

The serif/sans duality cannot be expressed today: `LayoutTokens` has `fontSans`
and `fontMono` and nothing else, `CURATED_FONTS` contains no serif, and
`tokensToCss` emits `--brand-font-sans` / `--brand-font-mono` only.

Proposed: **`LayoutTokens.fontDisplay`**, a third curated slot, defaulting to a
serif, emitted as `--brand-font-display`, exposed as `--font-display` in
`@theme` (so `font-display` is a utility), surfaced in the theme editor's
Typography section beside the other two, and **falling back to `fontSans` when
unset** so every existing theme row keeps rendering exactly as it does today.

Curated serif candidates (variable, well-hinted, good at 48px+ and at 28px):
Fraunces, Playfair Display, Cormorant Garamond, Libre Baskerville, Instrument
Serif. Recommendation: **Fraunces** for its optical-size axis (the reference's
headline is visibly a display cut, not a body serif scaled up).

This is a deviation from ADR-072's "Inter is the brand typeface", so it needs
its own ADR before the code (CLAUDE.md governance, Part F #10). ADR-072 §1's
precedent is directly on point: a superseded default deletes nothing an admin
may have picked — Inter stays selectable and stays the sans.

### 6.5 Shape and elevation

| Token            | Now                 | Proposed                                                     |
| ---------------- | ------------------- | ------------------------------------------------------------ |
| `radiusBase`     | `6px`               | `6px` (unchanged — the reference's buttons are 6px)          |
| `--radius-xl`    | `radius + 6` = 12px | unchanged; this is the card/image radius                     |
| card rest shadow | `--shadow-card`     | keep the token, **stop applying it at rest** on public cards |
| `--shadow-float` | exists              | the floating search-bar tier                                 |

New named layout tokens (in `globals.css` `:root`, per ADR-072 §10 — a new
value is named once, never inlined): `--frame-inset` and `--frame-radius` for
the framed-sheet device, if §7 keeps it.

---

## 7. What we take, what we leave

**Take:** the warm neutral ramp · the serif/sans duality · hairline-divided
metric groups · borderless cards at rest · flush heading + end-aligned action ·
uppercase micro-labels at `tracking-caps` · circular "view all" affordances ·
image-first cards with a corner chip · the restrained shadow budget · the
two-fill badge system.

**Leave:**

- **The framed sheet over a photographic ground.** Beautiful on a marketing
  one-pager, hostile on a site with a pinned header, a sticky section bar
  (`--header-offset`, ADR-065 §5), a mega menu that must escape its container,
  and an RTL mirror. Recommend: **skip on the home page**, or reduce it to a
  tinted hero band. Flagged for the owner's call.
- **Pill CTAs → 6px rectangles.** This is a take, but it changes buttons
  _site-wide_, not just on the home page.
- **The stats strip as literal numbers.** See §8.
- **Real-estate-specific furniture:** favourite hearts, price-per-card,
  bed/bath/sqft triads. Their _shape_ transfers (a 3-cell hairline metric row);
  their content does not.

---

## 8. Constraints this redesign runs into

Recorded here so the plan answers them rather than discovering them.

1. **A counted stat strip is forbidden on public pages (ADR-076,
   `public-chrome.test.ts`).** The test pins `StatCard`/`StatBand` usage to
   _one_ file, the About facts band. The reference's `$2.8B+ / 950+ / 23 / 12+`
   band is exactly the pattern that ADR banned — with one exception already
   carved out: **owner-supplied company facts** (ADR-047 §2), which render
   nothing when the facts module is empty. A home-page stats band is therefore
   possible only as owner-supplied facts, never as row counts, and it needs an
   ADR to widen that test's allow-list.
2. **Testimonials have no data model.** No entity, no admin screen. Either an
   owner-supplied content module (the ADR-047 §3 pattern, empty ⇒ absent) or
   out of scope. Recommend the former.
3. **The trust-logo strip is a claim about third parties.** It renders only
   from real, owner-supplied partners; a decorative row of invented logos is
   not shippable.
4. **The reveal system already exists** (ADR-018 rule 2): `Reveal`,
   `RevealObserver`, `.reveal-*` CSS, native `animation-timeline: view()` with
   an IntersectionObserver fallback, all inside
   `prefers-reduced-motion: no-preference`. Step 4 of the brief is an
   _extension_ of it — presets, stagger, configurable duration/threshold — not
   a new system, and **not framer-motion** (ADR-018 rule 1 is CSS-first, and a
   motion library on the public bundle is exactly the weight architecture.md
   §5 protects).
   One real gap: the native view-timeline path is **progress-driven**, so it
   re-plays when the reader scrolls back up. The brief asks for run-once. That
   is a deliberate choice to make, not a bug to fix silently.
5. **`next/dynamic` on server components buys nothing.** Most home bands are
   async server components already streaming behind their own `<Suspense>`
   (ADR-095). Code-splitting applies to the genuinely client-side leaves —
   `Carousel`, `VideoFacade`, the quotes rail — and `ssr: false` on anything
   carrying copy would cost the SEO the public surface exists for.
6. **The hero must not be revealed.** It is the LCP element. It already renders
   eagerly (`EAGER_SECTIONS = 2`) with `priority` on its image; any animation
   wrapper around it has to animate _from visible_, never _to_ it.
7. **`AmbientMotif` / `.bg-glow-primary` / `.bg-dot-grid` are on the current
   hero and absent from this reference.** Removing them is a defensible read of
   the brief; keeping them is a defensible read of our own brand. Owner's call.
8. **RTL is not optional** (code-style #3). Every device above must be
   expressed with logical properties; the reference's start-edge gradient, chip
   inset, and slide-in directions all mirror.

---

## 9. Mood, stated for the record

> A private bank's printed brochure, not a trading terminal. Ivory paper, one
> bronze foil, a serif that was cut for a page, photographs given room, and
> rules so thin they read as folds. Confidence expressed by restraint: nothing
> glows, nothing bounces, and the only thing asking for attention is the one
> bronze button per band.

Applied to a **forex learning platform** rather than a property portfolio, the
translation is: lessons and articles are the photography, the course/quiz/video
cards are the property cards, the "meet our agent" band becomes the learning
promise, and the bronze button is always the one next thing to read.
