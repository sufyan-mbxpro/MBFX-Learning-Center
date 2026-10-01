# ADR-175 — The home promotions band is a spotlight

- **Status:** Accepted
- **Date:** 2026-09-30
- **Module:** 12 (public site)
- **Supersedes:** ADR-174 #6 ("the home band is an intro column plus a
  carousel"). Everything else in ADR-174, ADR-173, ADR-170 and ADR-167 stands.
- **Change set:** `docs/changes/changes-56-promomotion-updates.md` (second
  review)

## Context

ADR-174 #6 gave the band the reference's LAYOUT (a heading column, cards
running past it) but kept the carousel's MODEL: every card equal, every card
carrying its own words, and a heading column that said the same thing
whichever promotion was in view. The owner's second review pointed at the
same reference ("featured listings") and asked for its model:

1. ONE promotion is selected. Its picture is larger than its neighbours and
   carries a few basic facts directly under it.
2. The selected promotion's DESCRIPTION is what the start column shows, and
   it changes with the selection.
3. It moves on by itself, and it should be "smarter" about what it shows.

A scroll-snap shelf cannot express "one of these is selected and another
region describes it": its current slide is whatever happens to be scrolled
into view.

## Decision

1. **The band is a tabbed spotlight, not a carousel of cards.** The picture
   tiles are `role="tab"`s in one `tablist`; the start column is the
   `tabpanel`. It uses the APG carousel pattern with tabs as the slide picker.
   Only the selected tab is in the tab order, and the arrow keys move the
   selection (automatic activation, direction-aware in RTL). The whole band is
   a `region` with `aria-roledescription="carousel"`.
2. **The track slides and the tiles do not scroll.** The selected tile keeps
   its place near the start with the previous tile showing before it (fully
   from `lg`, as a sliver below it). This is a transform on the track, so the
   page never scrolls on its own (ADR-121 §4's objection to `scrollIntoView`
   from a timer). Swiping on a touch screen moves the selection.
3. **Autoplay keeps ADR-174 #2's stops.** It advances every 7 s and never
   under reduced motion, while a mouse pointer or focus is inside, while the
   band is less than half on screen, or while the tab is hidden. There is no
   pause button: the same change set removed them from the banners and the
   shared `Carousel`, and the band follows the site. The panel is
   `aria-live="off"` while it plays and `polite` when it is still. The active
   dash in the position row fills over the interval, so a reader can see when
   it will move.
4. **The facts under the selected tile come from the promotion's own clock.**
   The first line is the most urgent true statement, in this order:
   - "Live now" during an event.
   - "Starts in …" before one.
   - "Ends in …" when the promotion's window closes within three days.
   - "Until {date}".

   The admin's badge is on the picture and is never repeated in the facts.
   The second line is small icon facts: the kind, "Until {date}" when the
   headline is not already that date, an external link, and "Recording" only
   once one can be watched. Everything clock-derived waits for hydration, as
   `PromotionCard` already does, so a cached render never disagrees with the
   reader's clock. The order of promotions is untouched (ADR-167 #5):
   "smarter" never means reordering.
5. **An impression is the SELECTED promotion while the band is at least half
   on screen.** It is reported once per promotion per page load (ADR-170 #2's
   meaning). A tile in the row is not an impression: it shows a picture and
   no words.
6. **The popup and the band still share their words and rules.** The CTA and
   the event row move out of `PromotionCard` into `PromotionCta` and
   `PromotionEventMeta`, which the card and the spotlight both render.
   ADR-167's "cannot drift" holds by construction rather than by copying.

## Consequences

- No schema, contract, endpoint or permission change.
- Public catalog keys in `en` and `ar` in the same change: `bandTabsLabel`,
  `endsIn`, `until`, `recording`.
- `@repo/ui` `globals.css` gains one keyframe (`promo-progress`) for the
  filling dash.
- The band no longer uses `Carousel`. `promotions-public.test.ts`'s ADR-174
  band guard is replaced by one for this shape.
