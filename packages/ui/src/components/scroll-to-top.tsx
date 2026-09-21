"use client";

// changes-03-plan.md §4.1 — an IntersectionObserver on a sentinel rather
// than a scroll listener, so visibility doesn't recompute on every scroll
// tick. No hardcoded label (code-style.md #2): the caller supplies one from
// its own catalog.
//
// changes-44 #2: the button answers the scroll it offers to undo. A ring
// around it fills with the reader's progress down the page, it flashes as it
// arrives and then keeps a soft glow, and the arrow nudges upward on hover.
// The motion lives in globals.css ("Scroll-to-top") behind
// `prefers-reduced-motion: no-preference`; the ring is progress, not motion,
// so it fills for every reader.
//
// The ring's progress is the one thing that needs the scroll position, so it
// is written straight to a custom property from a passive, rAF-throttled
// listener — no React state, no re-render per scroll tick — and only while the
// button is on screen.
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
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const button = buttonRef.current;
      if (!button) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      button.style.setProperty("--scroll-progress", progress.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [visible]);

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
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-label={label}
        data-slot="scroll-to-top"
        data-visible={visible ? "" : undefined}
        className={cn(
          "group/top fixed end-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary-solid text-primary-solid-foreground shadow-float transition-all duration-(--duration-base) hover:scale-105 hover:bg-primary-solid-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
          className,
        )}
      >
        {/* The progress ring. `pathLength` makes the dash arithmetic a
            percentage whatever the radius. Rotated so it starts at the top. */}
        <svg aria-hidden viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            strokeWidth="2"
            className="stroke-primary-solid-foreground/25"
          />
          <circle
            data-slot="scroll-to-top-progress"
            cx="24"
            cy="24"
            r="22"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            className="stroke-primary-solid-foreground"
          />
        </svg>
        <ArrowUp aria-hidden data-slot="scroll-to-top-arrow" className="relative size-5" />
      </button>
    </>
  );
}

export { ScrollToTop };
