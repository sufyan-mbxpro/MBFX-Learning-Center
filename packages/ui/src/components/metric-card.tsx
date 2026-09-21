import * as React from "react";

import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { MetaText, StatLabel, StatUnit, StatValue } from "@repo/ui/components/typography";
import { cn } from "@repo/ui/lib/utils";

// changes-20 / ADR-072 (tokens.md §6.11) — the reference's dashboard metric
// card ("Total Users 1,328 · new · Last month"). A composition of Card and
// the type roles, so it cannot drift from either. Distinct from the public
// `StatCard`, which is an animated counter for marketing bands.
//
//   header   StatLabel ··········· icon (16px, muted or a status ink)
//   content  StatValue [unit]
//            meta line (trend glyph + delta + context)
//            optional detail line (11px)
//            footer pinned to the bottom (progress + caption / action)

function MetricCard({
  label,
  icon,
  value,
  unit,
  meta,
  detail,
  footer,
  watermark,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  icon?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** "new · Last month", or a trend: `<TrendingUp/> +26.3% vs previous period`. */
  meta?: React.ReactNode;
  /** A finer line under the meta row, at 11px. */
  detail?: React.ReactNode;
  /** Pinned to the bottom of the card: a progress bar and its caption, or an action. */
  footer?: React.ReactNode;
  /**
   * A large, faint glyph in the card's bottom inline-end corner (changes-43).
   * Decoration only: it is rendered `aria-hidden`, so pass the same icon the
   * header already names. `isolate` on the card plus `-z-10` here keeps it
   * above the card's own fill and beneath every word.
   */
  watermark?: React.ReactNode;
}) {
  return (
    <Card
      data-slot="metric-card"
      className={cn("gap-0", watermark && "relative isolate", className)}
      {...props}
    >
      {watermark && (
        <span
          data-slot="metric-card-watermark"
          aria-hidden
          className="pointer-events-none absolute -end-3 -bottom-3 -z-10 text-primary opacity-15 [&_svg]:size-24 [&_svg]:stroke-1"
        >
          {watermark}
        </span>
      )}
      <CardHeader className="flex flex-row items-center justify-between pb-2 [&_svg]:size-4 [&_svg]:shrink-0">
        <StatLabel>{label}</StatLabel>
        {icon}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <StatValue>
          {value}
          {unit && <StatUnit>{unit}</StatUnit>}
        </StatValue>
        {meta && (
          <MetaText
            render={<div />}
            className="flex flex-wrap items-center gap-x-1 [&_svg]:size-3 [&_svg]:shrink-0"
          >
            {meta}
          </MetaText>
        )}
        {detail && <MetaText className="mt-1 text-2xs">{detail}</MetaText>}
        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}

export { MetricCard };
