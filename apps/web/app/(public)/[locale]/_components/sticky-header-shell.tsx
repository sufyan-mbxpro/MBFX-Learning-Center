"use client";

// The sticky wrapper around the whole header stack, and the one thing that
// knows how tall that stack actually is (ADR-065 §5).
//
// A second sticky bar — the Learn area's section tabs — has to start where
// this one ends, and that number is not a constant: the announcement bar and
// the top bar are settings, either can be dismissed at runtime, and the nav
// row wraps on a narrow viewport. `top-16` would be correct for exactly one
// configuration and silently wrong for the rest, hiding the second bar behind
// the first.
//
// So the wrapper measures itself and publishes the result as `--header-offset`
// on the document element. The CSS default (`packages/ui/src/styles/globals.css`)
// is the header's own height, which is right for the first paint and for the
// case where JavaScript never runs — the bar is then a few pixels off only
// when the announcement bar is switched on, and only until hydration.
//
// A client component rather than an inline script: this needs a live
// ResizeObserver, not a one-shot value at first paint, and code-style.md #20
// forbids the script anyway.
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

export function StickyHeaderShell({ sticky, children }: { sticky: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;

    // A non-sticky header scrolls away, so nothing below it should be offset:
    // the correct value in that configuration is zero, not the height.
    const publish = () => {
      const height = sticky ? Math.round(element.getBoundingClientRect().height) : 0;
      root.style.setProperty("--header-offset", `${height}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      // Back to the stylesheet default rather than to a stale measurement —
      // the next layout may not have a header at all.
      root.style.removeProperty("--header-offset");
    };
  }, [sticky]);

  return (
    <div ref={ref} className={cn(sticky && "sticky top-0 z-40")}>
      {children}
    </div>
  );
}
