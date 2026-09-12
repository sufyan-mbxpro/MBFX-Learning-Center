import type { ComponentType } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { MetricCard } from "@repo/ui/components/metric-card";

// changes-20 Phase 5: the admin's metric tile is `@repo/ui`'s MetricCard
// (tokens.md §6.11 — label + icon row, bold tabular figure, trend in the
// meta line). This file only computes the trend and picks the inks.

export interface DashboardStatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  /** Omit for counts with no meaningful trend (e.g. point-in-time totals). */
  previousValue?: number;
  /** Reads AFTER the percentage ("vs previous period"), so it renders only with one. */
  trendLabel?: string;
  /**
   * A statement in its own right ("12 published this period"), rendered
   * whether or not a percentage can be computed.
   *
   * The distinction is load-bearing: a previous period of 0 makes the
   * percentage undefined (ADR-085's content cards on a young platform are
   * all 0 → N), and dropping the whole meta line with it deleted the one
   * number that block exists to state.
   */
  note?: string;
  accent?: "primary" | "success" | "info" | "warning";
}

// The icon is a thin 16px glyph on the card, so it takes each hue's
// `-interactive` ink — the raw hue is a fill colour only (ADR-018 rule 5).
const ACCENTS: Record<NonNullable<DashboardStatCardProps["accent"]>, string> = {
  primary: "text-primary-interactive",
  success: "text-success-interactive",
  info: "text-info-interactive",
  warning: "text-warning-interactive",
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  previousValue,
  trendLabel,
  note,
  accent = "primary",
}: DashboardStatCardProps) {
  const trend =
    previousValue == null
      ? null
      : previousValue === 0
        ? value === 0
          ? 0
          : null
        : Math.round(((value - previousValue) / previousValue) * 1000) / 10;

  const trendClass = cn(
    trend != null && trend > 0 && "text-success-interactive",
    trend != null && trend < 0 && "text-destructive-interactive",
  );

  return (
    <MetricCard
      label={label}
      icon={<Icon className={ACCENTS[accent]} aria-hidden />}
      value={value.toLocaleString()}
      meta={
        trend != null && trendLabel ? (
          <>
            {trend > 0 ? (
              <TrendingUp className={trendClass} aria-hidden />
            ) : trend < 0 ? (
              <TrendingDown className={trendClass} aria-hidden />
            ) : (
              <Minus aria-hidden />
            )}
            <span className={cn("font-medium", trendClass)}>
              {trend > 0 ? "+" : ""}
              {trend}%
            </span>
            <span>{trendLabel}</span>
            {note && <span>{note}</span>}
          </>
        ) : note ? (
          <span>{note}</span>
        ) : undefined
      }
    />
  );
}
