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
// No autoplay BY DEFAULT. An auto-advancing carousel needs a pause control to
// satisfy WCAG 2.2.2, it fights the reduced-motion guarantee the rest of this
// file makes, and it moves content out from under the pointer. The peek of
// the next card is the affordance on a shelf.
//
// `autoplay` is an OPT-IN for a set read one item at a time (the home page's
// testimonials, changes-37, ADR-121 §4), and it carries every one of those
// three objections as a guard rather than as a caveat: it renders a visible
// pause button, it never starts under `prefers-reduced-motion`, and it holds
// still while the pointer is over the carousel, while focus is inside it,
// while it is off screen and while the tab is hidden. It scrolls the TRACK
// only — `scrollIntoView` from a timer would scroll the page too whenever the
// band is part-way out of view, which is a page that moves on its own.
//
// RTL: navigation goes through `scrollIntoView({ inline: "start" })`, and
// `inline` is a LOGICAL axis — it needs no `[dir]` branch. The arithmetic
// alternative (`scrollLeft += width`) would need one, and worse: the sign
// and origin of `scrollLeft` in RTL is the classic cross-engine trap.
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
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

// The `hoverArrows` pair (changes-37): straddling the track's edge — half over
// the slide's own padding, half outside it, so a one-item slide's words are
// never under a chevron — on a
// translucent disc of the page ground so a photograph or a card behind it
// cannot swallow the chevron.
const HOVER_ARROW_CLASS =
  "absolute top-1/2 z-10 -translate-y-1/2 bg-background/90 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-(--duration-base) group-focus-within/carousel:opacity-100 group-hover/carousel:opacity-100 focus-visible:opacity-100";

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
  itemClassName = "w-41/50 sm:w-29/50 lg:w-(--width-slide-3)",
  tone = "default",
  controls = "both",
  controlsAlign = "start",
  autoplay,
  hoverArrows = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /**
   * Advance on a timer (changes-37, ADR-121 §4). Off unless given.
   *
   * An object of strings and a number rather than a boolean, because turning
   * it on is what obliges a pause button, and the button's two names have to
   * come from the caller's catalog. Setting it also makes the carousel LOOP:
   * a timer that stops dead on the last slide is a timer that ran once.
   */
  autoplay?: { interval?: number; pauseLabel: string; playLabel: string };
  /**
   * Previous/next arrows over the track's two edges, shown while the pointer
   * is over the carousel or focus is inside it (changes-37). Additive to
   * `controls`: a touch screen has no hover, so the row under the track stays
   * the control a thumb can reach.
   */
  hoverArrows?: boolean;
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
  /**
   * Which controls render (changes-35, ADR-116 §1).
   *
   * Defaults to `both`, which is what every call site before changes-35 got,
   * so this prop adds a shape rather than changing one. The two narrower
   * settings each say something the default cannot:
   *
   *   `arrows` — the row is a SHELF whose length is not the point. A dot rail
   *     under eight destination cards is eight controls nobody counts, and it
   *     is the widest thing in the band.
   *   `dots` — the row is a SET a reader is expected to step through one at a
   *     time (a testimonial). Position matters; paging by a viewport-full does
   *     not, because a viewport-full is one item.
   *
   * Dropping the dots does NOT drop the position readout from assistive tech:
   * every slide is still a named `group` inside a labelled carousel region,
   * which is what a screen reader announces. It drops a POINTER affordance.
   */
  controls?: "arrows" | "dots" | "both";
  /**
   * Where the control cluster sits under the track.
   *
   * `start` is the original: controls flush to the track's inline start, dots
   * filling the rest of the row. `center` is the reference's placement for a
   * shelf — two arrows centred under the row, which reads as "there is more of
   * this" rather than as a control panel bolted to one corner.
   */
  controlsAlign?: "start" | "center";
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

  // ── Autoplay (opt-in, ADR-121 §4) ───────────────────────────────────────
  const loop = autoplay !== undefined;
  const regionRef = useRef<HTMLDivElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (!loop) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const onMotion = () => setReducedMotion(media.matches);
    media.addEventListener("change", onMotion);
    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);

    // Fail CLOSED here, unlike the slide observer above: without an observer
    // there is no knowing whether the carousel is on screen, and motion nobody
    // can see is motion that surprises whoever scrolls to it.
    const region = regionRef.current;
    let observer: IntersectionObserver | null = null;
    if (region && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
        threshold: 0.5,
      });
      observer.observe(region);
    }
    return () => {
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, [loop]);

  const playing =
    loop &&
    count > 1 &&
    !userPaused &&
    !reducedMotion &&
    !hovering &&
    !focusWithin &&
    inView &&
    pageVisible;

  // The TRACK scrolls, never the page. A bounding-rect delta is a physical
  // distance, so `scrollBy` needs no branch on the sign or origin of
  // `scrollLeft` in RTL — only on which edge is the inline start.
  const scrollTrackTo = useCallback((index: number) => {
    const track = trackRef.current;
    const target = itemsRef.current[index];
    if (!track || !target) return;
    const style = getComputedStyle(track);
    const inset = Number.parseFloat(style.scrollPaddingInlineStart) || 0;
    const slide = target.getBoundingClientRect();
    const box = track.getBoundingClientRect();
    const delta =
      style.direction === "rtl"
        ? slide.right - (box.right - inset)
        : slide.left - (box.left + inset);
    track.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  // A timeout re-armed on every slide change, not an interval: a reader who
  // steps to a slide by hand gets the full interval on it before it moves.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => scrollTrackTo(active + 1 >= count ? 0 : active + 1),
      autoplay?.interval ?? 6000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, active, count, autoplay?.interval, scrollTrackTo]);

  // Looping arrows wrap instead of disabling at either end.
  const previous = () => goTo(loop && atStart ? count - 1 : active - perPage);
  const next = () => goTo(loop && atEnd ? 0 : active + perPage);

  return (
    <div
      ref={regionRef}
      data-slot="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("group/carousel flex flex-col gap-6", className)}
      onPointerEnter={loop ? () => setHovering(true) : undefined}
      onPointerLeave={loop ? () => setHovering(false) : undefined}
      onFocus={loop ? () => setFocusWithin(true) : undefined}
      onBlur={
        loop
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setFocusWithin(false);
              }
            }
          : undefined
      }
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
      {/* `relative` for the hover arrows, and `flex grow flex-col` so the
          track below still takes a caller-given height (see its own `grow`). */}
      <div className="relative flex grow flex-col">
        <ul
          ref={trackRef}
          tabIndex={0}
          // A region that changes on its own is announced politely only when a
          // reader has stopped it — a live region that speaks every six seconds
          // is noise over whatever else they are reading.
          aria-live={loop ? (playing ? "off" : "polite") : undefined}
          // `grow`, not `flex-1`: grow-1 with basis AUTO. A caller that gives the
          // carousel a height (the home page's browse column, which has to match
          // its two neighbours) gets the surplus in the TRACK, so the slides fill
          // it and the controls sit on the bottom edge. With no height given
          // there is no surplus and this is inert — which is why it is safe
          // unconditionally, where `flex-1`'s `basis-0` would collapse every
          // existing track to nothing.
          className="carousel-track -mx-2 flex grow snap-x snap-mandatory gap-5 overflow-x-auto scroll-ps-2 px-2 py-2 focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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

        {hoverArrows && count > 1 && (
          // Over the track's two edges, vertically centred. Invisible at rest and
          // revealed by hovering the carousel or focusing anything inside it —
          // `focus-visible:opacity-100` on the button itself covers a keyboard
          // user tabbing straight onto a hidden arrow.
          //
          // An arrow that cannot move is ABSENT rather than disabled: a disabled
          // button fading in on hover is a control that announces itself and
          // then does nothing. A looping carousel never has one.
          <>
            {(loop || !atStart) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={previousLabel}
                onClick={previous}
                className={cn("-start-3", HOVER_ARROW_CLASS)}
              >
                <ChevronLeft aria-hidden className="rtl:rotate-180" />
              </Button>
            )}
            {(loop || !atEnd) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={nextLabel}
                onClick={next}
                className={cn("-end-3", HOVER_ARROW_CLASS)}
              >
                <ChevronRight aria-hidden className="rtl:rotate-180" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* A single-slide track has nothing to navigate to: both arrows would be
          permanently disabled and the dot rail would be one dot that is
          already current. Rendering nothing is the rule `MetricRow` applies to
          an empty group — a control that cannot do anything is not an
          affordance, and a disabled one still costs a tab stop's worth of
          explaining.

          Conditional rendering rather than a `hidden` class throughout this
          block: `display: none` would keep eight dead dot buttons in the
          payload and in the DOM of a band that asked for arrows only. */}
      {count > 1 && (
        <div
          className={cn("flex items-center gap-4", controlsAlign === "center" && "justify-center")}
        >
          {controls !== "dots" && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={palette.button}
                size="icon-lg"
                className={inverted ? INVERTED_BUTTON_CLASS : undefined}
                aria-label={previousLabel}
                disabled={!loop && atStart}
                onClick={previous}
              >
                <ChevronLeft aria-hidden className="rtl:rotate-180" />
              </Button>
              <Button
                type="button"
                variant={palette.button}
                size="icon-lg"
                className={inverted ? INVERTED_BUTTON_CLASS : undefined}
                aria-label={nextLabel}
                disabled={!loop && atEnd}
                onClick={next}
              >
                <ChevronRight aria-hidden className="rtl:rotate-180" />
              </Button>
            </div>
          )}

          {/*
          Dots are both the position readout and the jump control. On the
          default surface the active one is `--primary-interactive`, never raw
          `--primary`: a 6px dot is a thin element, which is exactly what
          ADR-018 rule 5 reserves the derived sibling for. On an inverted band
          neither is safe — see the `tone` prop.
        */}
          {controls !== "arrows" && (
            <ul
              className={cn(
                "flex items-center gap-2",
                // `flex-1` is what pushes the dot rail across the band beside a
                // start-aligned arrow pair. Centred, it would push the arrows off
                // centre by half the rail's own width, so the rail sizes to
                // content there instead.
                controlsAlign === "start" && "flex-1",
              )}
            >
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
          )}

          {/* WCAG 2.2.2: content that moves on its own for more than five
              seconds needs a way to stop it that does not depend on keeping a
              pointer parked over it. It names the state it will CHANGE TO,
              the way a media player's button does. */}
          {autoplay && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={userPaused ? autoplay.playLabel : autoplay.pauseLabel}
              onClick={() => setUserPaused((paused) => !paused)}
              className={cn(
                "text-muted-foreground",
                inverted && "text-secondary-foreground/70 hover:text-secondary-foreground",
              )}
            >
              {userPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { Carousel };
