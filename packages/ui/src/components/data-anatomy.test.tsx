// changes-20 Phase 3, group 3 — tables, pagination, tabs and the filter row
// match the reference (tokens.md §6.8–§6.10, ADR-072 §9, capture-2).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableLabels } from "./data-table.tsx";
import { FilterBar, FilterBarItem, FilterBarRow } from "./filter-bar.tsx";
import {
  Pagination,
  PaginationBar,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.tsx";
import { Tabs, TabsList, TabsTrigger } from "./tabs.tsx";
import { ViewChip, ViewChips } from "./view-chips.tsx";

afterEach(cleanup);

const tokens = (el: Element | null | undefined) => (el?.getAttribute("class") ?? "").split(/\s+/);

describe("Table (tokens.md §6.9)", () => {
  const renderTable = (density?: "default" | "compact") =>
    render(
      <Table density={density}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

  it("header cells are the reference's 48px, muted, medium, logical-start", () => {
    renderTable();
    expect(tokens(screen.getByText("Name"))).toEqual(
      expect.arrayContaining([
        "h-12",
        "px-4",
        "text-muted-foreground",
        "font-medium",
        "text-start",
      ]),
    );
  });

  it("default density pads body cells p-4; a plain table header is unfilled", () => {
    const { container } = renderTable();
    expect(tokens(screen.getByText("Ada"))).toContain("p-4");
    expect(container.querySelector("table")?.getAttribute("data-density")).toBe("default");
    expect(tokens(container.querySelector("thead")).some((c) => c.startsWith("bg-"))).toBe(false);
  });

  it("compact density switches every cell at once, from the <table>", () => {
    const { container } = renderTable("compact");
    expect(container.querySelector("table")?.getAttribute("data-density")).toBe("compact");
    for (const text of ["Name", "Ada"]) {
      expect(tokens(screen.getByText(text))).toEqual(
        expect.arrayContaining([
          "group-data-[density=compact]/table:px-2.5",
          "group-data-[density=compact]/table:py-2",
          "group-data-[density=compact]/table:text-2xs",
        ]),
      );
    }
  });

  it("rows: border-b, muted hover, muted selection", () => {
    renderTable();
    expect(tokens(screen.getByText("Ada").closest("tr"))).toEqual(
      expect.arrayContaining(["border-b", "hover:bg-muted/50", "data-[state=selected]:bg-muted"]),
    );
  });
});

describe("DataTable (ADR-072 §9, tokens.md §6.10)", () => {
  const labels: DataTableLabels = {
    search: "Search users",
    columns: "Columns",
    export: "Export",
    selectedCount: (n) => `${n} selected`,
    page: (p, t) => `Page ${p} of ${t}`,
    previous: "Previous",
    next: "Next",
    noResults: "No results.",
  };
  const columns: ColumnDef<{ id: string; name: string }>[] = [
    { accessorKey: "name", header: "Name" },
  ];
  const renderDataTable = (density?: "default" | "compact") =>
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Ada" }]}
        labels={labels}
        pageCount={3}
        pagination={{ pageIndex: 0, pageSize: 15 }}
        onPaginationChange={vi.fn()}
        sorting={[]}
        onSortingChange={vi.fn()}
        globalFilter=""
        onGlobalFilterChange={vi.fn()}
        density={density}
      />,
    );

  it("is COMPACT by default — the reference's Users Directory", () => {
    const { container } = renderDataTable();
    expect(container.querySelector("table")?.getAttribute("data-density")).toBe("compact");
  });

  it("fills its header band with the reference's dense-list bg-muted/50", () => {
    const { container } = renderDataTable();
    expect(tokens(container.querySelector("thead"))).toContain("bg-muted/50");
  });

  it("searches with the SearchInput at the 36px filter-row size", () => {
    renderDataTable();
    const search = screen.getByLabelText("Search users");
    expect(search.getAttribute("type")).toBe("search");
    expect(tokens(search)).toContain("h-9");
  });

  it("puts the pager INSIDE the bordered block as a px-4 py-3 border-t footer", () => {
    const { container } = renderDataTable();
    const footer = container.querySelector("[data-slot=data-table-footer]");
    expect(footer).not.toBeNull();
    expect(tokens(footer)).toEqual(expect.arrayContaining(["border-t", "px-4", "py-3"]));
    const block = footer?.parentElement;
    expect(block?.querySelector("table")).not.toBeNull();
    expect(tokens(block)).toEqual(expect.arrayContaining(["rounded-md", "border", "bg-card"]));
    expect(footer?.querySelector("[data-slot=data-table-page]")?.textContent).toBe("Page 1 of 3");
  });

  it("density=default is still available for a roomier list", () => {
    const { container } = renderDataTable("default");
    expect(container.querySelector("table")?.getAttribute("data-density")).toBe("default");
  });
});

describe("Pagination (tokens.md §6.10, Q11)", () => {
  it("unifies on 36px: page links size-9, prev/next/first/last h-9 outlined, current page outlined", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationFirst href="#" aria-label="First page" />
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious href="#" text="Previous" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis label="More pages" />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" text="Next" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    const current = screen.getByText("1");
    expect(tokens(current)).toEqual(expect.arrayContaining(["size-9", "border-input"]));
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(tokens(screen.getByText("2"))).toEqual(
      expect.arrayContaining(["size-9", "hover:bg-accent"]),
    );
    expect(tokens(screen.getByText("2"))).not.toContain("border-input");
    for (const name of ["Go to previous page", "Go to next page", "First page"]) {
      expect(tokens(screen.getByLabelText(name))).toEqual(
        expect.arrayContaining(["h-9", "border-input"]),
      );
    }
    expect(tokens(document.querySelector("[data-slot=pagination-ellipsis]"))).toContain("size-9");
  });

  it("PaginationBar lays the reference's footer out: summary start, controls end", () => {
    render(<PaginationBar summary="Showing 1 to 15 of 99 results">controls</PaginationBar>);
    const bar = document.querySelector("[data-slot=pagination-bar]");
    expect(tokens(bar)).toEqual(
      expect.arrayContaining(["border-t", "px-4", "py-3", "sm:flex-row", "sm:justify-between"]),
    );
    expect(screen.getByText("Showing 1 to 15 of 99 results").getAttribute("data-slot")).toBe(
      "pagination-summary",
    );
  });
});

