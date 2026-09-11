import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 — the reference's count pill (tokens.md §6.6): the red
// "99+" on a sidebar item and the "999+" on the notification bell. Its own
// component rather than a Badge variant because it carries LOGIC, not just a
// look: it caps the number, hides itself at zero, and knows the bell's
// corner placement.

interface CountBadgeProps extends Omit<React.ComponentProps<"span">, "children"> {
  count: number;
  /** Counts above this render as `{max}+`. The reference uses 99 in the nav and 999 on the bell. */
  max?: number;
  /**
   * `inline` sits in a row (a nav item's trailing slot); `corner` floats
   * over the top-end corner of a positioned parent (the bell).
   */
  placement?: "inline" | "corner";
}

const PLACEMENT = {
  inline: "min-w-5 px-2 py-0.5",
  // Logical inset, so the badge sits on the correct corner in RTL.
  corner: "absolute -top-1.5 -end-1.5 h-4 min-w-4 px-1",
} as const;

function CountBadge({
  count,
  max = 99,
  placement = "inline",
  className,
  ...props
}: CountBadgeProps) {
  // Nothing to announce and nothing to draw — an empty red dot reads as an
  // alert with no content.
  if (count <= 0) return null;
  return (
    <span
      data-slot="count-badge"
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-destructive text-3xs leading-none font-semibold text-destructive-foreground tabular-nums",
        PLACEMENT[placement],
        className,
      )}
      {...props}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

export { CountBadge };
export type { CountBadgeProps };
