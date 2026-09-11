// Previous / next lesson (changes-11 §9.2, §9.3).
//
// Two things make this a component rather than two links:
//
//   1. **RTL.** The arrows point along the reading direction, not left/right.
//      `rtl:rotate-180` on the glyph plus logical properties everywhere is the
//      whole of it (code-style.md #3) — plan §10 names lesson-nav arrows as
//      one of the three highest-risk RTL surfaces in this area.
//   2. **The mobile pin.** Below `md` the bar pins to the bottom of the
//      viewport (§9.3), which needs a backdrop and a safe-area inset that no
//      caller should have to remember.
//
// A missing neighbour renders an empty cell rather than nothing, so "Next"
// stays at the end of the bar on the first lesson instead of jumping to the
// start.
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

export interface LessonNavTarget {
  href: string;
  title: string;
}

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
        "flex items-stretch justify-between gap-3",
        // Pinned below md; a normal block from md up. `pb-[env(safe-area-inset-bottom)]`
        // keeps the bar clear of the home indicator on iOS.
        "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:border-t max-md:bg-background/95 max-md:p-3 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:backdrop-blur",
        className,
      )}
    >
      {previous ? (
        <Button
          variant="outline"
          className="min-w-0 flex-1 justify-start"
          render={<a href={previous.href} />}
        >
          <ChevronLeft data-icon="inline-start" aria-hidden className="rtl:rotate-180" />
          <span className="flex min-w-0 flex-col items-start">
            <span className="text-xs text-muted-foreground">{labels.previous}</span>
            <span className="w-full truncate text-start">{previous.title}</span>
          </span>
        </Button>
      ) : (
        // Holds the column so "Next" does not slide to the start of the bar on
        // the first lesson of a course.
        <span aria-hidden className="flex-1" />
      )}

      {next ? (
        <Button className="min-w-0 flex-1 justify-end" render={<a href={next.href} />}>
          <span className="flex min-w-0 flex-col items-end">
            <span className="text-xs opacity-80">{labels.next}</span>
            <span className="w-full truncate text-end">{next.title}</span>
          </span>
          <ChevronRight data-icon="inline-end" aria-hidden className="rtl:rotate-180" />
        </Button>
      ) : (
        <span aria-hidden className="flex-1" />
      )}
    </nav>
  );
}
