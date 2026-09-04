"use client";

// Recharts is an admin-only dependency (architecture.md #5 — "chart-config
// UI" is named alongside Tiptap/TanStack Table) — this file, and everything
// that imports it, must never be reachable from app/(public).
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";
import type { DashboardSeriesPoint } from "@repo/core";

const SERIES_COLORS = ["var(--color-primary)", "var(--color-info)"] as const;
const STATUS_COLORS = [
  "var(--color-primary)",
  "var(--color-success)",
  "var(--color-info)",
  "var(--color-warning)",
  "var(--color-destructive)",
  "var(--color-accent)",
] as const;

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
  emptyTitle,
  emptyDescription,
}: {
  data: DashboardSeriesPoint[];
  usersLabel: string;
  articlesLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const hasData = data.some((point) => point.users > 0 || point.articles > 0);
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
        <Area
          type="monotone"
          dataKey="users"
          name={usersLabel}
          stroke={SERIES_COLORS[0]}
          fill="url(#dashboard-users-fill)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="articles"
          name={articlesLabel}
          stroke={SERIES_COLORS[1]}
          fill="url(#dashboard-articles-fill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DashboardStatusChart({
  data,
  emptyTitle,
  emptyDescription,
}: {
  data: { status: string; count: number; label: string }[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (data.length === 0) {
    return (
      <Empty className="h-64 border-none">
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Tooltip content={<ChartTooltip />} />
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={entry.status} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DashboardStatusLegend({
  data,
}: {
  data: { status: string; count: number; label: string }[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {data.map((entry, i) => (
        <li key={entry.status} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }}
              aria-hidden
            />
            {entry.label}
          </span>
          <span className="font-medium tabular-nums">{entry.count}</span>
        </li>
      ))}
    </ul>
  );
}
