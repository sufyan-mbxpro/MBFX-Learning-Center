"use client";

// Recharts is an admin-only dependency (architecture.md #5 — "chart-config
// UI" is named alongside Tiptap/TanStack Table) — this file, and everything
// that imports it, must never be reachable from app/(public).
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import type { DashboardSeriesPoint } from "@repo/core";

const SERIES_COLORS = ["var(--color-primary)", "var(--color-info)"] as const;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-2.5 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-popover-foreground">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.name}: <span className="font-medium text-popover-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function DashboardGrowthChart({
  data,
  usersLabel,
  articlesLabel,
  showUsers = true,
  showArticles = true,
  emptyTitle,
  emptyDescription,
}: {
  data: DashboardSeriesPoint[];
  usersLabel: string;
  articlesLabel: string;
  /**
   * Per-series visibility (changes-21 F8 §2.2 #9). A viewer may hold
   * `users.view` and not `analysis.view`, or the reverse, so the chart draws
   * only the lines they are entitled to. Omitting the line is the honest
   * option: the loader never read that series, so plotting it flat at zero
   * would tell the reader there were no signups rather than that the number
   * is not theirs to see.
   */
  showUsers?: boolean;
  showArticles?: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const hasData = data.some(
    (point) => (showUsers && point.users > 0) || (showArticles && point.articles > 0),
  );
  if (!hasData) {
    return (
      <Empty className="h-72 border-none">
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dashboard-users-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dashboard-articles-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[1]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES_COLORS[1]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip content={<ChartTooltip />} />
        {showUsers && (
          <Area
            type="monotone"
            dataKey="users"
            name={usersLabel}
            stroke={SERIES_COLORS[0]}
            fill="url(#dashboard-users-fill)"
            strokeWidth={2}
          />
        )}
        {showArticles && (
          <Area
            type="monotone"
            dataKey="articles"
            name={articlesLabel}
            stroke={SERIES_COLORS[1]}
            fill="url(#dashboard-articles-fill)"
            strokeWidth={2}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
