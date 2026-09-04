"use client";

// Public design system (changes-03-plan.md §4.1). The server-rendered
// initial markup already shows the FINAL value (see the JSX below) — no-JS
// and crawler renders are correct on their own; the rAF count-up is a
// post-hydration enhancement, not something content correctness depends on.
import { useEffect, useRef, useState } from "react";

function Counter({
  value,
  prefix = "",
  suffix = "",
  duration = 1500,
  locale,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  locale?: string;
}) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    // Fail open rather than crash — universally supported in target
    // browsers, but not every environment (including this package's own
    // jsdom test runner) implements it.
    if (typeof IntersectionObserver === "undefined") return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || played.current) return;
        played.current = true;
        observer.disconnect();

        setDisplay(0);
        const start = performance.now();
        function tick(now: number) {
          const progress = Math.min((now - start) / duration, 1);
          // Ease-out: fast start, settles into the final value rather than
          // a linear ramp that reads as mechanical for a "counting up" feel.
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} data-slot="counter" className={className} {...props}>
      {prefix}
      {new Intl.NumberFormat(locale).format(display)}
      {suffix}
    </span>
  );
}

export { Counter };
