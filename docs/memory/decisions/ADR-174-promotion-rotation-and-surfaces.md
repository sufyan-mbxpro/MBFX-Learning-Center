# ADR-174 — Promotions rotate, and each surface gets its reference's shape

- **Status:** Accepted
- **Date:** 2026-09-30
- **Module:** 12 (public site)
- **Supersedes:** ADR-173 #2 ("one banner per position"). Everything else in
  ADR-173, ADR-167 and ADR-170 stands.
- **Change set:** `docs/changes/changes-56-promomotion-updates.md`

## Context

The owner reviewed the three promotion surfaces and asked for four things:

1. The home band ("Don't miss") shown as the reference's featured-listings
   band: a heading column at the start and the cards sliding past beside it,
   not a grid of equal cards.
2. A better popup, with a close button that reads as a control rather than a
   bare glyph floating over the picture's corner.
3. The bottom strip's cross as a TAB at the top end of the strip, the strip's
   own colour, standing a little above it (a broker's strip was the
   reference).
4. When several promotions are live, the strip plays them one after another
   on its own.

Item 4 contradicts ADR-173 #2: with one banner per position, a second live
promotion at the same position is never seen.

## Decision

1. **A position shows every live banner filed to it, one at a time.** The
   list keeps ADR-167 #5's order (priority first). Below `xl` the fixed slot
   still draws ONE strip (ADR-173 #3), and that strip now rotates through the
   bottom and both side positions' banners together, in priority order,
   instead of dropping all but the first. Side cards rotate in the same way.
2. **Rotation is WCAG 2.2.2-safe by construction.** It advances every 7
   seconds only while nothing argues against it: never under
   `prefers-reduced-motion`, never while the pointer is over the banner or
   focus is inside it, never while the tab is hidden. A visible pause/play
   button and one dot per promotion (each a jump control) render when there
   is more than one. The changing text is not a live region while it plays.
3. **The cross closes the whole banner.** Closing records every promotion the
   rotation has SHOWN as closed (ADR-173 #5's key and frequency rule, per
   promotion) and reports a `DISMISS` for each of them. A promotion the
   reader never saw is not recorded as closed and comes back on the next
   page, alone.
4. **Impressions are per slide.** A promotion reports its `BAR` impression
   the first time its slide is shown, not when the strip mounts, so a third
   promotion the reader closed before reaching is not counted as seen
   (ADR-170 #2's meaning of an impression).
5. **The bottom strip's close is a tab.** It sits at the inline end, above
   the strip, in `--secondary`, attached to it. The strip's published height
   (`--promotion-bar-height`) includes the tab, so the back-to-top button
   rises above it rather than under it. The row the tab sits in is
   `pointer-events-none` apart from the tab, so it blocks nothing. The TOP
   strip keeps its cross inline: a tab hanging below it would cover the
   sticky header.
6. **The home band is an intro column plus a carousel.** From `lg` the
   heading, a lead and nothing else sit in a 24rem column
   (`--grid-intro-main`) and the cards run in the shared `Carousel`, with the
   same opt-in autoplay and pause button the testimonials use (ADR-121 §4).
   Below `lg` the heading sits above the carousel. One promotion renders as
   one card with no carousel controls.
7. **The popup is edge to edge.** The picture fills the dialog's top, the
   words sit in their own padding below it, and the close is a round button
   on a translucent page-ground disc at the top end, sticky while the dialog
   scrolls. On a phone the dialog keeps a 1rem margin and its rounded
   corners instead of touching both edges. The admin preview draws the same
   frame, because the preview is the real `PromoCard` (changes-52 §8).

## Consequences

- No schema, contract, endpoint or permission change. The counters receive
  the same three event types.
- Five public catalog keys (`bandLead`, `bandCarouselLabel`, `pause`, `play`,
  `slideLabel`) in `en` and `ar` in the same change.
- One layout token, `--width-dialog-inset`, for the phone-width popup.
