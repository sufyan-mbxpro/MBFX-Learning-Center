# ADR-111: A reveal replays

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 07 (`@repo/ui`), 12 (public site)
**Supersedes:** ADR-104 §1 (run-once). ADR-104 §2 — the observer as the
primary path, the native scroll timeline behind an opt-in — stands.
**Superseded by:** —

## Context

> the late loading effects should be 2 way — when we scroll down then also
> show the late loading & when we scroll up then also show the late loading
> effects. the menu should also show the late loading for the whole site

ADR-104 is three weeks old and chose the opposite. Its argument was sound and
is worth restating rather than quietly dropping: the native
`animation-timeline: view()` path is a FUNCTION of scroll position, so a band
of text sits part-way faded for the whole time it crosses the viewport, and
a paragraph that dims when a reader scrolls back to re-read it is the
animation asserting itself over the words. ADR-104 replaced it with an
observer that fired once and unobserved.

The owner has now asked for the two-way behaviour explicitly. This ADR records
that as a trade made the other way, not as a discovery that ADR-104 was wrong.

## Decision

**1. The observer keeps watching, and `.is-visible` comes off again.** No
`unobserve`. An element animates in whichever direction the reader met it
from, and animates out when it leaves.

**2. Two thresholds, not one, and the asymmetry is the whole design.**

- ARRIVING needs the element's own threshold (0.15 by default) — enough of it
  on screen to be worth animating.
- LEAVING needs `intersectionRatio === 0` — gone completely. Anything partly
  on screen stays put, however little of it there is.

A single threshold for both directions has a failure the run-once version
could never reach: an element TALLER than the viewport can never show 15% of
itself, so it would either flicker at the boundary or — worse — fade out from
under a reader still in the middle of it. Both ratios have to be registered in
the `threshold` array, because that array is the set of ratios that fire a
callback, not a filter applied to one.

**3. `rootMargin` becomes symmetric** (`-10% 0px -10% 0px`). The one-way
`0px 0px -10% 0px` delayed arrival from below, which is right, and did nothing
on the way up, so an element re-entering through the top snapped in at the
very edge of the viewport.

**4. The header gets an entrance, and it is an ANIMATION, not a `.reveal`.**
"The menu should also show the late loading" cannot be served by the observer:
the header is `position: sticky` and therefore never leaves the viewport, so
`.is-visible` would be added on the first frame and never removed. What is
wanted is an entrance on page load, which is what an animation IS.
`.header-enter` is applied to the `<header>` INSIDE `StickyHeaderShell`, never
to the shell itself — a transform on the sticky element's own wrapper is how a
sticky bar stops sticking. The final keyframe is `transform: none`, so no
containing block survives the 450ms to catch a portalled popup.

It runs once per document load rather than once per navigation, because the
header element persists across client-side routing.

## Consequences

- **The effect is a transition, and that is what makes this nearly free.**
  `globals.css` already declared `transition: opacity, transform` on the
  hidden state, so the same declaration plays the move in reverse. An
  `@keyframes` animation would have needed a second set of frames and would
  restart from the beginning on every re-entry.
- **A `delay` now applies in both directions**, because `transition-delay`
  does. A staggered row therefore un-staggers on the way out, which reads
  correctly — but a large delay would leave one card visibly hanging behind
  its neighbours as the reader scrolls past. `RevealGroup`'s `maxDelay` cap
  existed for the arrival; it governs the exit now too, and that is the reason
  to keep it small.
- **More work per scroll.** Every reveal on the page stays observed for the
  life of the document instead of being dropped after it fires. An
  IntersectionObserver is off the main thread and coalesces its callbacks, so
  the cost is real but small; it is the price of the behaviour, and it is
  worth naming because ADR-104 got it for free.
- ADR-104's reasoning survives where it is still true: the `timeline` opt-in
  is unchanged, and it is still a DIFFERENT effect from this one. Progress-
  driven means part-way faded at every point in between; the observer path is
  always either arriving or arrived.
- `public-design-system.test.tsx`'s run-once test is replaced by its inverse,
  plus the tall-element case, plus an assertion that the target is still
  watched after it arrives — the last is the one that catches an `unobserve`
  creeping back in, which only shows up on the SECOND arrival.
- Owed to Module 14: nothing new. Every assertion here is unit-testable and
  is tested; the reduced-motion escape (`prefers-reduced-motion` skips the
  whole island) is unchanged and already covered.
