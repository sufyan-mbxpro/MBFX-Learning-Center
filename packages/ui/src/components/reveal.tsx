// Public design system (ADR-018 rule 2, amended by ADR-104 and ADR-111).
// Server component — the CSS in globals.css does the actual work and the
// observer island in reveal-observer.tsx switches it on. This just applies
// classes.
//
// ADR-104 made the observer path primary and run-once. ADR-111 kept the path
// and reversed the run-once half at the owner's ask: a reveal now REPLAYS —
// out when the element leaves the viewport entirely, in again when it comes
// back, whichever direction the reader met it from.
//
// The native `animation-timeline: view()` path still survives behind
// `timeline`, and is still a different thing: it is a FUNCTION of scroll
// position, so the element is part-way faded at every point in between. The
// observer path is an event with a transition, so it is always either
// arriving or arrived.
//
// One consequence worth knowing before adding a large `delay`: a delay is a
// `transition-delay`, which CSS applies in both directions. A staggered row
// therefore un-staggers on the way out as well, which reads correctly — but a
// 600ms delay would leave one card visibly hanging behind its neighbours as
// the reader scrolls past. `RevealGroup`'s cap exists for the arrival; it
// governs the exit now too.
//
// Deliberately NOT `left`/`right` (the plan's own wording): the fallback
// path animates via `translateX`, which has no logical axis, so a literal
// left/right prop would be wrong half the time under RTL. `start`/`end`
// match how .reveal-start/.reveal-end are already defined and flipped
// under [dir="rtl"] in globals.css.
import { Children, isValidElement } from "react";

import { cn } from "@repo/ui/lib/utils";

/**
 * The preset vocabulary. Named rather than freeform so a future page builder
 * can offer them as a per-section "loading effect" — a class name is data, a
 * component's props are not (ADR-104 §4).
 *
 * `up` is fade-up, `fade` is fade-in with no movement, `start`/`end` are the
 * logical slides, `scale` is zoom-in.
 */
type RevealVariant = "up" | "start" | "end" | "fade" | "scale";

const REVEAL_VARIANT_CLASS: Record<RevealVariant, string> = {
  up: "reveal-up",
  start: "reveal-start",
  end: "reveal-end",
  scale: "reveal-scale",
  fade: "",
};

interface RevealProps extends React.ComponentProps<"div"> {
  variant?: RevealVariant;
  /** Milliseconds before this element starts. `RevealGroup` sets it per index. */
  delay?: number;
  /** Milliseconds the move takes. Defaults to --duration-slow (450ms). */
  duration?: number;
  /**
   * How much of the element must be in view before it fires, 0–1. Reaches the
   * observer, which creates one observer per distinct value on the page, so
   * setting it on one card does not change anyone else's.
   */
  threshold?: number;
  /**
   * Opt in to the progress-driven native scroll timeline instead of the
   * observer (ADR-104 §2). For scroll-LINKED motion only: this path is a
   * function of scroll POSITION, so the element sits part-way faded while it
   * crosses the viewport, where the observer path is either arriving or
   * arrived.
   */
  timeline?: boolean;
}

function Reveal({
  variant = "up",
  delay,
  duration,
  threshold,
  timeline = false,
  className,
  style,
  ...props
}: RevealProps) {
  return (
    <div
      data-slot="reveal"
      // `.is-visible` is toggled on this element's className by the observer
      // island, OUTSIDE React. The island mounts with the root layout, so on a
      // streamed page it can mark a band before that band's own Suspense
      // boundary hydrates — and React then reports the class it did not
      // render as a mismatch. That write is deliberate, so it is exempted here
      // and only here: the flag covers this element's own attributes, not its
      // children, whose mismatches still report.
      suppressHydrationWarning
      data-reveal-timeline={timeline || undefined}
      data-reveal-threshold={threshold}
      className={cn("reveal", REVEAL_VARIANT_CLASS[variant], className)}
      style={
        delay || duration
          ? {
              // A scroll-driven timeline measures progress, not wall-clock
              // time, so on the `timeline` path these are a best-effort
              // stagger rather than a guarantee. The observer path — the
              // default — is a transition and honours both exactly, in BOTH
              // directions since ADR-111.
              ...(delay ? { animationDelay: `${delay}ms`, transitionDelay: `${delay}ms` } : {}),
              ...(duration
                ? { animationDuration: `${duration}ms`, transitionDuration: `${duration}ms` }
                : {}),
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}

/**
 * A grid or row whose children arrive one after another (ADR-104 §5).
 *
 * Wraps each child in its own `Reveal` with `delay = index * step`, which is
 * the whole of "stagger". Done here rather than in CSS because the delay has
 * to count siblings, and a `:nth-child` ladder would cap at however many rules
 * someone thought to write — a nine-card grid then reveals its last three at
 * once, which reads as a bug rather than as a rhythm.
 *
 * `step` is small on purpose. At 60ms a row of four finishes 180ms after the
 * first card, which the eye reads as one movement with a direction; at 200ms
 * it reads as four separate events and the reader waits for the page.
 *
 * **This component IS the grid.** Pass the grid classes to it — each child is
 * wrapped in a `Reveal` div, and that wrapper is what becomes the grid item.
 * Wrapping a grid's children from the outside instead would make the wrappers
 * the items and collapse every card to one column; `display: contents` is not
 * the escape hatch it looks like, because an element with no box has nothing
 * to fade or translate.
 */
function RevealGroup({
  variant = "up",
  step = 60,
  duration,
  threshold,
  /** Caps the ladder so a long grid's last card is not a second and a half late. */
  maxDelay = 360,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> &
  Pick<RevealProps, "variant" | "duration" | "threshold"> & {
    step?: number;
    maxDelay?: number;
    children: React.ReactNode;
  }) {
  return (
    <div data-slot="reveal-group" className={className} {...props}>
      {Children.map(children, (child, index) =>
        // A falsy child (a conditionally rendered card) must not consume a
        // step, or the ladder develops gaps that look like a dropped element.
        isValidElement(child) ? (
          <Reveal
            variant={variant}
            delay={Math.min(index * step, maxDelay)}
            duration={duration}
            threshold={threshold}
            // The wrapper is the grid item, so it has to fill its track or a
            // card set to `h-full` measures against a shrink-wrapped parent
            // and rows stop lining up. `empty:hidden` because a child that
            // renders null (a signed-in reader's sign-in card) would still
            // leave its wrapper behind as a gap in a flex column.
            className="h-full empty:hidden"
          >
            {child}
          </Reveal>
        ) : (
          child
        ),
      )}
    </div>
  );
}

export { Reveal, RevealGroup };
export type { RevealVariant };
