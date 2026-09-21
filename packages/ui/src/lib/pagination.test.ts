import { describe, expect, it } from "vitest";
import { clampPage, DEFAULT_PAGE_SIZE, pageCountFor, pageSlice, pageWindow } from "./pagination.ts";

describe("pageWindow", () => {
  it("shows every page up to seven", () => {
    expect(pageWindow(0, 1)).toEqual([0]);
    expect(pageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("keeps first, last and the current page's neighbours past seven", () => {
    expect(pageWindow(0, 20)).toEqual([0, 1, "gap", 19]);
    expect(pageWindow(10, 20)).toEqual([0, "gap", 9, 10, 11, "gap", 19]);
    expect(pageWindow(19, 20)).toEqual([0, "gap", 18, 19]);
  });

  it("always contains the current page, the first and the last, in order", () => {
    // Exhaustive over a range rather than property-based: @repo/ui carries no
    // fast-check, and every (current, count) pair up to 60 pages is cheap.
    for (let count = 1; count <= 60; count += 1) {
      for (let current = 0; current < count; current += 1) {
        const pages = pageWindow(current, count).filter(
          (entry): entry is number => entry !== "gap",
        );
        expect(pages).toContain(current);
        expect(pages[0]).toBe(0);
        expect(pages[pages.length - 1]).toBe(count - 1);
        expect([...pages].sort((x, y) => x - y)).toEqual(pages);
      }
    }
  });
});

describe("page arithmetic", () => {
  it("defaults to six per page", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(6);
    expect(pageCountFor(6)).toBe(1);
    expect(pageCountFor(7)).toBe(2);
  });

  it("counts an empty list as one page", () => {
    expect(pageCountFor(0)).toBe(1);
  });

  it("clamps a page stranded past the end by a filter", () => {
    expect(clampPage(4, 2)).toBe(1);
    expect(clampPage(-1, 3)).toBe(0);
  });

  it("slices one page", () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    expect(pageSlice(items, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pageSlice(items, 2)).toEqual([12, 13]);
  });
});
