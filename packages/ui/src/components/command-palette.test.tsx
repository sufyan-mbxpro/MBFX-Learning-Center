// ADR-140 §5 — the ⌘K palette's one shape, in the package that owns it.
//
// What this pins: rows are grouped under their category heading, a row
// renders its title and description and NOTHING else (no path), the category
// chips filter the list, the legend is present, and choosing a row hands the
// row back without writing its title into the query.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BookOpen, Newspaper } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CommandPalette,
  type CommandPaletteGroup,
  type CommandPaletteItem,
  type CommandPaletteLabels,
} from "./command-palette.tsx";

afterEach(cleanup);

interface Row extends CommandPaletteItem {
  href: string;
}

const labels: CommandPaletteLabels = {
  title: "Search",
  description: "Find anything",
  placeholder: "What are you looking for?",
  close: "Close search",
  filterAll: "All",
  filterLabel: "Filter by category",
  legendOpen: "open",
  legendNavigate: "navigate",
  legendClose: "close",
};

const groups: CommandPaletteGroup<Row>[] = [
  {
    id: "article",
    label: "News & analysis",
    icon: Newspaper,
    items: [
      { id: "a1", title: "Reading a pip", description: "What moves a quote", href: "/news/pip" },
    ],
  },
  {
    id: "glossary",
    label: "Glossary",
    icon: BookOpen,
    items: [{ id: "g1", title: "Pip", description: null, href: "/glossary/pip" }],
  },
];

function renderPalette(overrides: Partial<React.ComponentProps<typeof CommandPalette<Row>>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    query: "",
    onQueryChange: vi.fn(),
    groups,
    onSelect: vi.fn(),
    emptyText: "Nothing matched that.",
    labels,
    ...overrides,
  };
  render(<CommandPalette<Row> {...props} />);
  return props;
}

describe("CommandPalette", () => {
  it("groups rows under their category heading, with title and description", () => {
    renderPalette();
    expect(screen.getAllByText("News & analysis").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Glossary").length).toBeGreaterThan(0);
    expect(screen.getByText("Reading a pip")).toBeTruthy();
    expect(screen.getByText("What moves a quote")).toBeTruthy();
  });

  it("never renders a row's href", () => {
    renderPalette();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("/news/pip");
    expect(dialog.textContent).not.toContain("/glossary/pip");
  });

  it("filters by category from the chip row, and All brings everything back", () => {
    renderPalette();
    const chips = screen.getByRole("group", { name: "Filter by category" });
    fireEvent.click(within(chips).getByRole("button", { name: "Glossary" }));
    expect(screen.queryByText("Reading a pip")).toBeNull();
    expect(screen.getByText("Pip")).toBeTruthy();
    expect(
      within(chips).getByRole("button", { name: "Glossary" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(within(chips).getByRole("button", { name: "All" }));
    expect(screen.getByText("Reading a pip")).toBeTruthy();
  });

  it("draws no chip row for a single category", () => {
    renderPalette({ groups: groups.slice(0, 1) });
    expect(screen.queryByRole("group", { name: "Filter by category" })).toBeNull();
  });

  it("shows the keyboard legend and a labelled close button", () => {
    renderPalette();
    expect(screen.getByText("open")).toBeTruthy();
    expect(screen.getByText("navigate")).toBeTruthy();
    expect(screen.getByText("close")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close search" })).toBeTruthy();
  });

  it("hands the chosen row back", () => {
    const props = renderPalette();
    fireEvent.click(screen.getByText("Pip"));
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
  });

  it("says the empty text when there is nothing to list", () => {
    renderPalette({ groups: [] });
    expect(screen.getByText("Nothing matched that.")).toBeTruthy();
  });

  it("names the input and keeps the global focus ring off it", () => {
    renderPalette();
    const input = screen.getByRole("combobox", { name: "Search" });
    expect(input.className).toContain("focus-visible:ring-0");
  });
});
