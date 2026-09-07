"use client";

// Public design system — a scroll-snap carousel (ADR-018).
//
// Rule 1 (zero new runtime dependencies for motion) and rule 2 (animated
// content is present and usable in the server HTML) between them decide the
// whole shape of this component:
//
//   The TRACK is an ordinary `overflow-x` scroll container with CSS scroll
//   snapping. With JS disabled, or before hydration, it is already a
//   complete, scrollable, keyboard-reachable list of cards — no slide is
//   hidden, nothing is `opacity: 0`, and a crawler sees every item.
//
//   The CLIENT ISLAND adds only what CSS cannot express: which slide is
//   current, whether either end has been reached, and arrow/dot controls
//   that jump to a slide. Every one of those is an enhancement over a
//   surface that already works without it.
//
// No autoplay, deliberately. An auto-advancing carousel needs a pause
// control to satisfy WCAG 2.2.2, it fights the reduced-motion guarantee the
// rest of this file makes, and it moves content out from under the pointer.
// The peek of the next card is the affordance instead.
//
// RTL: navigation goes through `scrollIntoView({ inline: "start" })`, and
// `inline` is a LOGICAL axis — it needs no `[dir]` branch. The arithmetic
// alternative (`scrollLeft += width`) would need one, and worse: the sign
// and origin of `scrollLeft` in RTL is the classic cross-engine trap.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Children } from "react";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

// Control palettes per surface. See the `tone` prop's doc comment for why
// this is a correctness concern rather than a decorative one.
const CONTROL_TONE = {
  default: {
    button: "outline",
    dot: "bg-border hover:bg-primary-interactive/60",
    dotActive: "bg-primary-interactive",
  },
  inverted: {
    button: "ghost",
    dot: "bg-secondary-foreground/25 hover:bg-secondary-foreground/50",
    dotActive: "bg-secondary-foreground",
  },
} as const;

// The arrows on an inverted band: a tinted disc with the derived foreground,
// mirroring the footer's social buttons. Kept out of Button's own variants —
// this is one surface's treatment, not a new variant every call site should
// be offered.
const INVERTED_BUTTON_CLASS =
  "bg-secondary-foreground/10 text-secondary-foreground ring-1 ring-secondary-foreground/20 ring-inset hover:bg-secondary-foreground/20 hover:text-secondary-foreground";

