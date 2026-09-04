import type { ComponentType } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Card, CardContent } from "@repo/ui/components/card";

export interface DashboardStatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  /** Omit for counts with no meaningful trend (e.g. point-in-time totals). */
  previousValue?: number;
  trendLabel?: string;
  accent?: "primary" | "success" | "info" | "warning";
}

const ACCENTS: Record<NonNullable<DashboardStatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  previousValue,
  trendLabel,
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

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</span>
          {trend != null && trendLabel && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend > 0 && "text-success",
                trend < 0 && "text-destructive",
                trend === 0 && "text-muted-foreground",
              )}
            >
              {trend > 0 ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : trend < 0 ? (
                <TrendingDown className="size-3.5" aria-hidden />
              ) : (
                <Minus className="size-3.5" aria-hidden />
              )}
              {trend > 0 ? "+" : ""}
              {trend}% {trendLabel}
            </span>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", ACCENTS[accent])}>
          <Icon className="size-5" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}
