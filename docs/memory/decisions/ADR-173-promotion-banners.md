# ADR-173 — Promotion banners: a third, dismissible surface

- **Status:** Accepted
- **Date:** 2026-09-30
- **Module:** 11 (content), 12 (public site)
- **Extends:** ADR-167 (promotions), ADR-170 (promotion counters). Nothing
  reversed.

## Context

The owner wants a promotion to be able to show as a small banner, like a
broker's strip pinned to the bottom of the page, that a reader closes with a
cross. The admin should choose where it sits: the top of the page, the bottom,
or the left or right side.

ADR-167 gave a promotion two surfaces: the popup and the home band. A banner is
neither. It covers nothing, so it has no delay and no dialog, and a reader can
close it, which the band cannot be.

## Decision

1. **A third surface, `showAsBar`, with one `barPosition`.** The position is
   one of `TOP`, `BOTTOM`, `LEFT` or `RIGHT` (`PROMOTION_BAR_POSITIONS` in
   `@repo/contracts`). A promotion must use at least one of popup, band or
   banner.
   - The four positions are a closed set in code, like the placements
     (ADR-167 #1). An admin picks one of them and never types a position.
   - The pages a banner appears on are the promotion's own `placements`, and
     the excluded paths apply to it as well.
2. **One banner per position.** Two live banners at the same position do not
   stack. The one with the highest priority shows, as with the popup's order
   (ADR-167 #5). Banners at different positions can show together.
3. **Sides are logical.** `LEFT` renders at the inline START and `RIGHT` at the
   inline END, so an Arabic page mirrors them, as every other part of the
   layout does (code-style.md #3).
   - Below the `xl` breakpoint (1280px) the bottom strip and both side
     banners collapse into ONE strip at the bottom: the one with the highest
     priority. A 14rem card beside a narrower page would cover its content,
     and three stacked strips would cover a phone screen.
4. **`TOP` sits in the page flow above the header, never over it.** A fixed
   strip over a sticky header would hide the navigation. The other three
   positions are fixed to the viewport. A bottom strip reserves its own height
   at the end of the page, so it never covers the footer's last line.
5. **`frequency` decides when a closed banner comes back.** For the popup,
   "seen" means it was opened. For a banner, it means the reader closed it.
   The pure rule, `shouldShowPromotion`, is the same one:
   - `ONCE`: never again.
   - `PER_SESSION`: the next visit.
   - `DAILY`: the next day.
   - `EVERY_VISIT`: the next page.

   Its storage key is separate from the popup's
   (`promotionBarSeenKey`), so closing one does not hide the other. The key
   includes the version, so an edited banner shows again.
6. **Counted like the popup (ADR-170).** `PromotionSurface` gains `BAR`. A
   banner reports an impression when it shows, a click when the reader
   follows it, and a dismissal when the reader closes it. `DISMISS` is
   accepted from the popup and the banner, and never from the band.
   `acceptedPromotionEvents` counts a `BAR` event only for a promotion that
   has the banner switched on. No new anonymous write is added: banner
   events use the existing `POST /api/promotions/events` route, with all
   five of its guards.
7. **The same endpoint.** `GET /api/promotions` now returns promotions that
   show as a popup OR as a banner. Each surface filters that list by its own
   flag. The popup and the banner hosts share one request per language.

## Consequences

- A migration adds two columns and widens the `surface` enum. Existing rows
  keep their current behaviour, because `showAsBar` defaults to false.
- Two public catalog keys, in `en` and `ar`, in the same change.
- The popup's delay has no meaning for a banner. The editor keeps that field
  tied to the popup switch.
