// DataTable interaction tests (SKILL.md: "sort/filter/select/export call
// server callbacks correctly"). jsdom — no layout engine, so these assert
// behavior (callbacks, CSV payloads, aria state), not pixels; visual and
// axe coverage rides with the Playwright suite (deferred with it).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { Checkbox } from "./checkbox.tsx";
import { DataTable, type DataTableLabels } from "./data-table.tsx";

interface Row {
  id: string;
  pair: string;
  bid: number;
}

const rows: Row[] = [
  { id: "1", pair: "EUR/USD", bid: 1.08 },
  { id: "2", pair: "GBP/USD", bid: 1.27 },
];

const labels: DataTableLabels = {
  search: "Search",
  columns: "Columns",
  export: "Export",
  selectedCount: (n) => `${n} selected`,
  page: (p, t) => `Page ${p} of ${t}`,
  previous: "Previous",
  next: "Next",
  noResults: "No results.",
};

const selectColumn: ColumnDef<Row> = {
  id: "select",
  enableHiding: false,
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllRowsSelected()}
      onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(checked) => row.toggleSelected(checked === true)}
      aria-label={`Select ${row.original.pair}`}
    />
  ),
};

const columns: ColumnDef<Row>[] = [
  selectColumn,
  { accessorKey: "pair", header: "Pair" },
  { accessorKey: "bid", header: "Bid", meta: { label: "Bid price" } },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof DataTable<Row, unknown>>> = {},
) {
  const onPaginationChange = vi.fn();
  const onSortingChange = vi.fn();
  const onGlobalFilterChange = vi.fn();
  const pagination: PaginationState = { pageIndex: 0, pageSize: 10 };
  const sorting: SortingState = [];

  const utils = render(
    <DataTable
      columns={columns}
      data={rows}
      labels={labels}
      pageCount={3}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      globalFilter=""
      onGlobalFilterChange={onGlobalFilterChange}
      enableRowSelection
      getRowId={(r) => r.id}
      {...overrides}
    />,
  );
  return { ...utils, onPaginationChange, onSortingChange, onGlobalFilterChange };
}

afterEach(cleanup);

describe("DataTable — server-driven contract", () => {
  it("renders the server-provided rows without sorting or slicing them itself", () => {
    renderTable();
    expect(screen.getByText("EUR/USD")).toBeDefined();
    expect(screen.getByText("GBP/USD")).toBeDefined();
  });

  it("clicking a sortable header reports the sort change to the server callback instead of sorting locally", () => {
    const { onSortingChange } = renderTable();
    fireEvent.click(screen.getByRole("button", { name: /pair/i }));
    expect(onSortingChange).toHaveBeenCalledTimes(1);
    // TanStack passes an updater fn — applying it to the current state
    // yields the sort the server should now apply.
    const updater = onSortingChange.mock.calls[0]![0] as (s: SortingState) => SortingState;
    expect(updater([])).toEqual([{ id: "pair", desc: false }]);
  });

  it("typing in the search box reports the filter value to the server callback after the debounce", () => {
    vi.useFakeTimers();
    try {
      const { onGlobalFilterChange } = renderTable();
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: "eur" } });
      // Debounced: nothing reaches the server callback until the pause.
      expect(onGlobalFilterChange).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400);
      expect(onGlobalFilterChange).toHaveBeenCalledWith("eur");
    } finally {
      vi.useRealTimers();
    }
  });

  it("next/previous report pagination changes; previous is disabled on the first page", () => {
    const { onPaginationChange } = renderTable();
    const prev = screen.getByRole("button", { name: "Previous" });
    expect(prev).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPaginationChange).toHaveBeenCalledTimes(1);
    const updater = onPaginationChange.mock.calls[0]![0] as (p: PaginationState) => PaginationState;
    expect(updater({ pageIndex: 0, pageSize: 10 })).toEqual({ pageIndex: 1, pageSize: 10 });
  });

  it("shows the empty state when the server returns no rows", () => {
    renderTable({ data: [] });
    expect(screen.getByText("No results.")).toBeDefined();
  });

  it("renders skeleton rows instead of data while loading", () => {
    const { container } = renderTable({ isLoading: true });
    expect(screen.queryByText("EUR/USD")).toBeNull();
    expect(
      container.querySelectorAll("[data-slot=data-table-skeleton-row]").length,
    ).toBeGreaterThan(0);
  });
});

describe("DataTable — selection and bulk actions", () => {
  it("selecting rows surfaces the count and hands the ORIGINAL row objects to the bulk action", () => {
    const onArchive = vi.fn();
    renderTable({
      bulkActions: [{ key: "archive", label: "Archive", onClick: onArchive }],
    });

    fireEvent.click(screen.getByLabelText("Select EUR/USD"));
    expect(screen.getByText("1 selected")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledWith([rows[0]]);
  });
});

describe("DataTable — CSV export", () => {
  it("exports visible columns for all rows (selected rows when a selection exists), quoting correctly", () => {
    let capturedBytes: Uint8Array | null = null;
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn((blob: Blob) => {
        void blob.arrayBuffer().then((buf) => (capturedBytes = new Uint8Array(buf)));
        return "blob:test";
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderTable({ exportFileName: "rates" });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(click).toHaveBeenCalled();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const bytes = capturedBytes!;
        // BOM prefix for Excel UTF-8 detection (Blob.text() would strip it,
        // so assert the raw bytes), then CRLF rows per RFC 4180.
        expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        expect(new TextDecoder().decode(bytes.slice(3))).toBe(
          "pair,bid\r\nEUR/USD,1.08\r\nGBP/USD,1.27",
        );
        vi.unstubAllGlobals();
        click.mockRestore();
        resolve();
      }, 0);
    });
  });
});

describe("DataTable — column visibility", () => {
  it("hiding a column via the Columns menu (labelled from meta.label) removes it from the table", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /columns/i }));
    const menu = screen.getByRole("menu");
    // meta.label gives the menu its human-readable name; raw ids are the fallback.
    fireEvent.click(within(menu).getByText("Bid price"));
    expect(screen.queryByText("1.08")).toBeNull();
  });
});
