"use client";

// The reveal island (ADR-018 rule 2, promoted to the PRIMARY path by ADR-104,
// made two-way by ADR-111) — one instance per PAGE, mounted once in a root
// layout, never one per <Reveal>. A Next.js file can only carry one "use
// client" directive for the whole module, so this is a sibling file to
// reveal.tsx (server), not a second export in it.
//
// It does two things:
//
//   1. Sets `data-reveal-js` on <html>, which is the ONLY thing that hides a
//      reveal target. No JS, no attribute, no hiding — content is visible in
//      the server HTML and stays visible when this never runs. That guarantee
//      is unchanged from ADR-018 and is what the CSS is shaped around.
//   2. Adds `.is-visible` when a target arrives and REMOVES it when the target
//      leaves entirely, so a band animates in whichever direction the reader
//      met it from. ADR-104 made this run once and unobserve; ADR-111 reversed
//      that at the owner's ask.
//
// **Two thresholds, not one, and the asymmetry is the whole design.** A single
// threshold used for both directions has a failure the run-once version could
// never hit: an element TALLER than the viewport can never show 15% of itself,
// so it would flicker at the entry boundary, or — worse — a reader part-way
// through a long band would have it fade out from under them. So:
//
//   - ARRIVING needs `threshold` (0.15 by default) — enough of it on screen
//     to be worth animating.
//   - LEAVING needs `intersectionRatio === 0` — gone completely. Anything
//     partly on screen stays put, however little of it there is.
//
// `rootMargin` is symmetric for the same reason. The one-way `0 0 -10% 0`
// delayed arrival from below, which is right, and did nothing on the way up,
// so an element re-entering through the top snapped in at the very edge.
//
// Elements marked `data-reveal-timeline` are skipped entirely — those opted
// into the progress-driven CSS path and must not be touched by this one.
//
// Renders nothing.
import { useEffect } from "react";

/** Matches the CSS default and the observer's own fallback. */
const DEFAULT_THRESHOLD = 0.15;
/** Symmetric: an element arrives, and comes back, the same distance in. */
const ROOT_MARGIN = "-10% 0px -10% 0px";

const TARGET_SELECTOR = ".reveal:not([data-reveal-timeline]), .image-wipe";

function readThreshold(el: Element): number {
  const raw = el.getAttribute("data-reveal-threshold");
  if (raw === null) return DEFAULT_THRESHOLD;
  const parsed = Number(raw);
  // A nonsense value falls back rather than throwing: a bad threshold must
  // not be the reason a band never appears.
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : DEFAULT_THRESHOLD;
}

function RevealObserver() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    // No observer available to ever add .is-visible back — setting
    // data-reveal-js without one would strand every <Reveal> hidden
    // forever, which is exactly the failure ADR-018 rule 2 forbids. Fail
    // open: skip the whole thing rather than risk that.
    if (typeof IntersectionObserver === "undefined") return;

    const root = document.documentElement;
    root.setAttribute("data-reveal-js", "");

    // One observer per distinct threshold, built on demand. A page almost
    // always has one; a page that sets a second on a single card gets a
    // second observer rather than every other element quietly adopting that
    // card's value.
    const observers = new Map<number, IntersectionObserver>();
    const seen = new WeakSet<Element>();

    function observerFor(threshold: number): IntersectionObserver {
      const existing = observers.get(threshold);
      if (existing) return existing;
      return new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.intersectionRatio >= threshold) {
              entry.target.classList.add("is-visible");
            } else if (entry.intersectionRatio === 0) {
              // Gone completely — and only then. Hiding at the ARRIVAL
              // threshold instead is what would tear a long band away from a
              // reader who is still in the middle of it.
              entry.target.classList.remove("is-visible");
            }
          }
        },
        // BOTH thresholds are registered, or the observer is never called at
        // the ratio the exit branch tests for: a threshold list is the set of
        // ratios that fire a callback, not a filter applied to one.
        { threshold: threshold > 0 ? [0, threshold] : [0], rootMargin: ROOT_MARGIN },
      );
    }

    function observe(el: Element) {
      if (seen.has(el)) return;
      seen.add(el);
      const threshold = readThreshold(el);
      const observer = observerFor(threshold);
      observers.set(threshold, observer);
      observer.observe(el);
    }

    for (const el of document.querySelectorAll(TARGET_SELECTOR)) observe(el);

    // Bands stream in band by band under ADR-095, so a reveal can be added to
    // the document long after this effect ran. Without this, every section
    // below the first Suspense boundary would be hidden by `data-reveal-js`
    // and never observed — which is a blank page, not a missing animation.
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((records) => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches(TARGET_SELECTOR)) observe(node);
                for (const nested of node.querySelectorAll(TARGET_SELECTOR)) observe(nested);
              }
            }
          });
    mutations?.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations?.disconnect();
      for (const observer of observers.values()) observer.disconnect();
      root.removeAttribute("data-reveal-js");
    };
  }, []);

  return null;
}

export { RevealObserver };
