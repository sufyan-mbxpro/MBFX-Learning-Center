"use client";

// DataTable on TanStack Table v8 (plan.md Module 07): SERVER-driven
// pagination/sorting/filtering — the table never sorts or slices data
// itself, it reports state changes and renders what the server handed it.
// Column visibility and row selection are client concerns and stay local.
//
// No user-facing string has a hardcoded default (code-style.md #2): every
// label arrives via the `labels` prop so the calling surface passes values
// from its message catalog.
import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp, Columns3, Download } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

// `meta.label` gives human-readable (translated) names to the column
// visibility menu — without it the menu falls back to raw column ids.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- augmentation must match upstream's type parameters
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
  }
}

export interface DataTableLabels {
  search: string;
  columns: string;
  export: string;
  selectedCount: (count: number) => string;
  page: (page: number, pageCount: number) => string;
  previous: string;
  next: string;
  noResults: string;
  /** Label for the page-size picker, e.g. `(n) => `${n} per page``. */
  pageSize?: (size: number) => string;
}

export interface DataTableBulkAction<TData> {
  key: string;
  label: string;
  onClick: (rows: TData[]) => void;
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  labels: DataTableLabels;
  /** Total server-side page count — the server owns pagination. */
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  /** Server-side text filter value; the server does the filtering. */
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  enableRowSelection?: boolean;
  bulkActions?: DataTableBulkAction<TData>[];
  /** Enables CSV export of the current rows (selected rows when a selection exists). */
  exportFileName?: string;
  getRowId?: (row: TData) => string;
  /** Renders skeleton rows in place of data while the server round-trips. */
  isLoading?: boolean;
  /** Offer these page sizes in a picker (requires `labels.pageSize`). */
  pageSizeOptions?: number[];
  /** Richer empty state (icon + CTA); falls back to `labels.noResults`. */
  emptyState?: React.ReactNode;
  /**
   * Screen-specific filter controls (status / category / type Selects).
   * They render INSIDE the toolbar, immediately after the search box, so
   * search and filters share one horizontal row and wrap together
   * (changes-08 #7). A page that renders its filters in a separate bar
   * above the table is the layout this prop exists to replace.
   */
  filters?: React.ReactNode;
}

function toCsv<TData>(rows: Row<TData>[], visibleColumnIds: string[]): string {
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const header = visibleColumnIds.join(",");
  const body = rows.map((row) => visibleColumnIds.map((id) => escape(row.getValue(id))).join(","));
  // BOM so Excel detects UTF-8; CRLF per RFC 4180.
  return "\uFEFF" + [header, ...body].join("\r\n");
}

const SEARCH_DEBOUNCE_MS = 300;

export function DataTable<TData, TValue>({
  columns,
  data,
  labels,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  globalFilter,
  onGlobalFilterChange,
  enableRowSelection = false,
  bulkActions = [],
  exportFileName,
  getRowId,
  isLoading = false,
  pageSizeOptions,
  emptyState,
  filters,
}: DataTableProps<TData, TValue>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Debounced search: keystrokes land locally and reach the server callback
  // (usually a URL/router write) at most once per pause.
  const [searchValue, setSearchValue] = useState(globalFilter);
  useEffect(() => {
    setSearchValue(globalFilter);
  }, [globalFilter]);
  useEffect(() => {
    if (searchValue === globalFilter) return;
    const timer = setTimeout(() => onGlobalFilterChange(searchValue), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchValue, globalFilter, onGlobalFilterChange]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination, sorting, columnVisibility, rowSelection },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const pageSizeLabel = labels.pageSize;

  const exportCsv = () => {
    const rows = selectedRows.length > 0 ? selectedRows : table.getRowModel().rows;
    const visibleIds = table
      .getVisibleLeafColumns()
      .map((c) => c.id)
      .filter((id) => id !== "select");
    const blob = new Blob([toCsv(rows, visibleIds)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" data-slot="data-table-toolbar">
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="w-full min-w-0 sm:max-w-64"
          data-slot="data-table-search"
        />
        {filters}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {selectedRows.length > 0 && (
            <span className="text-sm text-muted-foreground" data-slot="data-table-selected-count">
              {labels.selectedCount(selectedRows.length)}
            </span>
          )}
          {selectedRows.length > 0 &&
            bulkActions.map((action) => (
              <Button
                key={action.key}
                variant="outline"
                size="sm"
                onClick={() => action.onClick(selectedRows.map((r) => r.original))}
              >
                {action.label}
              </Button>
            ))}
          {exportFileName && (
            <Button variant="outline" size="sm" onClick={exportCsv} data-slot="data-table-export">
              <Download data-icon="inline-start" aria-hidden />
              {labels.export}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Columns3 data-icon="inline-start" aria-hidden />
                  {labels.columns}
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(checked)}
                  >
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border" aria-busy={isLoading || undefined}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1 text-start font-medium",
                            "hover:text-foreground",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          aria-sort={
                            sortDir === "asc"
                              ? "ascending"
                              : sortDir === "desc"
                                ? "descending"
                                : "none"
                          }
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" ? (
                            <ChevronUp className="size-3.5" aria-hidden />
                          ) : sortDir === "desc" ? (
                            <ChevronDown className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pagination.pageSize, 10) }, (_, i) => (
                <TableRow key={i} data-slot="data-table-skeleton-row">
                  {Array.from({ length: visibleColumnCount }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyState ?? labels.noResults}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {pageSizeOptions && pageSizeOptions.length > 0 && pageSizeLabel && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" data-slot="data-table-page-size">
                  {pageSizeLabel(pagination.pageSize)}
                  <ChevronDown data-icon="inline-end" aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={String(pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                {pageSizeOptions.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                    {pageSizeLabel(size)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-sm text-muted-foreground" data-slot="data-table-page">
          {labels.page(pagination.pageIndex + 1, Math.max(pageCount, 1))}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {labels.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {labels.next}
        </Button>
      </div>
    </div>
  );
}
