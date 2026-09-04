// Public design system (ADR-018 rule 2, changes-03-plan.md §4.1). Server
// component — the CSS in globals.css does the actual work (native
// `animation-timeline: view()` where supported, an `[data-reveal-js]`
// fallback where not). This just applies the right classes.
//
// Deliberately NOT `left`/`right` (the plan's own wording): the fallback
// path animates via `translateX`, which has no logical axis, so a literal
// left/right prop would be wrong half the time under RTL. `start`/`end`
// match how .reveal-start/.reveal-end are already defined and flipped
// under [dir="rtl"] in globals.css.
import { cn } from "@repo/ui/lib/utils";

type RevealVariant = "up" | "start" | "end" | "fade" | "scale";

const REVEAL_VARIANT_CLASS: Record<RevealVariant, string> = {
  up: "reveal-up",
  start: "reveal-start",
  end: "reveal-end",
  scale: "reveal-scale",
  fade: "",
};

function Reveal({
  variant = "up",
  delay,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { variant?: RevealVariant; delay?: number }) {
  return (
    <div
      data-slot="reveal"
      className={cn("reveal", REVEAL_VARIANT_CLASS[variant], className)}
      style={
        delay
          ? {
              // animationDelay only affects the (non-view-timeline) fallback
              // meaningfully — a scroll-driven timeline measures progress,
              // not wall-clock time, so this is a best-effort stagger there,
              // not a guarantee. transitionDelay is what the fallback path
              // actually honours.
              animationDelay: `${delay}ms`,
              transitionDelay: `${delay}ms`,
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}

export { Reveal };
