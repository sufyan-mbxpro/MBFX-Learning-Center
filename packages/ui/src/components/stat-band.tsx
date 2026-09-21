// The reference's `animated-numbers` row (changes-09-plan.md §2) — the
// caption + a row of StatCards, which already own the count-up. This adds
// only the band: rhythm, dividers, and ADR-047 §2's empty rule.
import { Children } from "react";

import { cn } from "@repo/ui/lib/utils";

/**
 * changes-31 (ADR-103): the home facts band is four figures, About's is three.
 * A prop rather than a second component — the band IS the rhythm and the
 * dividers, and those do not change with the count.
 */
const COLUMNS_CLASS = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

function StatBand({
  caption,
  columns = 3,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  /** The small line above the figures ("Figures as of March 2026"). */
  caption?: React.ReactNode;
  columns?: keyof typeof COLUMNS_CLASS;
}) {
  if (Children.count(children) === 0) return null;

  return (
    <div
      data-slot="stat-band"
      className={cn("flex flex-col items-center gap-6", className)}
      {...props}
    >
      {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      {/* divide-x is a border between columns, not a directional utility —
          it flips with the writing mode on its own. */}
      <div
        className={cn(
          "grid w-full grid-cols-1 gap-8 sm:gap-0 sm:divide-x sm:divide-border",
          COLUMNS_CLASS[columns],
        )}
      >
        {children}
      </div>
    </div>
  );
}

export { StatBand };
