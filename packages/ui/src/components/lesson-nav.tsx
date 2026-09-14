// Previous / next lesson (changes-11 §9.2, §9.3; redesigned changes-24).
//
// Three things make this a component rather than two links:
//
//   1. **RTL.** The arrows point along the reading direction, not left/right.
//      `rtl:rotate-180` on the glyph plus logical properties everywhere is the
//      whole of it (code-style.md #3) — plan §10 names lesson-nav arrows as
//      one of the three highest-risk RTL surfaces in this area.
//   2. **The mobile pin.** Below `md` the bar pins to the bottom of the
//      viewport (§9.3), which needs a backdrop and a safe-area inset that no
//      caller should have to remember.
//   3. **The asymmetry.** The two steps are not equal and the design says so
//      (ADR-082 #3): back is an outline card, forward is the filled one.
//
// **Why these are cards and not two `Button`s.** A Button is
// `whitespace-nowrap` with a fixed height, so a lesson title inside one had to
// `truncate` on a single line, and the pair — each `flex-1` — came out as two
// wide, flat, half-height slabs whose only emphasis was a `text-xs opacity-80`
// eyebrow. Faint ink on a brand ground is exactly the pairing ADR-018 rule 5
// and ADR-073 exist to stop, and it was carrying the label that says which way
// the reader is going. Size now separates the eyebrow from the title
// (`text-2xs` caps against `text-base` semibold) instead of opacity, so every
// string on the filled card sits at full `--primary-foreground`.
//
// A missing neighbour renders an empty cell rather than nothing, so "Next"
// stays at the end of the bar on the first lesson instead of jumping to the
// start.
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

export interface LessonNavTarget {
  href: string;
  title: string;
}

/** The eyebrow every cell shares: small caps, never a dimmed body size. */
const EYEBROW = "text-2xs font-semibold tracking-caps uppercase";
/** Two lines of title in flow, one in the pinned bar where height is scarce. */
const TITLE = "line-clamp-2 text-sm leading-snug font-semibold max-md:line-clamp-1 md:text-base";
/** The chevron's disc — the affordance that says "button", at both densities. */
const DISC = "flex size-9 shrink-0 items-center justify-center rounded-full md:size-10";

export function LessonNav({
  previous,
  next,
  labels,
  className,
}: {
  previous?: LessonNavTarget | null;
  next?: LessonNavTarget | null;
  labels: { previous: string; next: string; navAria: string };
  className?: string;
}) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label={labels.navAria}
      className={cn(
        "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2",
        // Pinned below md, where the two cells sit side by side in a row
        // rather than stacking a 200px-tall bar over the article.
        // `pb-(--safe-area-bottom-3)` keeps it clear of the home indicator.
        "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:flex max-md:border-t max-md:bg-background/95 max-md:p-3 max-md:pb-(--safe-area-bottom-3) max-md:backdrop-blur",
        className,
      )}
    >
      {previous ? (
        <a
          href={previous.href}
          className="group card-hover hover-lift flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-3 no-underline transition-colors duration-(--duration-base) hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:p-4"
        >
          <span
            className={cn(
              DISC,
              "border bg-muted/60 text-muted-foreground transition-colors duration-(--duration-base) group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary-interactive",
            )}
          >
            <ChevronLeft aria-hidden className="size-4 rtl:rotate-180 md:size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cn(EYEBROW, "text-muted-foreground")}>{labels.previous}</span>
            <span className={TITLE}>{previous.title}</span>
          </span>
        </a>
      ) : (
        // Holds the column so "Next" does not slide to the start of the bar on
        // the first lesson of a course.
        <span aria-hidden className="hidden flex-1 sm:block" />
      )}

      {next ? (
        <a
          href={next.href}
          className="group sheen hover-lift flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-primary p-3 text-primary-foreground no-underline shadow-sm transition-colors duration-(--duration-base) hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:p-4"
        >
          <span className="flex min-w-0 flex-1 flex-col items-end gap-0.5 text-end">
            <span className={EYEBROW}>{labels.next}</span>
            <span className={TITLE}>{next.title}</span>
          </span>
          <span className={cn(DISC, "bg-primary-foreground/15 ring-1 ring-primary-foreground/30")}>
            <ChevronRight aria-hidden className="hover-arrow size-4 rtl:rotate-180 md:size-5" />
          </span>
        </a>
      ) : (
        <span aria-hidden className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}
