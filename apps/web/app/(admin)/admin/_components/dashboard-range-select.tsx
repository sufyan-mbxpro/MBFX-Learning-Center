"use client";

// Time-range filter for the dashboard — URL-driven like every other admin
// filter (useUrlFilters), so the range survives reload/back-nav and the
// server component re-fetches with the new window.
import { AdminCombobox } from "./combobox.tsx";
import { useUrlFilters } from "../_hooks/use-url-filters.ts";
import type { DashboardRange } from "@repo/core";

const RANGES: DashboardRange[] = ["7d", "30d", "90d", "1y"];

export function DashboardRangeSelect({
  value,
  label,
  labels,
}: {
  value: DashboardRange;
  label: string;
  labels: Record<DashboardRange, string>;
}) {
  const setParams = useUrlFilters();

  return (
    <AdminCombobox
      aria-label={label}
      className="w-40"
      value={value}
      onValueChange={(range) => setParams({ range })}
      options={RANGES.map((range) => ({ value: range, label: labels[range] }))}
    />
  );
}
