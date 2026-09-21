// Regression (changes-38): with a `render` router element, every page link
// rendered as an empty box — Button passed its own undefined `children` over
// the ones cloned onto the element. /news is the only caller that supplies
// `render`, so the stock `<a>` path never showed it.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination.tsx";

afterEach(cleanup);

describe("Pagination with a render element", () => {
  it("keeps the page number and the Previous/Next labels", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious text="Previous" render={<a href="/news" />} />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink isActive render={<a href="/news?page=1" />}>
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext text="Next" render={<a href="/news?page=2" />} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );

    const current = screen.getByText("2").closest("a");
    expect(current?.getAttribute("href")).toBe("/news?page=1");
    expect(current?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Previous").closest("a")?.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Next").closest("a")?.getAttribute("href")).toBe("/news?page=2");
  });
});
