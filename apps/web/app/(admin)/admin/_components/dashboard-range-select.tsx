"use client";

// Time-range filter for the dashboard — URL-driven like every other admin
// filter (useUrlFilters), so the range survives reload/back-nav and the
// server component re-fetches with the new window.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
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
    <Select value={value} onValueChange={(v) => setParams({ range: v })}>
      <SelectTrigger aria-label={label} className="min-w-40">
        <SelectValue>{labels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((range) => (
          <SelectItem key={range} value={range}>
            {labels[range]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
