"use client";

// A labelled progress bar (changes-11 §9.2).
//
// `Progress` is the bare track. This adds the two things plan §10 requires of
// every progress readout in the learning area and that a bare track cannot
// carry: a VISIBLE "7 of 20 lessons" count, and an accessible name — because a
// bar announced only as "45%" tells a screen-reader user the fraction but not
// what it is a fraction OF.
//
// Both label strings are required props: a public component holds no catalog
// (code-style.md #2), so the caller supplies already-translated text.
import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";

export function ProgressBar({
  value,
  total,
  label,
  countLabel,
  percentLabel,
  className,
}: {
  /** Completed units. Clamped into [0, total] — a denormalised counter that
   * has drifted must not render a bar wider than its track. */
  value: number;
  total: number;
  /** The accessible name, e.g. "Course progress". */
  label: string;
  /** The visible count, e.g. "7 of 20 lessons". */
  countLabel: string;
  /** The visible percentage, already formatted for the locale. */
  percentLabel: string;
  className?: string;
}) {
  const safeTotal = Math.max(0, total);
  const safeValue = Math.min(Math.max(0, value), safeTotal);
  const percent = safeTotal === 0 ? 0 : Math.round((safeValue / safeTotal) * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{countLabel}</span>
        <span className="font-medium tabular-nums">{percentLabel}</span>
      </div>
      {/* Base UI's Progress emits role="progressbar" with aria-valuenow /
          -valuemin / -valuemax from `value` and `max`; `aria-label` is what
          gives that node a name. */}
      <Progress value={percent} max={100} aria-label={label} />
    </div>
  );
}