describe("Tabs (tokens.md §6.8)", () => {
  it("a 40px muted tray without a border; rounded-sm triggers; active raised on the background", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = screen.getByRole("tablist");
    expect(tokens(list)).toEqual(
      expect.arrayContaining(["rounded-md", "bg-muted", "p-1", "group-data-horizontal/tabs:h-10"]),
    );
    expect(tokens(list)).not.toContain("border");
    expect(tokens(screen.getByRole("tab", { name: "A" }))).toEqual(
      expect.arrayContaining([
        "rounded-sm",
        "px-3",
        "py-1.5",
        "data-active:bg-background",
        "data-active:shadow-sm",
      ]),
    );
  });
});

describe("ViewChips (tokens.md §6.8)", () => {
  it("a scrollable row of equal pills; the selected one is brand-filled and aria-pressed", () => {
    const onValueChange = vi.fn();
    render(
      <ViewChips value="default" onValueChange={onValueChange} aria-label="Column preset">
        <ViewChip value="default">Default</ViewChip>
        <ViewChip value="trading">Trading</ViewChip>
      </ViewChips>,
    );
    const group = document.querySelector("[data-slot=view-chips]");
    expect(tokens(group)).toEqual(
      expect.arrayContaining(["no-scrollbar", "overflow-x-auto", "gap-2"]),
    );
    const selected = screen.getByRole("button", { name: "Default" });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(tokens(selected)).toEqual(
      expect.arrayContaining([
        "rounded-full",
        "min-w-27.5",
        "flex-1",
        "text-xs",
        "data-pressed:bg-primary",
        "data-pressed:text-primary-foreground",
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Trading" }));
    expect(onValueChange).toHaveBeenCalledWith("trading");
  });

  it("never reports an empty selection — clicking the active chip keeps it", () => {
    const onValueChange = vi.fn();
    render(
      <ViewChips value="default" onValueChange={onValueChange}>
        <ViewChip value="default">Default</ViewChip>
      </ViewChips>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("FilterBar (tokens.md §3.2)", () => {
  it("wrapping rows of equal filter slots with a 150px floor, as a labelled toolbar", () => {
    render(
      <FilterBar aria-label="Filters">
        <FilterBarRow>
          <FilterBarItem>a</FilterBarItem>
        </FilterBarRow>
      </FilterBar>,
    );
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeTruthy();
    expect(tokens(document.querySelector("[data-slot=filter-bar-row]"))).toEqual(
      expect.arrayContaining(["flex-wrap", "gap-2"]),
    );
    expect(tokens(screen.getByText("a"))).toEqual(expect.arrayContaining(["min-w-37.5", "flex-1"]));
  });
});
