# ADR-143 — the solid button fill and the switch are the SAVED primary

- **Status:** Accepted
- **Date:** 2026-09-19
- **Module:** 02 (`@repo/theme`), 07 (`@repo/ui`)
- **Plan:** owner request, 2026-09-19 (conversation; no changes file)
- **Supersedes:** ADR-140 §6 **for the fill value and label rule only** — the
  list of controls that use the solid fill is unchanged. Also supersedes the
  switch's use of `--primary-interactive` (ADR-073's tint-aware ink) for its
  checked track.

## Context

The owner set the primary colour to `#C8986B` in the theme editor and saw a
different colour on buttons and toggles:

- `--primary-solid` was `deriveInteractive(primary, white, 4.5)`, which
  darkened the fill to `#906D4D` so a white label cleared 4.5:1 (white on
  `#C8986B` is 2.57:1).
- The switch's checked track was `--primary-interactive`, which darkened it
  to `#806144` on the ivory light ground.

The owner's instruction: "make it the saved primary colour — do not apply the
ratio." What an admin saves is what a button and a toggle show.

## Decision

1. `--primary-solid` **is** `--primary`, unmodified, in both modes.
2. `--primary-solid-hover` is that fill darkened 12% (`shade`, as before —
   a derived state colour, ADR-003).
3. `--primary-solid-foreground` **and `--primary-foreground`** are **always
   white** (`#FFFFFF`), in both modes, at the owner's request: "the buttons'
   inner text should be white … all the icons and text remain white … should
   not change on updating the theme colour". They are constants, not a
   contrast pick, so text and icons on EVERY primary fill (buttons, badges,
   the checkbox tick, avatars, chips, CTA bands, the mega-menu highlight) stay
   white whatever primary an admin saves. For `#C8986B` that is 2.57:1, below
   the 4.5:1 text floor; the owner accepted it by asking for it.
4. `Switch`'s checked track is `bg-primary`.
5. `--primary-interactive` is **unchanged** — link text, thin borders, icon
   glyphs and the checkbox border still use the derived ink, because text and
   hairlines at the brand's raw contrast are unreadable. This ADR is about
   FILLS the owner can see as "the colour", not about ink.
6. `DEFAULT_BRAND.primary` (and the seed's `default-theme-tokens.json`
   mirror) is `#C8986B`, the value the owner saved, replacing ADR-072's
   `#C28D5A`. A re-seed writes it to the `mbx-pro-default` theme row.

7. `--success-foreground`, `--destructive-foreground` and
   `--info-foreground` are also the constant white, for the same reason: an
   admin can set any of those fills to a bronze (the owner's saved `success`
   is `#C28D5A`, the old primary), and the homepage's "Daily analysis" icon
   box then drew a dark glyph on what reads as the brand colour.
   `--warning-foreground` keeps its contrast pick — white on the amber
   warning fill (1.9:1) is unreadable. `--secondary-foreground` and
   `--accent-foreground` keep theirs too: those are neutrals whose dark-mode
   values are light, not brand fills.

## Consequences

- White labels on a light primary are below WCAG 1.4.3's 4.5:1 for normal
  text. The theme editor will NOT warn about it: `validateMode`'s button-label
  check flags a fill only when neither white nor near-black clears 4.5:1, and
  near-black does on `#C8986B`.
- A light primary now produces a switch track below the WCAG 1.4.11 3:1
  non-text floor against the page (`#C8986B` on `#F7F3ED` ≈ 2.3:1). The
  owner accepted this by asking for it; the thumb and the track's position
  still carry the on/off state.
- ADR-140 §6's property test (white label at ≥ 4.5:1) is replaced by one
  asserting the fill equals the saved primary and the label is white.
- `DEFAULT_BRAND.success` (`#936B44`, ADR-142 §1) was chosen as "the value
  `--primary-solid` derives". That value is untouched; it is simply no longer
  identical to the button fill.
