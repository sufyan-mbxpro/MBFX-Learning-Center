import { describe, expect, it } from "vitest";
import { applyShelfView, availableShelfViews } from "./shelf-view.ts";

const rows = [
  { id: "a", isFeatured: false, publishedAt: "2026-01-01T00:00:00Z", popularity: 5 },
  { id: "b", isFeatured: true, publishedAt: "2026-03-01T00:00:00Z", popularity: 1 },
  { id: "c", isFeatured: false, publishedAt: null, popularity: 9 },
  { id: "d", isFeatured: true, publishedAt: "2026-02-01T00:00:00Z", popularity: 5 },
];
const ids = (list: { id: string }[]) => list.map((row) => row.id);

describe("applyShelfView (ADR-139 #5)", () => {
  it("all: featured first, the editors' order otherwise", () => {
    expect(ids(applyShelfView(rows, "all"))).toEqual(["b", "d", "a", "c"]);
  });

  it("featured: only the flagged rows", () => {
    expect(ids(applyShelfView(rows, "featured"))).toEqual(["b", "d"]);
  });

  it("popular: by count, stable on ties", () => {
    expect(ids(applyShelfView(rows, "popular"))).toEqual(["c", "a", "d", "b"]);
  });

  it("newest: by publish date, undated last", () => {
    expect(ids(applyShelfView(rows, "newest"))).toEqual(["b", "d", "a", "c"]);
  });

  it("never mutates its input", () => {
    const before = ids(rows);
    applyShelfView(rows, "popular");
    expect(ids(rows)).toEqual(before);
  });
});

describe("availableShelfViews", () => {
  it("offers Featured only when something is featured", () => {
    expect(availableShelfViews(rows.map((row) => ({ ...row, isFeatured: false })))).toEqual([
      "all",
      "popular",
      "newest",
    ]);
  });

  it("offers Popular only when the shelf carries a count", () => {
    const uncounted = rows.map(({ popularity: _popularity, ...row }) => row);
    expect(availableShelfViews(uncounted)).toEqual(["all", "featured", "newest"]);
  });
});
