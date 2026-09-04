"use client";

// Client-side driver for the shared DataTable on SMALL datasets (roles,
// employees) where the page already loads the full list and adding server
// paging to @repo/core would be churn without benefit. The DataTable's
// contract stays "manual" — this hook plays the server's role locally:
// filter → sort → slice, and hands the table one page of rows.
import { useMemo, useState } from "react";
import type { PaginationState, SortingState, Updater } from "@tanstack/react-table";

function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

export interface ClientTableOptions<T> {
  /** Haystack for the global search box; omit to disable filtering. */
  searchText?: (row: T) => string;
  /** Sort accessors keyed by column id; a column without one won't sort. */
  sortValues?: Record<string, (row: T) => string | number | null | undefined>;
  initialPageSize?: number;
}

export function useClientTable<T>(rows: T[], options: ClientTableOptions<T> = {}) {
  const { searchText, sortValues, initialPageSize = 20 } = options;
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const filtered = useMemo(() => {
    if (!globalFilter.trim() || !searchText) return rows;
    const needle = globalFilter.trim().toLowerCase();
    return rows.filter((row) => searchText(row).toLowerCase().includes(needle));
  }, [rows, globalFilter, searchText]);

  const sorted = useMemo(() => {
    const sort = sorting[0];
    const accessor = sort ? sortValues?.[sort.id] : undefined;
    if (!sort || !accessor) return filtered;
    const dir = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls last, either direction
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sorting, sortValues]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pagination.pageSize));
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const data = useMemo(
    () => sorted.slice(pageIndex * pagination.pageSize, (pageIndex + 1) * pagination.pageSize),
    [sorted, pageIndex, pagination.pageSize],
  );

  return {
    /** Spread onto <DataTable>: data, pageCount and the controlled state trio. */
    tableProps: {
      data,
      pageCount,
      pagination: { ...pagination, pageIndex },
      onPaginationChange: (updater: Updater<PaginationState>) =>
        setPagination((current) => apply(updater, current)),
      sorting,
      onSortingChange: (updater: Updater<SortingState>) =>
        setSorting((current) => apply(updater, current)),
      globalFilter,
      onGlobalFilterChange: (value: string) => {
        setGlobalFilter(value);
        setPagination((current) => ({ ...current, pageIndex: 0 }));
      },
    },
    totalCount: sorted.length,
  };
}
