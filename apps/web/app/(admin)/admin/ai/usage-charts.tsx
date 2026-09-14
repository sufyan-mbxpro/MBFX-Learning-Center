"use client";

// Recharts is an admin-only dependency (architecture.md #5) — this file, and
// everything that imports it, must never be reachable from `app/(public)`.
//
// Every figure here is ESTIMATED and the caption says so (ADR-100 #4): our
// arithmetic over the provider's own token counts is close, not authoritative,
// and "estimated" stays on the screen for the same reason ADR-088 keeps
// "real-time" off the market numbers.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty, EmptyDescription, EmptyTitle } from "@repo/ui/components/empty";

export interface UsagePoint {
  /** An ISO date string; the label is formatted server-side. */
  date: string;
  label: string;
  costUsd: number;
}

export interface UsageBreakdown {
  name: string;
  costUsd: number;
  calls: number;
}

const SERIES_COLORS = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-accent)",
] as const;

function money(value: number): string {
  return value < 0.01 && value > 0 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

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
          {entry.name}:{" "}
          <span className="font-medium text-popover-foreground">{money(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function AiSpendChart({
  data,
  seriesLabel,
  emptyTitle,
  emptyDescription,
}: {
  data: UsagePoint[];
  seriesLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  // A fresh install has zero rows, and the whole screen has to render anyway.
  if (data.length === 0) {
    return (
      <Empty>
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="ai-spend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={money}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="costUsd"
          name={seriesLabel}
          stroke={SERIES_COLORS[0]}
          fill="url(#ai-spend)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AiBreakdownChart({
  data,
  seriesLabel,
  emptyTitle,
  emptyDescription,
}: {
  data: UsageBreakdown[];
  seriesLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (data.length === 0) {
    return (
      <Empty>
        <EmptyTitle>{emptyTitle}</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={money}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={150}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="costUsd" name={seriesLabel} fill={SERIES_COLORS[0]} radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