function Carousel({
  label,
  previousLabel,
  nextLabel,
  /**
   * One accessible name per slide, in order. Strings rather than a
   * `(index) => string` formatter because this is a client component whose
   * props cross the server/client boundary — a function is not serializable.
   */
  slideLabels,
  itemClassName = "w-[82%] sm:w-[58%] lg:w-[calc((100%-2.5rem)/3)]",
  tone = "default",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: string;
  previousLabel: string;
  nextLabel: string;
  slideLabels?: readonly string[];
  /** Per-slide width. Defaults to "one and a bit" → three across on desktop. */
  itemClassName?: string;
  /**
   * Which surface the controls sit on.
   *
   * Not a styling preference — a correctness switch. The default palette
   * (`--border`, `--primary-interactive`, Button's `outline`) is derived for
   * legibility against `--background`. Dropped onto a `Section tone="inverted"`
   * band those tokens are computed against the wrong surface, and the dots in
   * particular go very nearly invisible.
   *
   * `inverted` swaps them for opacities of `--secondary-foreground`, which is
   * derived readable ON `--secondary` by construction (ADR-003) — the same
   * idiom the footer uses throughout for exactly this reason.
   */
  tone?: keyof typeof CONTROL_TONE;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const palette = CONTROL_TONE[tone];
  const inverted = tone === "inverted";

  const trackRef = useRef<HTMLUListElement>(null);
  const itemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const [visible, setVisible] = useState<readonly number[]>([]);

  // One observer rooted ON the track, so "visible" means "inside the
  // viewport of the carousel", not of the page. 0.6 rather than 1 — a slide
  // clipped by a pixel of sub-pixel rounding is still the slide you are
  // looking at, and at threshold 1 the last item never reports as reached.
  useEffect(() => {
    const track = trackRef.current;
    // Fail open — same guard as ScrollToTop/Counter: no observer means the
    // controls stay usable rather than the component rendering dead.
    if (!track || typeof IntersectionObserver === "undefined") return;

    const items = itemsRef.current.filter((el): el is HTMLLIElement => el !== null);
    if (items.length === 0) return;

    const seen = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting) seen.add(index);
          else seen.delete(index);
        }
        // `.sort()`, not `.toSorted()` — @repo/ui's `lib` predates ES2023,
        // and the spread has already made the copy that mattered.
        setVisible([...seen].sort((a, b) => a - b));
      },
      { root: track, threshold: 0.6 },
    );
    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, [count]);

  const active = visible[0] ?? 0;
  const perPage = Math.max(visible.length, 1);
  // Before the first observer callback (and with no observer at all) the
  // carousel is at rest at slide 0: previous is unavailable, next is not.
  const atStart = visible.length === 0 || visible.includes(0);
  const atEnd = visible.length > 0 && visible.includes(count - 1);

  const goTo = useCallback(
    (index: number) => {
      const target = itemsRef.current[Math.min(Math.max(index, 0), count - 1)];
      if (!target) return;
      // `block: "nearest"` keeps the page from scrolling vertically to a
      // carousel that is already on screen — which it always is, since the
      // click came from a control inside it.
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        inline: "start",
        block: "nearest",
      });
    },
    [count],
  );

  return (
    <div
      data-slot="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      {/*
        `tabIndex={0}`: a scrollable region must be reachable by keyboard, and
        once focused the browser's own arrow-key scrolling is direction-aware
        for free — which is why there is no keydown handler here duplicating
        (and fighting) it.

        The negative margin + matching padding give focus rings and the hover
        lift room to render without being clipped by `overflow-x`.
      */}
      <ul
        ref={trackRef}
        tabIndex={0}
        className="carousel-track -mx-2 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-ps-2 px-2 py-2 focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {slides.map((slide, index) => (
          <li
            // Slide order is fixed by the destination registry and never
            // reorders, so the index is a stable identity here.
            key={index}
            ref={(el) => {
              itemsRef.current[index] = el;
            }}
            data-index={index}
            role="group"
            aria-roledescription="slide"
            aria-label={slideLabels?.[index]}
            className={cn("shrink-0 snap-start", itemClassName)}
          >
            {slide}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={palette.button}
            size="icon-lg"
            shape="pill"
            className={inverted ? INVERTED_BUTTON_CLASS : undefined}
            aria-label={previousLabel}
            disabled={atStart}
            onClick={() => goTo(active - perPage)}
          >
            <ChevronLeft aria-hidden className="rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant={palette.button}
            size="icon-lg"
            shape="pill"
            className={inverted ? INVERTED_BUTTON_CLASS : undefined}
            aria-label={nextLabel}
            disabled={atEnd}
            onClick={() => goTo(active + perPage)}
          >
            <ChevronRight aria-hidden className="rtl:rotate-180" />
          </Button>
        </div>

        {/*
          Dots are both the position readout and the jump control. On the
          default surface the active one is `--primary-interactive`, never raw
          `--primary`: a 6px dot is a thin element, which is exactly what
          ADR-018 rule 5 reserves the derived sibling for. On an inverted band
          neither is safe — see the `tone` prop.
        */}
        <ul className="flex flex-1 items-center gap-2">
          {slides.map((_, index) => (
            <li key={index} className="contents">
              <button
                type="button"
                aria-label={slideLabels?.[index]}
                aria-current={index === active ? "true" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-(--duration-base) ease-(--ease-out-quint) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  palette.dot,
                  index === active ? cn("w-8", palette.dotActive) : "w-3",
                )}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { Carousel };
