// The client pager's contract (changes-37, ADR-121 §2): it pages without a
// navigation, it looks like the /news pager, and a filter never strands a
// reader past the end of a list.
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClientPagination,
  usePagedList,
  type ClientPaginationLabels,
} from "./client-pagination.tsx";

afterEach(cleanup);

const labels: ClientPaginationLabels = {
  label: "Pagination",
  previous: "Previous",
  next: "Next",
  morePages: "More pages",
  page: (page) => `Page ${page}`,
};

describe("ClientPagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <ClientPagination page={0} pageCount={1} onPageChange={vi.fn()} labels={labels} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("is buttons, not links — paging never navigates", () => {
    render(<ClientPagination page={0} pageCount={3} onPageChange={vi.fn()} labels={labels} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("type")).toBe("button");
  });

  it("marks the current page and omits Previous on the first", () => {
    render(<ClientPagination page={0} pageCount={3} onPageChange={vi.fn()} labels={labels} />);
    expect(screen.getByRole("button", { name: "Page 1" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  });

  it("uses the /news pager's treatment: outlined current, ghost numbers", () => {
    render(<ClientPagination page={1} pageCount={3} onPageChange={vi.fn()} labels={labels} />);
    const current = screen.getByRole("button", { name: "Page 2" });
    const other = screen.getByRole("button", { name: "Page 1" });
    expect(current.getAttribute("data-variant") ?? current.className).toMatch(/outline|border/);
    expect(other.className).not.toBe(current.className);
  });

  it("reports the page a button asks for", () => {
    const onPageChange = vi.fn();
    render(<ClientPagination page={1} pageCount={3} onPageChange={onPageChange} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPageChange.mock.calls).toEqual([[2], [0], [2]]);
  });
});

describe("usePagedList", () => {
  const items = Array.from({ length: 14 }, (_, i) => i);

  it("shows six per page by default", () => {
    const { result } = renderHook(() => usePagedList(items));
    expect(result.current.pageItems).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.current.pageCount).toBe(3);
  });

  it("moves between pages", () => {
    const { result } = renderHook(() => usePagedList(items));
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toEqual([12, 13]);
    expect(result.current.offset).toBe(12);
  });

  it("returns to page one when the filter changes", () => {
    const { result, rerender } = renderHook(
      ({ list, key }) => usePagedList(list, { resetKey: key }),
      {
        initialProps: { list: items, key: "all" },
      },
    );
    act(() => result.current.setPage(2));
    rerender({ list: items.slice(0, 8), key: "beginner" });
    expect(result.current.page).toBe(0);
  });

  it("clamps a page the list shrank out from under", () => {
    const { result, rerender } = renderHook(({ list }) => usePagedList(list), {
      initialProps: { list: items },
    });
    act(() => result.current.setPage(2));
    rerender({ list: items.slice(0, 7) });
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual([6]);
  });
});
