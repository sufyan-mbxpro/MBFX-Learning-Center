# ADR-095 — The homepage streams band by band

- **Status:** Accepted
- **Date:** 2026-09-14
- **Module:** 12 (public site), 14 (hardening)
- **Supersedes:** nothing. **Extends:** ADR-004 (Cache Components) and ADR-018
  rule 2 (scroll reveal).

## Context

changes-28's brief closes with: "when the page is scrolling down the section
should load from the bottom with premium late loading effects — do not load the
whole page at once on loading."

Half of that already exists. ADR-018 rule 2's `Reveal` gives every band a
scroll-driven entrance, native where `animation-timeline: view()` is supported
and behind one observer island where it is not, and content is visible in the
server HTML and stays visible when JS never runs.

The other half did not. `page.tsx` rendered every enabled section as a sibling
in one tree with no Suspense boundary anywhere, so the document was exactly as
slow as its slowest section: React cannot flush the shell until the last
awaited read resolves. With changes-28 adding two more bands, the homepage now
holds twelve, each awaiting at least one `@repo/core` read.

## Decision

**1. One `<Suspense>` per band, below the fold.** Every enabled section after
the first two renders inside its own boundary, so the page streams band by band
instead of arriving whole. On a warm cache every band resolves immediately and
no fallback paints; it is the cold cache, and any uncached read inside a band,
that this is for.

**2. The first two bands render eagerly.** They are what a visitor sees before
scrolling, and a skeleton replaced before the reader's eye has settled is a
flash, not a progressive load.

**3. The fallback is shaped, and it occupies the band's real height.** A
zero-height fallback lets the page settle and then shoves the footer down as
each section resolves — layout shift at the bottom of every scroll, which is
the thing streaming is supposed to avoid rather than cause.

**4. The fallback paints the band's OWN tone, and the tone lives beside the
component.** A muted band whose placeholder is white flashes a stripe that then
disappears, which reads as a bug rather than as loading. `SECTION_PENDING` sits
in `_sections/registry.ts` next to `SECTION_COMPONENTS`, so a band and its
pending shape are declared in one file and a key with no entry falls back to a
default band — exactly as a key with no component falls back to the "coming
soon" stub.

**5. One generic skeleton, not twelve.** A heading block plus a row of card
placeholders stands in for every band on this page. A per-section skeleton
would be twelve more components to keep in sync with twelve layouts, and would
drift the first time one of them changed. The `cards` count and the tone are
the two knobs that matter.

**6. An eager band is wrapped in a `Fragment`, never an element.** `main` is a
flex column: an extra `<div>` between it and a full-bleed `Section` becomes the
flex item and collapses the band's background to content width.

**7. The skeleton is `aria-hidden` and is NOT a live region.** The reader is
not waiting on an action they took, they are scrolling a page that is still
arriving. A `role="status"` announcing "loading" twelve times is noise.

## Consequences

- The homepage's first paint no longer waits on its slowest query. A band that
  needs the database while its cache entry is cold delays only itself.
- `Reveal` and Suspense compose without either knowing about the other: the
  band streams in, then reveals on entry. Both already degrade correctly
  without JS — `Reveal`'s content is visible in the HTML, and a Suspense
  fallback is replaced by the server-streamed content.
- Twelve boundaries is twelve more places a render error is caught locally
  rather than taking the page with it. Not the reason for the change, but a
  real property of it.
- `EAGER_SECTIONS` is a number, not a per-key flag. If the seeded order changes
  so that the first two bands are cheap and the third is the hero, the constant
  is the one thing to revisit.
