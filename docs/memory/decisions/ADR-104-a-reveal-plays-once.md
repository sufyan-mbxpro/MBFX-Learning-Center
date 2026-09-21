# ADR-104: A reveal plays once, and the observer becomes the primary path

**Status:** Accepted
**Date:** 2026-09-15
**Module:** 07 (`@repo/ui`: `Reveal`, `RevealObserver`, the `.reveal-*` CSS)
**Amends:** ADR-018 rule 2 (scroll reveal) — the guarantee is unchanged; which
of its two paths is primary is reversed.
**Superseded by:** —

## Context

ADR-018 rule 2 built the reveal system on native scroll-driven CSS
(`animation-timeline: view()`), with an IntersectionObserver island as the
fallback for browsers that lack it. Its load-bearing guarantee — content is
visible in the server HTML and stays visible when JS never runs — is enforced by
hiding elements only under `[data-reveal-js]`, an attribute the island sets on
mount.

The native path is **progress-driven**. `animation-timeline: view()` maps the
animation to the element's position in the viewport, so it is not an event that
fires; it is a function of scroll position. Scroll back up and the element fades
back out. The observer path is the opposite: it `unobserve`s after the first
intersection, so it fires once and stays.

The two paths therefore behave differently, which was never decided — it is a
consequence of using whichever mechanism each browser had. The changes-31 brief
asks for reveals that run once, and the owner confirmed it (2026-09-15).

## Decision

### 1. Run-once is the behaviour, everywhere

A band animates into place the first time it is reached and stays there. Content
that fades out as a reader scrolls back to re-read it is the animation asserting
itself over the text, which is the opposite of what a restrained system is for.

### 2. The observer becomes the primary path

`RevealObserver` runs wherever motion is allowed, rather than only where the
native timeline is missing. It already unobserves after firing, so run-once is
its natural behaviour and not a new mechanism.

The `@supports (animation-timeline: view())` branch is **retained** for the one
case that genuinely wants progress-driven motion (a parallax or scroll-linked
effect), behind an explicit opt-in on `Reveal`. It is no longer the default.

### 3. The guarantee is unchanged, and is still what the CSS is shaped around

All of it stays inside `prefers-reduced-motion: no-preference`. Elements are
hidden **only** under `[data-reveal-js]`. No JS, no attribute, no hiding.
`RevealObserver` keeps its fail-open guard: if `IntersectionObserver` is
missing, it sets no attribute and skips the fallback entirely, because an
attribute with no observer behind it strands every reveal hidden forever — the
one failure ADR-018 rule 2 forbids outright.

This ADR reverses which path is preferred. It does not touch the invariant.

### 4. Still CSS, still not a motion library

ADR-018 rule 1's CSS-first stance holds. The presets stay classes
(`.reveal-up`, `.reveal-start`, `.reveal-end`, `.reveal-scale`); the observer
adds one class. framer-motion was considered and rejected: it is weight and a
client boundary on every public route, on the path architecture.md #5 exists to
protect, to accomplish what four CSS rules already do.

Keeping the presets as **named classes** is also what lets a future page builder
expose them as a per-section "loading effect" — a class name is data, a
component's props are not.

### 5. Presets, and the one name that stays logical

The vocabulary, mapped from the brief: `up` (fade-up), `fade` (fade-in),
`start`/`end` (slide), `scale` (zoom-in), and `RevealGroup` for stagger, which
delays children by index rather than asking a call site to hand-write a delay
per card.

`start`/`end` are **not** renamed to left/right, for the reason ADR-018 already
recorded: the transform path uses `translateX`, which has no logical axis, so a
literal left/right name would be wrong in half our locales. The RTL flip stays
explicit in the CSS.

`delay`, `duration` and `threshold` become props. `threshold` is the one that
has to reach the ISLAND rather than the element, since an IntersectionObserver
takes it at construction: `Reveal` writes it to a data attribute and the island
builds **one observer per distinct value on the page**. A page almost always has
one. Setting a second on a single card gets that card its own observer, rather
than every other element on the page quietly adopting its value — which is what
"the strictest wins" would have meant, and would have been a surprise at a
distance.

### 6. The opening band is never revealed

Whichever band opens the page holds the LCP element, and it carries no
`Reveal` wrapper. An LCP element behind an animation that starts at
`opacity: 0` is an LCP element that reports its paint when the animation ends.

On the home page that band is the full-height video slider, not the hero
(changes-31): the slider is first, so `priority` sits on its FIRST slide's
cover and the hero below it is `loading="lazy"`. Both still render eagerly
(`EAGER_SECTIONS = 2`, ADR-095) and neither is wrapped.

Two images marked `priority` do not make two things fast — they split one
budget and both arrive late — so the rule is one per page, and
`home-opening.test.ts` holds it across every band in the registry.

This is a rule for any opening band, not an exception for this one.

## Consequences

- **A small always-on client island on every public page.** It is one
  `useEffect`, one observer, no render output — and it was already mounting on
  every browser without native timeline support, which is most of them.
- Reveals now behave identically across browsers, which is worth more than the
  zero-JS purity of the native path on the subset that had it.
- Under reduced motion, nothing changes: the finished state renders immediately,
  as it already did.
- `reveal.test.tsx` gains the three properties that matter: fires once, renders
  visible with no JS, renders finished under reduced motion.
