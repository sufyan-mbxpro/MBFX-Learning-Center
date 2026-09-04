"use client";

// The "tiny client observer" ADR-018 rule 2 requires — one instance per
// PAGE (mounted once, in a root layout), not one per <Reveal>. A Next.js
// file can only carry one "use client" directive for the whole module, so
// this is a sibling file to reveal.tsx (server), not a second export in it.
//
// Its only job: browsers WITHOUT native `animation-timeline: view()`
// support need SOMETHING to both hide reveal targets initially and unhide
// them on scroll — CSS alone can't do the unhide part without a timeline.
// Browsers WITH native support need nothing from this component at all;
// it does no work there, by design (the CSS `@supports` gate already
// handles them, and skipping the observer avoids the cost).
//
// Renders nothing. Mount once near the root, e.g. the public layout.
import { useEffect } from "react";

function RevealObserver() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    if (window.CSS?.supports?.("animation-timeline: view()")) return;
    // No observer available to ever add .is-visible back — setting
    // data-reveal-js without one would strand every <Reveal> hidden
    // forever, which is exactly the failure ADR-018 rule 2 forbids. Fail
    // open: skip the fallback path entirely rather than risk that.
    if (typeof IntersectionObserver === "undefined") return;

    const root = document.documentElement;
    root.setAttribute("data-reveal-js", "");

    const targets = document.querySelectorAll(".reveal, .image-wipe");
    if (targets.length === 0) {
      root.removeAttribute("data-reveal-js");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    for (const target of targets) observer.observe(target);

    return () => {
      observer.disconnect();
      root.removeAttribute("data-reveal-js");
    };
  }, []);

  return null;
}

export { RevealObserver };
