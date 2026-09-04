"use client";

// changes-03-plan.md §4.1 — an IntersectionObserver on a sentinel rather
// than a scroll listener, so visibility doesn't recompute on every scroll
// tick. No hardcoded label (code-style.md #2): the caller supplies one from
// its own catalog.
import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

function ScrollToTop({
  label,
  threshold = 480,
  className,
}: {
  label: string;
  threshold?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fail open — see counter.tsx's identical guard.
    if (typeof IntersectionObserver === "undefined") return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry ? !entry.isIntersecting : false),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleClick() {
    const smooth = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <>
      {/* Marks the scroll position past which the button appears — not
          rendered content, so it carries no visual size beyond a 1px hook
          for the observer. */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="pointer-events-none absolute start-0 size-px"
        style={{ insetBlockStart: threshold }}
      />
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        data-slot="scroll-to-top"
        className={cn(
          "fixed end-6 bottom-6 z-40 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-all duration-(--duration-base) hover:bg-primary-hover active:bg-primary-active",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
          className,
        )}
      >
        <ArrowUp aria-hidden className="size-4" />
      </button>
    </>
  );
}

export { ScrollToTop };
